/**
 * The argument vectors, and the three sets that classify the verbs.
 *
 * The classification is what M3's refresh guard will enforce, so it is checked
 * against the verb table rather than against a list written twice.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import type { AnkCli, RunOptions } from '../../ank/cli';
import { Capabilities } from '../../ank/help';
import type { HelpDocument } from '../../ank/types';
import { Ank, RENEWING_VERBS, REPAINT_VERBS, WRITING_VERBS } from '../../ank/verbs';

const help = JSON.parse(
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
      'help.json',
    ),
    'utf8',
  ),
) as HelpDocument;

/** Records what was asked of the process without ever starting one. */
class Recorder {
  readonly calls: { argv: readonly string[]; options: RunOptions }[] = [];

  json(argv: readonly string[], options: RunOptions = {}): Promise<unknown> {
    this.calls.push({ argv, options });
    return Promise.resolve({ code: 0, document: { contract: 1 }, warnings: [] });
  }

  run(argv: readonly string[], options: RunOptions = {}): Promise<unknown> {
    this.calls.push({ argv, options });
    return Promise.resolve({ code: 0, stdout: '', stderr: '' });
  }

  get last(): readonly string[] {
    return this.calls[this.calls.length - 1]?.argv ?? [];
  }
}

function recorded(): { ank: Ank; tape: Recorder } {
  const tape = new Recorder();
  const ank = new Ank(tape as unknown as AnkCli, { repo: '/repo' });
  return { ank, tape };
}

test('every call carries the corpus it is about', async () => {
  const { ank, tape } = recorded();
  await ank.status();

  // A caller that could forget --repo is a caller that can address the wrong
  // corpus, silently. The address is appended by the adapter, not by callers.
  assert.deepEqual(tape.calls[0]?.options.address, { repo: '/repo' });
});

test('a worktree is the second half of the address', async () => {
  const tape = new Recorder();
  const ank = new Ank(tape as unknown as AnkCli, { repo: '/repo', worktree: '/tree' });
  await ank.status();

  assert.deepEqual(tape.calls[0]?.options.address, { repo: '/repo', worktree: '/tree' });
});

test('an absent option contributes no flag', async () => {
  const { ank, tape } = recorded();
  await ank.claim('TASK-1');
  assert.deepEqual(tape.last, ['claim', 'TASK-1']);

  await ank.claim('TASK-1', { ttl: '30m' });
  assert.deepEqual(tape.last, ['claim', 'TASK-1', '--ttl', '30m']);
});

test('a repeatable flag repeats rather than joining its values', async () => {
  const { ank, tape } = recorded();
  await ank.create('task', {
    title: 'A task',
    scope: ['src/**', 'docs/**'],
    blockedBy: ['TASK-1', 'TASK-2'],
  });

  assert.deepEqual(tape.last, [
    'new',
    'task',
    '--title',
    'A task',
    '--scope',
    'src/**',
    '--scope',
    'docs/**',
    '--blocked-by',
    'TASK-1',
    '--blocked-by',
    'TASK-2',
  ]);
});

test('a title carrying a quote is one argument and is not escaped', async () => {
  // There is no shell, so there is nothing to escape and nothing to inject.
  const hostile = 'a title with " and \' and ; rm -rf / and\na newline';
  const { ank, tape } = recorded();
  await ank.create('adr', { title: hostile, scope: ['src/**'] });

  assert.deepEqual(tape.last, [
    'new',
    'adr',
    '--title',
    hostile,
    '--scope',
    'src/**',
  ]);
});

test('check and review accept findings as an answer', async () => {
  const { ank, tape } = recorded();

  await ank.check();
  assert.deepEqual([...(tape.calls[0]?.options.answers ?? [])], [0, 8]);

  await ank.review();
  assert.deepEqual([...(tape.calls[1]?.options.answers ?? [])], [0, 8]);
});

test('done is given long enough to run the verifiers', async () => {
  const { ank, tape } = recorded();
  await ank.done();

  // `done` runs the verifiers itself, which is a build and not a read.
  const timeout = tape.calls[0]?.options.timeoutMs ?? 0;
  assert.ok(timeout >= 60_000, `done was given ${String(timeout)}ms`);
});

test('release always carries a reason', async () => {
  const { ank, tape } = recorded();
  await ank.release('TASK-1', 'the criterion is wrong');

  assert.deepEqual(tape.last, [
    'release',
    'TASK-1',
    '--reason',
    'the criterion is wrong',
  ]);
});

test('the renewing set is exactly what the contract says renews a lease', () => {
  // show, read, amend, attest and edit renew the task their id names; context
  // in execution mode renews the task the caller holds.
  assert.deepEqual(
    [...RENEWING_VERBS].sort(),
    ['amend', 'attest', 'context', 'edit', 'read', 'show'],
  );
});

test('the repaint set is the three pure reads a listing needs', () => {
  // `graph` is in it because blockedness is an edge and not a field: a task
  // waiting on another is `open` in its file. The alternative was `context`,
  // which computes readiness and renews the caller's claim doing it.
  assert.deepEqual([...REPAINT_VERBS].sort(), ['find', 'graph', 'status']);
});

test('no verb is both safe to repaint with and known to renew or write', () => {
  for (const verb of REPAINT_VERBS) {
    assert.equal(RENEWING_VERBS.has(verb), false, `${verb} renews a lease`);
    assert.equal(WRITING_VERBS.has(verb), false, `${verb} writes`);
  }
});

test('check is classified as a write, because it prunes claim refs', () => {
  // Losing a coordination ref loses a fact nothing else carries, so `check` is
  // never a poll however read-only its name sounds.
  assert.equal(WRITING_VERBS.has('check'), true);
});

test('every classified verb exists in the verb table', () => {
  const capabilities = Capabilities.of(help.verbs);
  for (const verb of [...RENEWING_VERBS, ...WRITING_VERBS, ...REPAINT_VERBS]) {
    assert.ok(capabilities.has(verb), `${verb} is not a verb`);
  }
});

test('the capability probe answers about the table it was given', () => {
  const capabilities = Capabilities.of(help.verbs);

  assert.equal(capabilities.has('context'), true);
  assert.equal(capabilities.has('teleport'), false);
  assert.equal(capabilities.summary('teleport'), null);
  assert.match(capabilities.summary('claim') ?? '', /freezes its done_criteria/);

  // The refusals are published so a client can read what a call will refuse
  // before making it.
  const refusals = capabilities.refusals('claim').map((refusal) => refusal.code);
  assert.deepEqual(refusals.sort(), [4, 7]);
});

test('the groups come back in the order the table declares them', () => {
  const capabilities = Capabilities.of(help.verbs);

  assert.deepEqual(capabilities.groups(), [
    'run the loop',
    'shape the work',
    'look around',
    'keep the corpus honest',
    'set up a repository',
  ]);
  assert.ok(capabilities.group('run the loop').length > 0);
});
