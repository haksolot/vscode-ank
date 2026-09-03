/**
 * The gate, and the leniency behind it.
 *
 * Two rules pull in opposite directions and both are load-bearing: refuse a
 * document whose contract version we were not written against, and never
 * refuse one for carrying a field we do not know.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ContractError, isVersionMismatch, parseDocument } from '../../ank/contract';
import type { StatusDocument } from '../../ank/types';

test('a document at the expected contract parses', () => {
  const document = parseDocument<StatusDocument>(
    '{"contract":1,"corpus":"abc","branch":"main"}',
  );

  assert.equal(document.contract, 1);
  assert.equal(document.corpus, 'abc');
});

test('a field we do not know is not a breaking change', () => {
  // Within a contract version a document may gain a field. A parser that
  // refused one would turn a compatible ank release into a broken extension.
  const document = parseDocument<StatusDocument>(
    '{"contract":1,"branch":"main","something_added_later":{"deep":[1,2]}}',
  );

  assert.equal(document.branch, 'main');
});

test('a newer contract is refused, and says which side is which', () => {
  assert.throws(
    () => parseDocument('{"contract":2,"branch":"main"}'),
    (error: unknown) => {
      assert.ok(error instanceof ContractError);
      assert.equal(error.declared, 2);
      assert.match(error.message, /contract 1/);
      assert.match(error.message, /2/);
      return true;
    },
  );
});

test('a version mismatch is told apart from a malformed answer', () => {
  // One means the binary and this extension are at different points in
  // history and the answer is to update one. The other is a bug.
  let mismatch: unknown;
  try {
    parseDocument('{"contract":99}');
  } catch (error) {
    mismatch = error;
  }
  assert.equal(isVersionMismatch(mismatch), true);

  let malformed: unknown;
  try {
    parseDocument('not json at all');
  } catch (error) {
    malformed = error;
  }
  assert.equal(isVersionMismatch(malformed), false);
});

test('empty stdout is refused, because a refusal leaves stdout empty', () => {
  // Reaching here with nothing to read means a caller treated a non-zero exit
  // as an answer. There is no JSON error envelope to look for.
  assert.throws(() => parseDocument(''), ContractError);
  assert.throws(() => parseDocument('   \n'), ContractError);
});

test('a document that is not an object is refused', () => {
  assert.throws(() => parseDocument('[1,2,3]'), ContractError);
  assert.throws(() => parseDocument('"a string"'), ContractError);
  assert.throws(() => parseDocument('null'), ContractError);
});

test('a document with no contract field is refused', () => {
  assert.throws(
    () => parseDocument('{"branch":"main"}'),
    (error: unknown) => {
      assert.ok(error instanceof ContractError);
      assert.equal(error.declared, null);
      return true;
    },
  );
});

test('trailing whitespace on the one line does not matter', () => {
  // `--json` is one line on stdout, but a shell or a pipe may add a newline.
  const document = parseDocument<StatusDocument>('{"contract":1,"queue":3}\n');
  assert.equal(document.queue, 3);
});
