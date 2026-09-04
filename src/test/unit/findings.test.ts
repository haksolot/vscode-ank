/**
 * How a finding is classified.
 *
 * The severity mapping is the one thing in this extension most likely to be
 * "corrected" later by somebody who thinks a signal ought to be a warning. The
 * test says why it is not.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import type { CheckDocument } from '../../ank';
import { isEntitySubject, weightOf } from '../../providers/findings';

const checked = JSON.parse(
  readFileSync(
    path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      'src',
      'test',
      'fixtures',
      'golden-json',
      'check.json',
    ),
    'utf8',
  ),
) as CheckDocument;

test('a fault is an error', () => {
  assert.equal(weightOf('fault'), 'error');
});

test('a signal is information, and deliberately not a warning', () => {
  // A signal alone leaves the exit code 0. Reddening a build over an
  // observation teaches a team to stop reading `check`, and `check` is the
  // verb that catches a frozen criterion diverging.
  assert.equal(weightOf('signal'), 'information');
  assert.notEqual(weightOf('signal'), 'error');
});

test('a level nobody has published yet is not treated as an error', () => {
  // The vocabulary may gain a word. Guessing that a new one is a fault would
  // redden a build over something the binary called an observation.
  assert.equal(weightOf('something-new'), 'information');
});

test('an entity subject is told apart from a corpus-level one', () => {
  assert.equal(isEntitySubject('TASK-6da126c832be'), true);
  assert.equal(isEntitySubject('ADR-0000000000ab'), true);
  assert.equal(isEntitySubject('SPEC-19c4f0a83b2e'), true);
  assert.equal(isEntitySubject('LOG-c0f96bc669ae'), true);

  // `check` also reports on the repository itself. These have nowhere in the
  // corpus to anchor and go to the config, which is where their fix is written.
  assert.equal(isEntitySubject('allowed_signers'), false);
  assert.equal(isEntitySubject('coordination'), false);
  assert.equal(isEntitySubject('corpus'), false);
});

test('a subject that only looks like an id is not one', () => {
  assert.equal(isEntitySubject('TASK-6da126c832b'), false, 'eleven characters');
  assert.equal(isEntitySubject('TASK-6DA126C832BE'), false, 'upper case');
  assert.equal(isEntitySubject('THING-6da126c832be'), false, 'unknown kind');
  assert.equal(isEntitySubject(''), false);
});

test('every subject in the golden check document classifies', () => {
  const anchored = checked.findings.map((finding) => ({
    subject: finding.subject,
    entity: isEntitySubject(finding.subject),
    weight: weightOf(finding.level),
  }));

  assert.ok(anchored.length > 0);
  assert.ok(anchored.every((row) => row.weight === 'information'));
  assert.ok(anchored.every((row) => row.entity));
});

test('the charge names entities, so it can be anchored too', () => {
  // `charge` is context-budget accounting: which entity costs what against the
  // budget a scope has. Every id in it is anchorable.
  for (const finding of checked.findings) {
    for (const charge of finding.charge) {
      assert.equal(isEntitySubject(charge.id), true, `${charge.id} is not an id`);
      assert.equal(typeof charge.characters, 'number');
    }
  }
});
