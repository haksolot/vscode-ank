/**
 * The TypeScript interfaces, tied to the fixtures they claim to describe.
 *
 * `conformance.test.ts` checks the fixtures against the shapes the binary
 * publishes. That leaves one gap: our interfaces could still drift from both.
 * The key maps below close it in two directions at once. `Record<keyof T,
 * true>` fails to compile if the interface gains a field the map does not
 * name, and the runtime walk fails if the map names a field the fixture does
 * not carry. So an interface cannot quietly disagree with the bytes.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { isTaskDocument } from '../../ank/types';
import type {
  CheckDocument,
  ContextDocument,
  FindDocument,
  GraphDocument,
  LogReadDocument,
  ReviewDocument,
  ScopeDocument,
  ShowTaskDocument,
  StatusDocument,
} from '../../ank/types';

const GOLDEN = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'src',
  'test',
  'fixtures',
  'golden-json',
);

function fixture<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(GOLDEN, `${name}.json`), 'utf8')) as T;
}

/** Asserts the document carries every key the interface declares. */
function carries<T extends object>(
  document: T,
  keys: Record<keyof T, true>,
  where: string,
): void {
  for (const key of Object.keys(keys)) {
    assert.ok(key in document, `${where} does not carry ${key}`);
  }
}

const CONTEXT_KEYS: Record<keyof ContextDocument, true> = {
  contract: true,
  mode: true,
  head: true,
  criteria: true,
  constraints: true,
  proposed: true,
  specs: true,
  tasks: true,
  log: true,
  ready: true,
  blocked: true,
  finished_elsewhere: true,
  warnings: true,
};

const STATUS_KEYS: Record<keyof StatusDocument, true> = {
  contract: true,
  corpus: true,
  branch: true,
  default_branch: true,
  identity: true,
  claim: true,
  drift: true,
  also_held: true,
  remote: true,
  refs: true,
  elsewhere: true,
  constraints: true,
  queue: true,
  unmerged: true,
  faults: true,
  signals: true,
};

const FIND_KEYS: Record<keyof FindDocument, true> = {
  contract: true,
  corpus: true,
  total: true,
  shown: true,
  hidden: true,
  results: true,
};

const GRAPH_KEYS: Record<keyof GraphDocument, true> = {
  contract: true,
  path: true,
  tasks: true,
  edges: true,
};

const SCOPE_KEYS: Record<keyof ScopeDocument, true> = {
  contract: true,
  path: true,
  total: true,
  adr: true,
  specs: true,
  tasks: true,
};

const SHOW_TASK_KEYS: Record<keyof ShowTaskDocument, true> = {
  contract: true,
  id: true,
  coordination: true,
  blocked_by: true,
  unblocks: true,
  detached_proofs: true,
  log_total: true,
  log_shown: true,
  log: true,
  machinery: true,
  content: true,
};

const CHECK_KEYS: Record<keyof CheckDocument, true> = {
  contract: true,
  faults: true,
  signals: true,
  tasks: true,
  adr: true,
  pruned: true,
  findings: true,
};

const REVIEW_KEYS: Record<keyof ReviewDocument, true> = {
  contract: true,
  proposed: true,
  signers: true,
  live: true,
  dead: true,
  faults: true,
  signals: true,
};

const LOG_READ_KEYS: Record<keyof LogReadDocument, true> = {
  contract: true,
  about: true,
  total: true,
  shown: true,
  entries: true,
  machinery: true,
};

test('the interfaces carry what the fixtures carry', () => {
  carries(fixture<ContextDocument>('context'), CONTEXT_KEYS, 'context');
  carries(fixture<StatusDocument>('status'), STATUS_KEYS, 'status');
  carries(fixture<FindDocument>('find'), FIND_KEYS, 'find');
  carries(fixture<GraphDocument>('graph'), GRAPH_KEYS, 'graph');
  carries(fixture<ScopeDocument>('scope'), SCOPE_KEYS, 'scope');
  carries(fixture<ShowTaskDocument>('show'), SHOW_TASK_KEYS, 'show');
  carries(fixture<CheckDocument>('check'), CHECK_KEYS, 'check');
  carries(fixture<ReviewDocument>('review'), REVIEW_KEYS, 'review');
  carries(fixture<LogReadDocument>('log-read'), LOG_READ_KEYS, 'log-read');
});

test('a show document over a task is told apart by its edges', () => {
  const overTask = fixture<ShowTaskDocument>('show');
  assert.ok(isTaskDocument(overTask), 'show.json is the shape over a task');
  assert.ok(Array.isArray(overTask.unblocks));

  // The other shape is the same document minus the edges. An ADR carrying them
  // empty would be answering a question nobody asked, so the narrowing has to
  // be on presence rather than on an empty array.
  const { blocked_by: _blocked, unblocks: _unblocks, ...overAdr } = overTask;
  assert.equal(isTaskDocument(overAdr), false);
});

test('the work trace and the machinery are split on records', () => {
  const shown = fixture<ShowTaskDocument>('show');

  assert.ok(
    shown.log.every((entry) => entry.records === null),
    'an entry in the work trace records nothing',
  );
  assert.ok(
    shown.machinery.every((entry) => entry.records !== null),
    'an entry in the machinery names what it records',
  );

  // The counts are of the work trace alone, so a task edited eight times does
  // not answer "what did the last holder learn" with eight mechanical lines.
  assert.equal(shown.log_total, shown.log.length);
  assert.equal(shown.log_shown, shown.log.length);
});

test('a find result carries the stored status and the resolved state apart', () => {
  const found = fixture<FindDocument>('find');
  assert.ok(found.results.length > 0);
  for (const result of found.results) {
    assert.equal(typeof result.status, 'string');
    assert.equal(typeof result.state, 'string');
  }
  assert.equal(found.total, found.shown + found.hidden);
});

test('context orders the ready tasks first', () => {
  const context = fixture<ContextDocument>('context');
  const ready = context.tasks.filter((task) => task.ready);

  assert.equal(context.ready, ready.length);
  assert.equal(context.blocked, context.tasks.length - ready.length);

  // Ready first, then by how many other tasks each would unblock. The order is
  // computed by the CLI; the views must not recompute it.
  const firstBlocked = context.tasks.findIndex((task) => !task.ready);
  const lastReady = context.tasks.map((task) => task.ready).lastIndexOf(true);
  assert.ok(firstBlocked === -1 || lastReady < firstBlocked);
});

test('a finding carries its level and what it charges the budget', () => {
  const checked = fixture<CheckDocument>('check');
  assert.ok(checked.findings.length > 0);

  for (const finding of checked.findings) {
    assert.ok(
      finding.level === 'fault' || finding.level === 'signal',
      `unknown level ${finding.level}`,
    );
    assert.ok(Array.isArray(finding.note));
    for (const charge of finding.charge) {
      assert.equal(typeof charge.id, 'string');
      assert.equal(typeof charge.characters, 'number');
    }
  }

  // Signals alone leave the exit code 0; only a fault reaches 8.
  assert.equal(checked.faults, 0);
  assert.equal(
    checked.signals,
    checked.findings.filter((finding) => finding.level === 'signal').length,
  );
});

test('status reports null and zero as different answers', () => {
  const status = fixture<StatusDocument>('status');

  // `refs` is null rather than zero unless --remote was passed. A client that
  // read it as a count would report a clean mirror it never fetched.
  assert.equal(status.remote, false);
  assert.equal(status.refs, null);
  assert.notEqual(status.claim, null);
});
