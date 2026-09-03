/**
 * The only place in this extension that starts a process.
 *
 * Everything above this file receives a typed document or an `AnkError`. The
 * rules it enforces on every call are the ones a caller must not be able to
 * forget:
 *
 * - `execFile` with an argument array. No shell is involved, so no argument is
 *   ever escaped or quoted by us and no entity title can become a command.
 * - `--json` and `--repo` are appended here rather than by callers. A caller
 *   that could forget `--repo` is a caller that can address the wrong corpus,
 *   silently.
 * - stdout is parsed only where the exit code says a document is there. A
 *   refusal leaves stdout empty: there is no JSON error envelope to look for.
 *
 * Nothing in this directory imports `vscode`. The adapter is a plain node
 * module so the whole of it can be unit tested without an editor.
 */

import { execFile } from 'node:child_process';
import type { ExecFileException } from 'node:child_process';

import { parseDocument } from './contract';
import { AnkError, ExitCode, parseWarnings, refusalFrom } from './errors';
import type { AnkDocument } from './types';

/** Where a somewhat verbose account of every call goes. */
export interface Sink {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * One corpus, addressed.
 *
 * `repo` is the working tree the corpus belongs to. `worktree` is the second
 * half of the address, present where the corpus was initialised outside the
 * tree it describes.
 */
export interface CorpusAddress {
  repo: string;
  worktree?: string;
}

export interface RunOptions {
  /** The corpus this call is about. Omitted only for `help` and `--version`. */
  address?: CorpusAddress;
  signal?: AbortSignal;
  /** Defaults to 30s. `done` runs verifiers and is given far longer. */
  timeoutMs?: number;
  /**
   * Exit codes that carry a document rather than a refusal.
   *
   * Defaults to `[0]`. `check` and `review` pass `[0, 8]`: exit 8 is findings,
   * which is a successful answer that happens to carry faults.
   */
  answers?: readonly number[];
}

/** What a process left behind, before anything is made of it. */
export interface RawResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** A document, with whatever the same call put on stderr beside it. */
export interface Answer<T> {
  code: number;
  document: T;
  /** `warning:` lines. They share stderr with refusals and are not errors. */
  warnings: string[];
}

const DEFAULT_TIMEOUT_MS = 30_000;

/** `help --json` is 44KB today, and an entity body has no declared ceiling. */
const MAX_BUFFER = 64 * 1024 * 1024;

export class AnkCli {
  constructor(
    /** The binary, as `locate` resolved it. */
    private readonly binary: string,
    private readonly log: Sink,
    /** Overrides folded onto `process.env`. `ANK_AGENT` lives here. */
    private readonly env: Readonly<Record<string, string>> = {},
  ) {}

  /**
   * Runs a verb and returns its document.
   *
   * Throws `AnkError` on a refusal, carrying the exit code the caller branches
   * on and the hint the CLI named. Throws `ContractError` where stdout was not
   * a document this client can read.
   */
  async json<T extends AnkDocument>(
    argv: readonly string[],
    options: RunOptions = {},
  ): Promise<Answer<T>> {
    const answers = options.answers ?? [ExitCode.Ok];
    const result = await this.run([...argv, '--json'], options);

    if (!answers.includes(result.code)) {
      throw refusalFrom(result.code, result.stderr);
    }

    return {
      code: result.code,
      document: parseDocument<T>(result.stdout),
      warnings: parseWarnings(result.stderr),
    };
  }

  /**
   * Runs a verb and returns what the process left, judging none of it.
   *
   * The human-readable form of a verb goes through here. So does `--version`,
   * which answers on stdout and has no `--json` shape of its own.
   */
  async run(argv: readonly string[], options: RunOptions = {}): Promise<RawResult> {
    const args = [...argv, ...addressArgs(options.address)];
    const started = Date.now();

    this.log.info(`ank ${args.join(' ')}`);

    return new Promise<RawResult>((resolve, reject) => {
      execFile(
        this.binary,
        args,
        {
          env: { ...process.env, ...this.env },
          timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
          maxBuffer: MAX_BUFFER,
          windowsHide: true,
          encoding: 'utf8',
          ...(options.signal ? { signal: options.signal } : {}),
        },
        (error, stdout, stderr) => {
          const elapsed = Date.now() - started;

          if (error && isSpawnFailure(error)) {
            this.log.error(`ank could not be started: ${error.message}`);
            reject(spawnFailure(this.binary, error));
            return;
          }

          // execFile reports a non-zero exit as an error carrying the code.
          // That is the normal path here: a refusal is an answer.
          const code = exitCodeOf(error);
          this.log.info(`ank exited ${String(code)} in ${String(elapsed)}ms`);
          if (stderr.trim() !== '') {
            this.log.warn(stderr.trimEnd());
          }

          resolve({ code, stdout, stderr });
        },
      );
    });
  }
}

/**
 * The corpus address, as flags.
 *
 * `init` is the one verb that refuses `--repo`, because it makes the
 * repository the flag would have named; it is called with no address.
 */
function addressArgs(address: CorpusAddress | undefined): string[] {
  if (!address) {
    return [];
  }
  const args = ['--repo', address.repo];
  if (address.worktree !== undefined) {
    args.push('--worktree', address.worktree);
  }
  return args;
}

/**
 * True where the process never ran, as opposed to running and refusing.
 *
 * `execFile` reports both through the same argument. A missing binary carries
 * a string code such as `ENOENT`; a refusal carries the numeric exit status.
 */
function isSpawnFailure(error: ExecFileException): boolean {
  return typeof error.code === 'string' || error.killed === true;
}

function exitCodeOf(error: ExecFileException | null): number {
  if (!error) {
    return ExitCode.Ok;
  }
  return typeof error.code === 'number' ? error.code : ExitCode.Generic;
}

/**
 * A process that never started is exit 9 territory.
 *
 * The environment is what needs repairing, not the corpus, and saying so is
 * the difference between sending somebody to install a binary and sending them
 * to debug sound code.
 */
function spawnFailure(binary: string, error: ExecFileException): AnkError {
  const timedOut = error.killed === true;
  const message = timedOut
    ? `ank did not answer in time`
    : `ank could not be run as ${binary}`;
  const hint = timedOut ? null : 'npm install -g @haksolot/ank';
  return new AnkError(ExitCode.Environment, message, hint, error.message);
}
