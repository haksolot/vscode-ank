/**
 * The guard.
 *
 * This is the test that protects ADR-eddf502cd27b, and it is the one to keep
 * if the suite ever had to lose the rest. The rule it holds is the easiest in
 * the extension to break by accident -- a tooltip that reaches for `show`, a
 * status bar that calls `context` because `context` knows the criterion -- and
 * the breakage is invisible from inside: the claim simply never expires, and
 * the next agent is refused work it should have been given.
 *
 * So the cycle is driven for real, through the real `Ank`, over a recorder
 * standing in for the process. Whatever reached a command line is what is
 * asserted.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { AnkCli, RunOptions } from '../../ank';
import { Ank, RENEWING_VERBS, REPAINT_VERBS, WRITING_VERBS } from '../../ank';
import { Coalescer, repaint, repaintReader } from '../../corpus/refresh';

/** Stands in for the process, and remembers which verb each call named. */
class Recorder {
  readonly verbs: string[] = [];

  json(argv: readonly string[], _options: RunOptions = {}): Promise<unknown> {
    this.verbs.push(argv[0] ?? '');
    return Promise.resolve({
      code: 0,
      document: emptyDocument(argv[0] ?? ''),
      warnings: [],
    });
  }

  run(argv: readonly string[], _options: RunOptions = {}): Promise<unknown> {
    this.verbs.push(argv[0] ?? '');
    return Promise.resolve({ code: 0, stdout: '', stderr: '' });
  }
}

function emptyDocument(verb: string): Record<string, unknown> {
  if (verb === 'status') {
    return {
      contract: 1,
      corpus: 'root',
      branch: 'main',
      default_branch: 'main',
      identity: { value: 'test', source: 'env' },
      claim: null,
      drift: null,
      also_held: [],
      remote: false,
      refs: null,
      elsewhere: [],
      constraints: 0,
      queue: 0,
      unmerged: 0,
      faults: 0,
      signals: 0,
    };
  }
  return { contract: 1, corpus: 'root', total: 0, shown: 0, hidden: 0, results: [] };
}

function driven(): { ank: Ank; tape: Recorder } {
  const tape = new Recorder();
  return { ank: new Ank(tape as unknown as AnkCli, { repo: '/repo' }), tape };
}

test('a repaint runs status and find, and nothing else', async () => {
  const { ank, tape } = driven();

  await repaint(repaintReader(ank));

  const ran = new Set(tape.verbs);
  assert.deepEqual([...ran].sort(), ['find', 'status']);
});

test('a repaint touches no verb that renews a lease', async () => {
  const { ank, tape } = driven();

  await repaint(repaintReader(ank));

  for (const verb of tape.verbs) {
    assert.equal(
      RENEWING_VERBS.has(verb),
      false,
      `${verb} renews a lease and a repaint reached it`,
    );
  }
});

test('a repaint touches no verb that writes', async () => {
  const { ank, tape } = driven();

  await repaint(repaintReader(ank));

  for (const verb of tape.verbs) {
    assert.equal(WRITING_VERBS.has(verb), false, `${verb} writes and a repaint reached it`);
  }
});

test('every verb a repaint ran is in the permitted set', async () => {
  const { ank, tape } = driven();

  await repaint(repaintReader(ank));

  for (const verb of tape.verbs) {
    assert.ok(REPAINT_VERBS.has(verb), `${verb} is not a repaint verb`);
  }
});

test('the reader handed to a view has two methods and no more', () => {
  // The rule is enforced by the type rather than by discipline: a view that
  // wanted `show` would have to be handed something else first.
  const { ank } = driven();
  const reader = repaintReader(ank);

  assert.deepEqual(Object.keys(reader).sort(), ['find', 'status']);
});

test('a repaint asks for the three kinds separately', async () => {
  const { ank, tape } = driven();

  await repaint(repaintReader(ank));

  // One status, and one find per kind. `find` filters on one kind at a time,
  // and a merged listing would have to be split again to be shown.
  assert.equal(tape.verbs.filter((verb) => verb === 'status').length, 1);
  assert.equal(tape.verbs.filter((verb) => verb === 'find').length, 3);
});

test('a snapshot carries the tasks and the decisions apart', async () => {
  const { ank } = driven();
  const snapshot = await repaint(repaintReader(ank), () => 1234);

  assert.equal(snapshot.at, 1234);
  assert.deepEqual(snapshot.tasks, []);
  assert.deepEqual(snapshot.decisions, []);
  assert.equal(snapshot.status.corpus, 'root');
});

/* ------------------------------------------------------------- coalescing */

test('a burst of requests produces one repaint', async () => {
  let runs = 0;
  const coalescer = new Coalescer(() => {
    runs += 1;
    return Promise.resolve();
  }, 5);

  coalescer.request();
  coalescer.request();
  coalescer.request();

  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(runs, 1);
  coalescer.dispose();
});

test('a request arriving mid-repaint runs once after it, not twice', async () => {
  let runs = 0;
  let release: (() => void) | undefined;

  const coalescer = new Coalescer(async () => {
    runs += 1;
    if (runs === 1) {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    }
  }, 1);

  const first = coalescer.now();
  await new Promise((resolve) => setTimeout(resolve, 5));

  // Two more arrive while the first is still in flight. The answer to every
  // event is the same read, so the later one subsumes the earlier.
  void coalescer.now();
  void coalescer.now();

  release?.();
  await first;
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(runs, 2);
  coalescer.dispose();
});

test('disposing a coalescer cancels what it was about to do', async () => {
  let runs = 0;
  const coalescer = new Coalescer(() => {
    runs += 1;
    return Promise.resolve();
  }, 5);

  coalescer.request();
  coalescer.dispose();

  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(runs, 0);
});

test('there is no timer anywhere in the refresh path', async () => {
  // A coalescer delays a repaint somebody asked for. It never asks for one.
  let runs = 0;
  const coalescer = new Coalescer(() => {
    runs += 1;
    return Promise.resolve();
  }, 5);

  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(runs, 0);
  coalescer.dispose();
});
