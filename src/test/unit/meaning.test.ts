/**
 * The role table, reimplemented exactly (ADR-2a33a9a3bda3).
 *
 * Upstream publishes meanings and not colours, and it publishes two lookup
 * rules with them. Both rules exist because a state string is not always a
 * bare status: it carries addressing after a colon, and an expiry that can
 * appear on either side of one. Getting either wrong shows a lapsed claim as
 * healthy, which is precisely the thing a reader is looking at the view to
 * find out.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { addressingOf, roleOfKind, roleOfSeverity, roleOfStatus } from '../../ui/meaning';

test('every status name in the table maps to its role', () => {
  assert.equal(roleOfStatus('open'), 'available');
  assert.equal(roleOfStatus('in_progress'), 'underway');
  assert.equal(roleOfStatus('claimed'), 'underway');
  assert.equal(roleOfStatus('done'), 'accomplished');
  assert.equal(roleOfStatus('finished'), 'accomplished');
  assert.equal(roleOfStatus('accepted'), 'accomplished');
  assert.equal(roleOfStatus('closed'), 'retired');
  assert.equal(roleOfStatus('superseded'), 'retired');
  assert.equal(roleOfStatus('proposed'), 'awaiting');
  assert.equal(roleOfStatus('expired'), 'attention');
});

test('a state containing expired is Attention whatever it expired from', () => {
  // Rule one. The word is not always at the front: a claim that lapsed on a
  // finished task reads `done expired:...`.
  assert.equal(roleOfStatus('open expired:who@host'), 'attention');
  assert.equal(roleOfStatus('done expired:who@host'), 'attention');
  assert.equal(roleOfStatus('expired'), 'attention');
});

test('what follows a colon is addressing, not state', () => {
  // Rule two. `claimed:who@host` is claimed; `finished:abc1234 on main` is
  // finished. A lookup on the whole string would find neither.
  assert.equal(roleOfStatus('claimed:marie@laptop'), 'underway');
  assert.equal(roleOfStatus('finished:abc1234 on main'), 'accomplished');
});

test('a marker in brackets is stripped before the lookup', () => {
  assert.equal(roleOfStatus('[open]'), 'available');
  assert.equal(roleOfStatus('[claimed:who@host]'), 'underway');
});

test('blocked is deliberately absent, because it is an edge', () => {
  // It is derived from `blocked_by` at read time and no entity is stored
  // carrying it, so the views derive it the same way ank does.
  assert.equal(roleOfStatus('blocked'), null);
});

test('a name the table does not carry has no role', () => {
  // No role means leave it alone: the default foreground, not a colour we
  // invented for the unknown.
  assert.equal(roleOfStatus('something-new'), null);
  assert.equal(roleOfStatus(''), null);
  assert.equal(roleOfKind('unicorn'), null);
  assert.equal(roleOfSeverity('catastrophe'), null);
});

test('every kind is an identifier, and severities split fault from signal', () => {
  for (const kind of ['task', 'adr', 'spec', 'log']) {
    assert.equal(roleOfKind(kind), 'identifier');
  }
  // Only a fault reaches exit 8; a signal is an observation.
  assert.equal(roleOfSeverity('fault'), 'fault');
  assert.equal(roleOfSeverity('signal'), 'attention');
  assert.notEqual(roleOfSeverity('fault'), roleOfSeverity('signal'));
});

test('the addressing is what a reader wants beside the icon', () => {
  // The icon already said `claimed`. Who has it is the part worth the column.
  assert.equal(addressingOf('claimed:marie@laptop'), 'marie@laptop');
  assert.equal(addressingOf('finished:abc1234 on main'), 'abc1234 on main');
  assert.equal(addressingOf('open'), null);
  assert.equal(addressingOf('open:'), null);
});
