/**
 * What an unattended refresh is allowed to do (ADR-eddf502cd27b).
 *
 * A repaint runs `status` and `find`, and nothing else. Two separate hazards
 * make that one rule:
 *
 * - Some read verbs renew a lease. `show`, `read`, `amend`, `attest` and
 *   `edit` renew the task their id names when the caller holds it, and
 *   `context` in execution mode renews the task the caller holds. A view that
 *   polled one would keep a claim alive in front of an empty chair all night,
 *   and no other agent could take the work.
 * - `check` writes. It prunes the claim refs it finds stale, and losing a
 *   coordination ref loses a fact nothing else carries. `review` shares its
 *   walk of git history.
 *
 * The rule is enforced by construction rather than by discipline: this module
 * hands the view layer a `RepaintReader`, which has two methods, and the view
 * layer never sees an `Ank`. The guard test drives a whole cycle and fails if
 * anything but those two verbs reached a process.
 */

import type { Ank, FindOptions } from '../ank';
import type { FindDocument, FindResult, StatusDocument } from '../ank';

/**
 * The only reads an unattended refresh may make.
 *
 * Deliberately not an `Ank`. A narrower type is what keeps a tooltip from
 * reaching for `show` because it was there.
 */
export interface RepaintReader {
  status(): Promise<StatusDocument>;
  find(query?: string, options?: FindOptions): Promise<FindDocument>;
}

/** Narrows a full adapter to the two verbs a repaint may use. */
export function repaintReader(ank: Ank): RepaintReader {
  return {
    status: () => ank.status(),
    find: (query, options) => ank.find(query, options),
  };
}

/** What one repaint learned, and when. */
export interface Snapshot {
  status: StatusDocument;
  tasks: FindResult[];
  decisions: FindResult[];
  at: number;
}

/**
 * One repaint.
 *
 * Three calls: where am I, what work is there, what decisions are there.
 * `status` carries the claim, the drift, the queue and the counts, which is
 * everything the status bar needs and everything a view needs to know whether
 * to look further.
 *
 * The two listings are separate calls because `find` filters on one kind at a
 * time and a merged listing would have to be split again to be shown.
 */
export async function repaint(
  reader: RepaintReader,
  now: () => number = Date.now,
): Promise<Snapshot> {
  const [status, tasks, adr, specs] = await Promise.all([
    reader.status(),
    reader.find(undefined, { type: 'task' }),
    reader.find(undefined, { type: 'adr' }),
    reader.find(undefined, { type: 'spec' }),
  ]);

  return {
    status,
    tasks: tasks.results,
    decisions: [...adr.results, ...specs.results],
    at: now(),
  };
}

/**
 * Coalesces bursts, and never lets two repaints of one corpus overlap.
 *
 * Events arrive in bursts: a verb that writes an entity and pushes a ref
 * produces two. A request that arrives while one is in flight replaces
 * whatever was pending rather than queueing behind it, because the answer to
 * every event is the same read and the latest one subsumes the rest.
 */
export class Coalescer {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running = false;
  private again = false;

  constructor(
    private readonly work: () => Promise<void>,
    private readonly delayMs = 150,
  ) {}

  /** Asks for a repaint soon. Several asks in one burst produce one repaint. */
  request(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.fire();
    }, this.delayMs);
  }

  /** Asks for a repaint now, still without overlapping one in flight. */
  async now(): Promise<void> {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    await this.fire();
  }

  dispose(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private async fire(): Promise<void> {
    if (this.running) {
      this.again = true;
      return;
    }

    this.running = true;
    try {
      await this.work();
    } finally {
      this.running = false;
    }

    if (this.again) {
      this.again = false;
      await this.fire();
    }
  }
}
