/**
 * Refusals, and the codes that carry their meaning.
 *
 * The codes are the contract and are stable. The messages are written for a
 * person to read and may be improved at any time, so nothing here branches on
 * a word of one: the text and the hint are carried through to the user, and
 * every decision is made on the number.
 */

/**
 * The exit code table, as ank publishes it.
 *
 * A const object rather than an `enum` on purpose: every code this client
 * handles arrives as a plain `number` from a process, and comparing one
 * against an enum member is the kind of thing a linter is right to stop.
 */
export const ExitCode = {
  /** The verb answered. */
  Ok: 0,
  /** Parser refusals, unreadable files, cases with no prescribed reaction. */
  Generic: 1,
  /** No such entity, or a prefix matching more than one. */
  NotFound: 2,
  /** The entity moved under the caller. Read again and retry. */
  Conflict: 3,
  /** Held by another agent, or finished on another branch. Take something else. */
  Unavailable: 4,
  /** A proof is missing, malformed, or of a type this act does not accept. */
  Proof: 5,
  /** The act is illegal from the state the entity is in. */
  Transition: 6,
  /** The act is legal and something it depends on is absent. */
  Prerequisite: 7,
  /** `check` or `review` found something. Only a fault reaches here. */
  Findings: 8,
  /** The environment to repair, not the work that failed. */
  Environment: 9,
} as const;

export type ExitCode = (typeof ExitCode)[keyof typeof ExitCode];

/**
 * What the user should be told a code means, in one line.
 *
 * These are ours, not the CLI's. The CLI already said what went wrong; this
 * says what kind of thing went wrong, so a notification can be worded as a
 * fact about the corpus rather than as a crash.
 */
const SENSE: Readonly<Record<number, string>> = {
  [ExitCode.Generic]: 'ank refused the command',
  [ExitCode.NotFound]: 'no such entity, or the prefix matches more than one',
  [ExitCode.Conflict]: 'the entity moved: read it again and retry',
  [ExitCode.Unavailable]: 'that task is not available: take another',
  [ExitCode.Proof]: 'a proof is missing or invalid',
  [ExitCode.Transition]: 'not legal from the state this entity is in',
  [ExitCode.Prerequisite]: 'something this depends on is absent',
  [ExitCode.Findings]: 'findings were reported',
  [ExitCode.Environment]: 'the environment needs repairing, not the corpus',
};

export function senseOf(code: number): string {
  return SENSE[code] ?? `ank exited ${String(code)}`;
}

/**
 * True where the right reaction is to re-read and try once more.
 *
 * Exit 3 alone. Exit 4 is not retryable: the task is held or finished, and
 * retrying it is how a loop spins instead of taking other work.
 */
export function isRetryable(code: number): boolean {
  return code === ExitCode.Conflict;
}

/** A refusal from the CLI, carrying the code the caller must branch on. */
export class AnkError extends Error {
  override readonly name = 'AnkError';

  constructor(
    /** The process exit code. The contract. */
    readonly code: number,
    message: string,
    /**
     * The exact command the CLI said to run next, without its arrow.
     *
     * Every refusal names one. It is offered to the user as an action and is
     * never matched on.
     */
    readonly hint: string | null,
    /** Everything the process put on stderr, for the log. */
    readonly stderr: string,
  ) {
    super(message);
  }

  /** True where re-reading and retrying once is the right reaction. */
  get retryable(): boolean {
    return isRetryable(this.code);
  }

  /** What kind of thing went wrong, for a notification. */
  get sense(): string {
    return senseOf(this.code);
  }
}

const REFUSAL = /^error\[(\d+)\]:\s*(.*)$/;
const HINT = /^\s+->\s*(.*)$/;
const WARNING = /^warning:\s*(.*)$/;

interface Refusal {
  code: number;
  message: string;
  hint: string | null;
}

/**
 * Reads the refusal out of a stderr block.
 *
 * The shape is fixed and has exactly one rendering:
 *
 *     error[2]: entity not found: TASK-9999
 *       -> ank find TASK-9999
 *
 * Warnings share the stream, which is why this scans for the error line rather
 * than reading the first one. A message may run over several lines; every line
 * after the first that is not a hint and not a warning belongs to it.
 */
export function parseRefusal(stderr: string): Refusal | null {
  const lines = stderr.split(/\r?\n/);
  const start = lines.findIndex((line) => REFUSAL.test(line));
  if (start === -1) {
    return null;
  }

  const head = REFUSAL.exec(lines[start] ?? '');
  if (!head) {
    return null;
  }

  const code = Number(head[1]);
  const message: string[] = [head[2] ?? ''];
  let hint: string | null = null;

  for (const line of lines.slice(start + 1)) {
    const asHint = HINT.exec(line);
    if (asHint) {
      // The first hint is the one the refusal names. Later arrows, where a
      // refusal offers several routes, are appended so none is lost.
      hint = hint === null ? (asHint[1] ?? '') : `${hint}\n${asHint[1] ?? ''}`;
      continue;
    }
    if (WARNING.test(line) || REFUSAL.test(line)) {
      break;
    }
    if (line.trim() === '') {
      continue;
    }
    if (hint === null) {
      message.push(line.trim());
    }
  }

  return { code, message: message.join(' ').trim(), hint };
}

/** Every `warning:` line on a stderr block, in order, without its prefix. */
export function parseWarnings(stderr: string): string[] {
  const found: string[] = [];
  for (const line of stderr.split(/\r?\n/)) {
    const match = WARNING.exec(line);
    if (match) {
      found.push(match[1] ?? '');
    }
  }
  return found;
}

/**
 * Turns a non-zero exit into an `AnkError`.
 *
 * A refusal always names its code on stderr, but a process can also die
 * without ever reaching ank's own error path. Where there is nothing to parse,
 * the exit code still stands and the raw stderr becomes the message: better a
 * blunt report than a confident one that invented a cause.
 */
export function refusalFrom(code: number, stderr: string): AnkError {
  const parsed = parseRefusal(stderr);
  if (parsed) {
    return new AnkError(parsed.code, parsed.message, parsed.hint, stderr);
  }
  const fallback = stderr.trim() || `ank exited ${String(code)} and said nothing`;
  return new AnkError(code, fallback, null, stderr);
}
