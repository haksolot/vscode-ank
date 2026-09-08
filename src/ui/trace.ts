/**
 * A work trace, as rows a reader can pick from.
 *
 * The log is what previous holders wrote, and every entry of it is a `LOG-*`
 * entity in its own right -- which is the thing a picker over it has to carry.
 * A row that only rendered a message left the reader with the first line of an
 * entry and no way to reach the rest of it.
 *
 * Nothing here imports `vscode`. What a row looks like in a picker is the
 * caller's business; which entity a row stands for is decided here, so it can
 * be tested without an editor.
 */

import type { LogEntry } from '../ank';

/** The heading that keeps what the verbs wrote apart from what people wrote. */
export interface TraceHeading {
  heading: string;
}

/** An entry, addressed by the entity it is. */
export interface TraceEntry {
  /**
   * The entry's own entity, or null where it has none.
   *
   * A trace migrated from a previous layout predates entries being entities.
   * Null is offered as a row that opens nothing, which is the honest answer:
   * lending it a neighbour's id would open the wrong entry.
   */
  id: string | null;
  label: string;
  description: string;
  detail: string;
}

export type TraceRow = TraceHeading | TraceEntry;

export function isHeading(row: TraceRow): row is TraceHeading {
  return 'heading' in row;
}

/**
 * The trace, in the order a reader wants it.
 *
 * The work trace first, then the machinery under a heading. A task edited
 * eight times should not answer "what did the last holder learn" with eight
 * mechanical lines, so the split the CLI makes on `records` is kept.
 */
export function traceRows(read: {
  entries: readonly LogEntry[];
  machinery: readonly LogEntry[];
}): TraceRow[] {
  const rows: TraceRow[] = read.entries.map(rowOf);

  if (read.machinery.length > 0) {
    rows.push({ heading: 'Machinery' });
    rows.push(...read.machinery.map(rowOf));
  }

  return rows;
}

function rowOf(entry: LogEntry): TraceEntry {
  return {
    id: entry.id,
    label: entry.message,
    // What a machinery entry recorded is what tells it apart from another;
    // where it recorded nothing there is nothing to say about it.
    description:
      entry.records === null ? entry.who : `${entry.who} · records ${entry.records}`,
    detail: entry.timestamp,
  };
}
