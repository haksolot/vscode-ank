/**
 * A work trace, as rows a reader can pick from.
 *
 * The bug this pins is a picker that reads: every row stood for a `LOG-*`
 * entity and none of them said which, so choosing one had nothing to open.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import type { LogEntry } from '../../ank';
import { isHeading, traceRows } from '../../ui/trace';

function entry(fields: Partial<LogEntry> = {}): LogEntry {
  return {
    id: 'LOG-fb24f209693b',
    timestamp: '2026-09-08T11:54:54Z',
    who: 'somebody@somewhere',
    message: 'the layout is not the contract',
    records: null,
    ...fields,
  };
}

test('a row stands for the entity it came from, and says so', () => {
  const [row] = traceRows({ entries: [entry()], machinery: [] });

  assert.ok(row && !isHeading(row));
  assert.equal(row.id, 'LOG-fb24f209693b');
  assert.equal(row.label, 'the layout is not the contract');
  assert.equal(row.description, 'somebody@somewhere');
  assert.equal(row.detail, '2026-09-08T11:54:54Z');
});

test('an entry with no entity of its own opens nothing', () => {
  // A migrated trace predates entries being entities. Offering the row with
  // somebody else's id would open the wrong thing, which is worse than a row
  // that reads and does not move.
  const [row] = traceRows({ entries: [entry({ id: null })], machinery: [] });

  assert.ok(row && !isHeading(row));
  assert.equal(row.id, null);
});

test('the machinery is kept apart, under a heading', () => {
  const rows = traceRows({
    entries: [entry({ id: 'LOG-aaaaaaaaaaaa' })],
    machinery: [entry({ id: 'LOG-bbbbbbbbbbbb', records: 'done' })],
  });

  assert.deepEqual(rows.map((row) => (isHeading(row) ? row.heading : row.id)), [
    'LOG-aaaaaaaaaaaa',
    'Machinery',
    'LOG-bbbbbbbbbbbb',
  ]);
});

test('what the machinery recorded is what tells it apart', () => {
  const rows = traceRows({
    entries: [],
    machinery: [entry({ records: 'claim' })],
  });
  const row = rows[1];

  assert.ok(row && !isHeading(row));
  assert.equal(row.description, 'somebody@somewhere · records claim');
});

test('a machinery entry that recorded nothing says only who wrote it', () => {
  // `records null` used to render as a dangling "records " with nothing after.
  const rows = traceRows({ entries: [], machinery: [entry()] });
  const row = rows[1];

  assert.ok(row && !isHeading(row));
  assert.equal(row.description, 'somebody@somewhere');
});

test('a trace with nothing in it has no heading either', () => {
  assert.deepEqual(traceRows({ entries: [], machinery: [] }), []);
});
