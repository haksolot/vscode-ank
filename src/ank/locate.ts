/**
 * Finding the binary, and reading what it says about itself.
 *
 * Three routes install ank and every one of them puts a single executable on
 * the PATH. So the search is short: whatever the user configured, then `ank`.
 * There is no bundled copy to fall back to and no download to offer -- an
 * extension that fetched an executable would be a supply chain nobody asked
 * for, and the install line is one command the user can read first.
 *
 * The probe goes through `AnkCli` like every other call, so this file starts
 * no process of its own. `--version` answers on stdout and has no `--json`
 * shape, which is why it goes through `run` rather than `json`.
 */

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { AnkCli, type Sink } from './cli';
import { AnkError, ExitCode } from './errors';

/** What `ank --version` says: the build, and the skill it was built beside. */
export interface Located {
  /** The command to spawn, as given. */
  binary: string;
  version: string;
  commit: string | null;
  /**
   * The revision of the skill this binary was built alongside.
   *
   * An agent that has loaded the skill holds a string it can compare against
   * this one, and can see for itself that its instructions predate its tool.
   */
  skill: string | null;
}

export const INSTALL_HINT = 'npm install -g @haksolot/ank';

/** `ank 0.7.0 (50f4b39, skill d25cedf8fe35)` */
const VERSION = /^ank\s+(\S+)(?:\s+\(([^,)]+)(?:,\s*skill\s+([^)]+))?\))?/;

const PROBE_TIMEOUT_MS = 10_000;

/**
 * Resolves the first candidate that answers `--version`.
 *
 * Candidates are tried in order and the first that runs wins. A candidate that
 * cannot be started is not an error until every one has been tried: a user who
 * configured a path that has since moved should fall back to the PATH rather
 * than be stopped.
 */
export async function locate(
  candidates: readonly string[],
  log: Sink,
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): Promise<Located> {
  const tried: string[] = [];

  for (const binary of [...candidates, ...windowsCandidates(env, platform)]) {
    if (binary.trim() === '' || tried.includes(binary)) {
      continue;
    }
    tried.push(binary);
    const spoken = await version(binary, log);
    if (spoken !== null) {
      return spoken;
    }
  }

  throw new AnkError(
    ExitCode.Environment,
    tried.length > 0
      ? `ank could not be run as ${tried.join(' or ')}`
      : 'no ank binary was named',
    INSTALL_HINT,
    '',
  );
}

/**
 * The executable behind a `.cmd` shim, on Windows.
 *
 * npm installs `ank` as `ank.cmd`, and node refuses to spawn a `.cmd` without
 * a shell: it answers `EINVAL`, and has done since the argument-injection fix.
 * Passing `shell: true` would make it run and would put a command line back
 * between us and the process, where an entity title carrying an ampersand
 * becomes two commands. That is the one thing the adapter exists to avoid.
 *
 * So the shim is not run. The executable it would have reached is found
 * instead, at the layout npm gives a global install:
 *
 *     <dir>/ank.cmd
 *     <dir>/node_modules/@haksolot/ank-win32-x64/bin/ank.exe
 *
 * and that is a real executable `execFile` can start with an argument array.
 * An installation from the PowerShell one-liner or from cargo puts `ank.exe`
 * on the PATH directly, which is why that is looked for first.
 */
function windowsCandidates(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  arch: string = process.arch,
): string[] {
  if (platform !== 'win32') {
    return [];
  }

  const directories = (env['PATH'] ?? env['Path'] ?? '').split(path.delimiter);
  const direct: string[] = [];
  const throughShim: string[] = [];

  for (const directory of directories) {
    if (directory.trim() === '') {
      continue;
    }

    const exe = path.join(directory, 'ank.exe');
    if (existsSync(exe)) {
      direct.push(exe);
      continue;
    }

    if (existsSync(path.join(directory, 'ank.cmd'))) {
      const packaged = packagedBinary(directory, arch);
      if (packaged !== null) {
        throughShim.push(packaged);
      }
    }
  }

  return [...direct, ...throughShim];
}

/**
 * The platform binary the npm wrapper would have reached.
 *
 * Resolved the way the wrapper resolves it, rather than by guessing at a path.
 * npm may hoist the platform package beside its parent or nest it underneath,
 * and which it does depends on what else is installed -- on this machine it is
 * nested, which a hardcoded layout would have missed. `require.resolve` from
 * the parent package answers correctly for both.
 */
function packagedBinary(directory: string, arch: string): string | null {
  const parent = path.join(
    directory,
    'node_modules',
    '@haksolot',
    'ank',
    'package.json',
  );
  if (!existsSync(parent)) {
    return null;
  }

  try {
    const from = createRequire(parent);
    return from.resolve(`@haksolot/ank-win32-${arch}/bin/ank.exe`);
  } catch {
    // The platform package is not installed. The wrapper answers that with
    // exit 9 and the cargo line, and so will the caller once every candidate
    // has been tried.
    return null;
  }
}

/** Runs `--version` on one candidate, or answers null where it did not run. */
async function version(binary: string, log: Sink): Promise<Located | null> {
  const cli = new AnkCli(binary, log);

  let spoken: string;
  try {
    const result = await cli.run(['--version'], { timeoutMs: PROBE_TIMEOUT_MS });
    if (result.code !== ExitCode.Ok) {
      return null;
    }
    spoken = result.stdout;
  } catch {
    // The process never started. That is what this loop is looking for, and
    // the next candidate gets its turn.
    return null;
  }

  const match = VERSION.exec(spoken.trim());
  if (!match) {
    // It ran and answered something else. That is a different binary wearing
    // the name, and reporting it as absent would send the user to reinstall
    // over a shadowed PATH entry.
    return { binary, version: spoken.trim(), commit: null, skill: null };
  }

  return {
    binary,
    version: match[1] ?? 'unknown',
    commit: match[2] ?? null,
    skill: match[3] ?? null,
  };
}
