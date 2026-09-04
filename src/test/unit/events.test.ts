/**
 * The three rules that are the whole of the event protocol.
 *
 * Whole lines only, a shorter file means start over, and an absent file is
 * normal. The last one is worth stating twice: most installations have no
 * watcher, so the stream is an optimisation over asking, never a condition.
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';

import { EVENTS_SCHEMA, EventTail, eventsPath } from '../../corpus/events';

const line = (corpus: string, change = 'entities'): string =>
  `${JSON.stringify({ schema: EVENTS_SCHEMA, corpus, change })}\n`;

test('whole lines are consumed and a partial one waits for its newline', () => {
  const tail = new EventTail();
  const whole = line('aaa');

  // A reader that took a half-written line would repaint on a corpus it could
  // not name.
  const partial = whole + '{"schema":1,"corpus":"bb';
  assert.deepEqual(
    tail.advance(partial).map((event) => event.corpus),
    ['aaa'],
  );

  const completed = partial + 'b","change":"refs"}\n';
  assert.deepEqual(
    tail.advance(completed).map((event) => event.corpus),
    ['bbb'],
  );
});

test('nothing whole yet reads as nothing, and holds the position', () => {
  const tail = new EventTail();

  assert.deepEqual(tail.advance('{"schema":1,"corp'), []);
  assert.equal(tail.position, 0);
});

test('a file shorter than the offset is read from the beginning again', () => {
  const tail = new EventTail();
  const two = line('aaa') + line('bbb');

  assert.equal(tail.advance(two).length, 2);
  assert.equal(tail.position, two.length);

  // The watcher started it over. The stream is news and not a log: nothing is
  // anchored in it, so it is bounded rather than kept.
  const restarted = line('ccc');
  assert.deepEqual(
    tail.advance(restarted).map((event) => event.corpus),
    ['ccc'],
  );
});

test('the same bytes read twice yield nothing the second time', () => {
  const tail = new EventTail();
  const two = line('aaa') + line('bbb');

  assert.equal(tail.advance(two).length, 2);
  assert.deepEqual(tail.advance(two), []);
});

test('a line at a schema we do not know is skipped, not guessed at', () => {
  const tail = new EventTail();
  const stream =
    `${JSON.stringify({ schema: 99, corpus: 'aaa', change: 'entities' })}\n` +
    line('bbb');

  assert.deepEqual(
    tail.advance(stream).map((event) => event.corpus),
    ['bbb'],
  );
});

test('a change word we do not know still means the corpus moved', () => {
  // The vocabulary is closed at entities and refs today and may gain a word.
  // An unknown one is still a repaint: there is one sensible answer.
  const tail = new EventTail();

  const events = tail.advance(line('aaa', 'something-new'));
  assert.equal(events.length, 1);
  assert.equal(events[0]?.change, 'something-new');
});

test('a malformed line does not stop the ones after it', () => {
  const tail = new EventTail();
  const stream = 'not json at all\n' + line('bbb') + '[1,2,3]\n' + line('ccc');

  assert.deepEqual(
    tail.advance(stream).map((event) => event.corpus),
    ['bbb', 'ccc'],
  );
});

test('a line missing a required key is skipped', () => {
  const tail = new EventTail();
  const stream =
    `${JSON.stringify({ schema: 1, change: 'entities' })}\n` +
    `${JSON.stringify({ schema: 1, corpus: 'aaa' })}\n` +
    line('bbb');

  assert.deepEqual(
    tail.advance(stream).map((event) => event.corpus),
    ['bbb'],
  );
});

test('an empty stream is not an error', () => {
  const tail = new EventTail();
  assert.deepEqual(tail.advance(''), []);
});

test('two checkouts of one corpus produce two lines carrying one identity', () => {
  // A corpus reached by two paths is one corpus, and the answer to both lines
  // is the same read. No path is carried beside the identity, deliberately.
  const tail = new EventTail();
  const events = tail.advance(line('same', 'entities') + line('same', 'refs'));

  assert.deepEqual(new Set(events.map((event) => event.corpus)), new Set(['same']));
  assert.deepEqual(
    events.map((event) => event.change),
    ['entities', 'refs'],
  );
});

/* ------------------------------------------------------------------ where */

test('the stream sits under APPDATA on Windows', () => {
  const where = eventsPath({ APPDATA: 'C:\\Users\\me\\AppData\\Roaming' }, 'win32');
  assert.equal(where, path.join('C:\\Users\\me\\AppData\\Roaming', 'ank', 'events.jsonl'));
});

test('the stream sits under XDG_CONFIG_HOME elsewhere', () => {
  const where = eventsPath({ XDG_CONFIG_HOME: '/home/me/.config' }, 'linux');
  assert.equal(where, path.join('/home/me/.config', 'ank', 'events.jsonl'));
});

test('it falls back to HOME/.config where XDG names nothing', () => {
  const where = eventsPath({ HOME: '/home/me' }, 'linux');
  assert.equal(where, path.join('/home/me', '.config', 'ank', 'events.jsonl'));
});

test('an empty variable counts as unset', () => {
  const where = eventsPath({ XDG_CONFIG_HOME: '   ', HOME: '/home/me' }, 'linux');
  assert.equal(where, path.join('/home/me', '.config', 'ank', 'events.jsonl'));
});

test('nowhere to look is answered with null rather than a guess', () => {
  // No watcher has ever run for this reader, and that is not a degraded mode.
  assert.equal(eventsPath({}, 'linux'), null);
  assert.equal(eventsPath({}, 'win32'), null);
});
