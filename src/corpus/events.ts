/**
 * The change stream, followed.
 *
 * `ank watch` appends a line when a corpus it watches changes, and any program
 * may follow it. It is offered as a file rather than as a connection: there is
 * nothing to bind to, nothing to negotiate, and nothing you can ask it.
 * Several readers follow the same bytes without the watcher knowing any of
 * them exist.
 *
 * A line says a corpus moved and nothing more. It carries no title, no status,
 * no body and no identifier, and it never will. What changed is on the stream;
 * what is now true of it is what the CLI answers.
 *
 * Following it is not a second way into the corpus and must not become one.
 * Most installations have no watcher at all, so everything here is an
 * optimisation over asking on a timer -- never a source of truth, and never a
 * condition for anything.
 */

import { existsSync, readFileSync, watch } from 'node:fs';
import path from 'node:path';

/** The shape of a line. Not the contract version: the two move separately. */
export const EVENTS_SCHEMA = 1;

export interface AnkEvent {
  schema: number;
  /** The repository identity: the root commit. Never a path. */
  corpus: string;
  /** `entities` or `refs` today. The vocabulary may gain a word. */
  change: string;
}

/**
 * Where the stream is, under the same directory rule as `watch.yml`.
 *
 * An empty environment variable counts as unset, which is why each is tested
 * for content rather than for presence.
 */
export function eventsPath(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string | null {
  const home = (name: string): string | null => {
    const value = env[name];
    return value !== undefined && value.trim() !== '' ? value : null;
  };

  const base =
    platform === 'win32'
      ? home('APPDATA')
      : (home('XDG_CONFIG_HOME') ?? (home('HOME') ? path.join(home('HOME') ?? '', '.config') : null));

  return base === null ? null : path.join(base, 'ank', 'events.jsonl');
}

/**
 * Holds an offset into the stream and hands back what arrived past it.
 *
 * Pure, so the three rules that are the whole protocol can be tested without
 * a filesystem:
 *
 * - Consume whole lines only. A reader that took a half-written one would
 *   repaint on a corpus it could not name.
 * - A file shorter than the held offset means the watcher started it over, and
 *   the answer is to read from the beginning again. The stream is news and not
 *   a log: nothing is anchored in it, so it is bounded rather than kept.
 * - A file that is not there means no watcher has ever run for this reader.
 *   That is not an error and not a degraded mode.
 */
export class EventTail {
  private offset = 0;

  /** Everything readable past the offset, in order. Advances the offset. */
  advance(contents: string): AnkEvent[] {
    if (contents.length < this.offset) {
      // Started over. What was missed while we were not reading is missed
      // whatever the bound is, and the answer to every event is the same read.
      this.offset = 0;
    }

    const fresh = contents.slice(this.offset);
    const lastBreak = fresh.lastIndexOf('\n');
    if (lastBreak === -1) {
      // Nothing whole yet. Leave the offset where it is so the partial line is
      // read again once its newline arrives.
      return [];
    }

    this.offset += lastBreak + 1;

    return fresh
      .slice(0, lastBreak)
      .split('\n')
      .map(parseEvent)
      .filter((event): event is AnkEvent => event !== null);
  }

  /** Forgets the position, so the next advance reads from the beginning. */
  rewind(): void {
    this.offset = 0;
  }

  get position(): number {
    return this.offset;
  }
}

/**
 * One line, or nothing.
 *
 * A line whose schema we do not know is skipped rather than guessed at. A line
 * carrying a `change` word we do not know is kept: an unknown word still means
 * a corpus moved, and there is one sensible answer to that.
 */
function parseEvent(line: string): AnkEvent | null {
  const text = line.trim();
  if (text === '') {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const { schema, corpus, change } = parsed as Partial<AnkEvent>;
  if (schema !== EVENTS_SCHEMA) {
    return null;
  }
  if (typeof corpus !== 'string' || typeof change !== 'string') {
    return null;
  }

  return { schema, corpus, change };
}

/**
 * Watches the stream, where one exists.
 *
 * The file may appear long after this starts, or never. Neither is an error,
 * so the directory is watched rather than the file: a watcher installed later
 * is followed from its beginning, and a reader that never gets one simply
 * falls back to what every installation without a watcher does.
 */
export class EventStream {
  private readonly tail = new EventTail();
  private watcher: ReturnType<typeof watch> | undefined;
  private directoryWatcher: ReturnType<typeof watch> | undefined;

  constructor(
    private readonly file: string,
    private readonly onEvents: (events: AnkEvent[]) => void,
    private readonly onError: (message: string) => void,
  ) {}

  start(): void {
    this.attach();
    this.awaitFile();
  }

  dispose(): void {
    this.watcher?.close();
    this.directoryWatcher?.close();
    this.watcher = undefined;
    this.directoryWatcher = undefined;
  }

  /** True where a watcher has written a stream for this reader. */
  get following(): boolean {
    return this.watcher !== undefined;
  }

  private attach(): void {
    if (this.watcher || !existsSync(this.file)) {
      return;
    }

    try {
      this.watcher = watch(this.file, { persistent: false }, () => this.drain());
      this.drain();
    } catch (error) {
      this.onError(`could not follow the event stream: ${String(error)}`);
    }
  }

  /**
   * Watches the directory so a stream that appears later is picked up.
   *
   * A directory that does not exist is not watched and not created: this
   * extension writes nothing outside the corpus, and a reader with no watcher
   * is the normal installation rather than a broken one.
   */
  private awaitFile(): void {
    if (this.watcher) {
      return;
    }

    const directory = path.dirname(this.file);
    if (!existsSync(directory)) {
      return;
    }

    try {
      this.directoryWatcher = watch(directory, { persistent: false }, () => {
        if (!this.watcher) {
          this.tail.rewind();
          this.attach();
        }
      });
    } catch {
      // A directory we cannot watch costs latency and never correctness.
    }
  }

  private drain(): void {
    try {
      if (!existsSync(this.file)) {
        return;
      }
      // The watcher bounds the file at CAP, so reading it whole is cheap and
      // the offset arithmetic stays on one string rather than on a seek.
      const contents = readFileSync(this.file, 'utf8');
      const events = this.tail.advance(contents);
      if (events.length > 0) {
        this.onEvents(events);
      }
    } catch (error) {
      this.onError(`could not read the event stream: ${String(error)}`);
    }
  }
}
