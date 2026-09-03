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
): Promise<Located> {
  const tried: string[] = [];

  for (const binary of candidates) {
    if (binary.trim() === '') {
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
