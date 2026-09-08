/**
 * What a command was pointed at, read without an editor.
 *
 * The bug this pins is a picker that opens on a right-click: the user has
 * already said which row, and the command asks anyway. It happens because a
 * context menu hands over the node and not the ref hanging off it, so the
 * shape check falls through to "nothing was given".
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { refIn } from '../../ui/addressing';

const corpus = { name: 'here' } as never;
const ref = { corpus, id: 'TASK-1a2b3c4d5e6f', kind: 'task', title: 'A task' };

test('a bare ref is already an address', () => {
  assert.equal(refIn(ref), ref);
});

test('a tree node carries its address one field down', () => {
  // What a context menu hands over: the element the provider returned, which
  // is a TreeItem with an id of its own. That id is the node's, not the
  // entity's, which is why the shape check cannot stop at "has an id".
  const node = { id: 'file:///repo::TASK-1a2b3c4d5e6f', label: 'A task', ref };

  assert.equal(refIn(node), ref);
});

test('a node whose ref lost its corpus addresses nothing', () => {
  // An id alone is not an address: two corpora may carry ids that look alike.
  const node = { ref: { id: 'TASK-1a2b3c4d5e6f', kind: 'task', title: 'A task' } };

  assert.equal(refIn(node), undefined);
});

test('a uri is not an address here, and is not mistaken for one', () => {
  // `ank:/TASK-1a2b3c4d5e6f.md?file:///repo` does name a corpus and an id, but
  // resolving those needs the registry. This rule is pure, so it says no and
  // leaves that case to the one caller that holds a registry.
  const uri = { scheme: 'ank', path: '/TASK-1a2b3c4d5e6f.md', query: 'file:///repo' };

  assert.equal(refIn(uri), undefined);
});

test('a group heading is a node with nothing under it', () => {
  assert.equal(refIn({ label: 'Ready', collapsibleState: 1 }), undefined);
});

for (const nothing of [undefined, null, 'TASK-1a2b3c4d5e6f', 42]) {
  test(`${String(nothing)} is not an address`, () => {
    assert.equal(refIn(nothing), undefined);
  });
}
