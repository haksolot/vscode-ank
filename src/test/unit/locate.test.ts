/**
 * Finding the binary.
 *
 * The Windows path is the interesting one and it was found by an integration
 * test rather than by reasoning: `ank` on the PATH is a `.cmd` shim, node
 * refuses to spawn one without a shell, and the extension silently did not
 * activate. What is asserted here is the shape of the answer when nothing is
 * found -- exit 9, with a command the user can run -- because that is what
 * separates "install this" from "your corpus is broken".
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AnkError, ExitCode, INSTALL_HINT, locate } from '../../ank';

const quiet = { info: () => {}, warn: () => {}, error: () => {} };

test('a binary that cannot be run is the environment, not the corpus', async () => {
  await assert.rejects(
    () => locate(['definitely-not-a-real-binary-ank'], quiet, {}, 'linux'),
    (error: unknown) => {
      assert.ok(error instanceof AnkError);
      // 9 is not a failure of the work. Reporting it as one sends somebody to
      // fix sound code.
      assert.equal(error.code, ExitCode.Environment);
      assert.equal(error.hint, INSTALL_HINT);
      assert.match(error.message, /definitely-not-a-real-binary-ank/);
      return true;
    },
  );
});

test('naming nothing at all is refused by name', async () => {
  await assert.rejects(
    () => locate(['', '   '], quiet, {}, 'linux'),
    (error: unknown) => {
      assert.ok(error instanceof AnkError);
      assert.match(error.message, /no ank binary was named/);
      return true;
    },
  );
});

test('the message lists every candidate that was tried', async () => {
  await assert.rejects(
    () => locate(['first-ank', 'second-ank'], quiet, {}, 'linux'),
    (error: unknown) => {
      assert.ok(error instanceof AnkError);
      assert.match(error.message, /first-ank or second-ank/);
      return true;
    },
  );
});

test('off Windows, nothing is added to the candidates', async () => {
  // The shim resolution is a Windows-only concern. On a platform where the
  // name on the PATH is the executable there is nothing to resolve.
  await assert.rejects(
    () => locate(['only-ank'], quiet, { PATH: '/usr/bin:/usr/local/bin' }, 'linux'),
    (error: unknown) => {
      assert.ok(error instanceof AnkError);
      assert.equal(error.message.includes('or'), false);
      return true;
    },
  );
});

test('on Windows a PATH naming nothing adds nothing', async () => {
  await assert.rejects(
    () =>
      locate(
        ['only-ank'],
        quiet,
        { PATH: 'C:\\nowhere;C:\\also-nowhere' },
        'win32',
      ),
    (error: unknown) => {
      assert.ok(error instanceof AnkError);
      assert.equal(error.message.includes('or'), false);
      return true;
    },
  );
});

test('the real binary answers, and says what it was built beside', async () => {
  // This one needs ank installed, which every machine running these tests has:
  // the repository they run in is itself a corpus.
  const located = await locate(['ank'], quiet);

  assert.match(located.version, /^\d+\.\d+\.\d+/);
  // The skill revision lets an agent see for itself that its instructions
  // predate its tool.
  assert.ok(located.skill === null || located.skill.length > 0);
});
