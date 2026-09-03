/**
 * Refusals, read off stderr.
 *
 * Every case here is a shape the CLI actually emits. What is being pinned is
 * that the code survives the parse intact and that the hint is separated from
 * the message, because the hint is offered to the user as an action and the
 * message is not.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  AnkError,
  ExitCode,
  isRetryable,
  parseRefusal,
  parseWarnings,
  refusalFrom,
  senseOf,
} from '../../ank/errors';

test('a refusal parses into its code, message and hint', () => {
  const parsed = parseRefusal(
    'error[2]: entity not found: TASK-9999\n  -> ank find TASK-9999\n',
  );

  assert.deepEqual(parsed, {
    code: 2,
    message: 'entity not found: TASK-9999',
    hint: 'ank find TASK-9999',
  });
});

test('a refusal on a held task carries the holder and the expiry', () => {
  const parsed = parseRefusal(
    'error[4]: TASK-6da126c832be held by tool/1.0 (expires in 30m)\n  -> ank context\n',
  );

  assert.equal(parsed?.code, ExitCode.Unavailable);
  assert.equal(parsed?.hint, 'ank context');
});

test('warnings share the stream and are not mistaken for the refusal', () => {
  // `ank amend` warns about a moved scope on stderr and still exits 0; a
  // refusal can arrive with warnings above it. Reading the first line would
  // report the warning as the error.
  const stderr = [
    'warning: TASK-ecc8 is held by claude@host, and the scope change moves the constraints its claim anchors',
    'error[6]: --criteria while a live claim freezes the criterion',
    '  -> ank release TASK-ecc8 --reason "<why>"',
  ].join('\n');

  const parsed = parseRefusal(stderr);
  assert.equal(parsed?.code, ExitCode.Transition);
  assert.equal(parsed?.message, '--criteria while a live claim freezes the criterion');
  assert.equal(parsed?.hint, 'ank release TASK-ecc8 --reason "<why>"');

  assert.deepEqual(parseWarnings(stderr), [
    'TASK-ecc8 is held by claude@host, and the scope change moves the constraints its claim anchors',
  ]);
});

test('a message running over two lines is kept whole', () => {
  const parsed = parseRefusal(
    'error[9]: no corpus is declared under 0000\n    and this server reaches no corpus nobody declared\n  -> ank config --user corpora.0000 <path>\n',
  );

  assert.equal(parsed?.code, ExitCode.Environment);
  assert.equal(
    parsed?.message,
    'no corpus is declared under 0000 and this server reaches no corpus nobody declared',
  );
  assert.equal(parsed?.hint, 'ank config --user corpora.0000 <path>');
});

test('a refusal offering two routes keeps both', () => {
  const parsed = parseRefusal(
    'error[7]: the task is blocked\n  -> ank graph\n  -> ank context\n',
  );

  assert.equal(parsed?.hint, 'ank graph\nank context');
});

test('a refusal with no hint parses, because the code is what binds', () => {
  const parsed = parseRefusal('error[1]: the path names nothing inside this repository');

  assert.equal(parsed?.code, ExitCode.Generic);
  assert.equal(parsed?.hint, null);
});

test('stderr carrying no refusal parses to nothing', () => {
  assert.equal(parseRefusal(''), null);
  assert.equal(parseRefusal('warning: something moved\n'), null);
});

test('a process that died without reaching the error path still keeps its code', () => {
  // Better a blunt report than a confident one that invented a cause.
  const error = refusalFrom(1, 'Segmentation fault\n');

  assert.equal(error.code, 1);
  assert.equal(error.message, 'Segmentation fault');
  assert.equal(error.hint, null);
});

test('a process that said nothing at all is still reported by its code', () => {
  const error = refusalFrom(137, '');

  assert.equal(error.code, 137);
  assert.match(error.message, /137/);
});

test('only a version conflict is retryable', () => {
  // 3 means somebody moved: read again. 4 means take something else, and
  // retrying it is how a loop spins instead of doing other work.
  assert.equal(isRetryable(ExitCode.Conflict), true);
  assert.equal(isRetryable(ExitCode.Unavailable), false);
  assert.equal(isRetryable(ExitCode.Transition), false);
  assert.equal(isRetryable(ExitCode.Ok), false);
});

test('an error carries the sense of its code for a notification', () => {
  const error = refusalFrom(9, 'error[9]: git is older than 2.34\n  -> upgrade git\n');

  assert.equal(error.code, ExitCode.Environment);
  assert.equal(error.retryable, false);
  // 9 is not a failure of the work, and must never be worded as one.
  assert.match(error.sense, /environment/);
  assert.ok(error instanceof AnkError);
});

test('the sense of an unknown code names the code rather than guessing', () => {
  assert.match(senseOf(42), /42/);
});

test('6 and 7 do not share a sense', () => {
  // In 6 the state forbids what was asked; in 7 the act is legal and something
  // it depends on is absent. A client that conflates them reacts wrongly.
  assert.notEqual(senseOf(ExitCode.Transition), senseOf(ExitCode.Prerequisite));
});
