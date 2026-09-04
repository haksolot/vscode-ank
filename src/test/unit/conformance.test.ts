/**
 * Every golden fixture, checked against the shape its verb declares.
 *
 * The fixtures in `src/test/fixtures/golden-json` are copied from
 * `crates/ank-cli/tests/golden-json` upstream, which offers them for exactly
 * this: "If you are writing a client, these are the exact bytes to write it
 * against." They are captured from the process rather than from a function, so
 * what they pin is what leaves the binary.
 *
 * The shapes are not written out here either. `help.json` is itself one of the
 * fixtures, and it carries the `returns` list of every verb -- flat, with the
 * path in the name. So this test reads the contract out of the contract and
 * confronts the other twenty-seven documents with it. Nothing in this file
 * would have to change if a verb gained a field; the fixtures would carry it
 * and the walk would check it.
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { CONTRACT_VERSION } from '../../ank/types';
import type { HelpDocument, ShapeField, ShapeType, VerbShape } from '../../ank/types';

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

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(path.join(GOLDEN, `${name}.json`), 'utf8'));
}

const help = fixture('help') as HelpDocument;

/**
 * Which verb each fixture came from, and which of its shapes it is.
 *
 * Three verbs answer two questions and so declare two shapes. The index is
 * written out rather than guessed, because guessing would let a document pass
 * against the wrong half of a verb that has two.
 */
const SOURCE: Readonly<Record<string, readonly [verb: string, shape: number]>> = {
  accept: ['accept', 0],
  amend: ['amend', 0],
  attest: ['attest', 0],
  check: ['check', 0],
  claim: ['claim', 0],
  close: ['close', 0],
  'config-read': ['config', 0],
  'config-write': ['config', 1],
  context: ['context', 0],
  done: ['done', 0],
  edit: ['edit', 0],
  find: ['find', 0],
  graph: ['graph', 0],
  help: ['help', 0],
  'help-verb': ['help', 0],
  init: ['init', 0],
  'init-again': ['init', 0],
  'log-read': ['log', 0],
  'log-write': ['log', 1],
  migrate: ['migrate', 0],
  new: ['new', 0],
  read: ['read', 0],
  release: ['release', 0],
  review: ['review', 0],
  scope: ['scope', 0],
  show: ['show', 0],
  status: ['status', 0],
  tui: ['tui', 0],
};

/* ------------------------------------------------------------- shape walking */

interface Node {
  field: ShapeField;
  children: Map<string, Node>;
}

/**
 * Rebuilds the tree from the flat dotted paths.
 *
 * A nested field appears as `tasks` followed by `tasks.id` and `tasks.title`,
 * in the order the document emits them. No key in any document contains a dot,
 * so splitting on one character is the whole of it.
 */
function tree(fields: readonly ShapeField[]): Map<string, Node> {
  const roots = new Map<string, Node>();

  for (const field of fields) {
    const segments = field.name.split('.');
    let level = roots;
    let node: Node | undefined;

    for (const segment of segments) {
      node = level.get(segment);
      if (!node) {
        node = { field, children: new Map() };
        level.set(segment, node);
      }
      level = node.children;
    }

    // The leaf carries the declared type; intermediate nodes were placeholders
    // created by a child that arrived before its parent, which the emitter's
    // ordering makes impossible but which costs nothing to tolerate.
    if (node) {
      node.field = field;
    }
  }

  return roots;
}

function typeOf(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  return Array.isArray(value) ? 'array' : typeof value;
}

const PRIMITIVE: Partial<Record<ShapeType, string>> = {
  string: 'string',
  number: 'number',
  boolean: 'boolean',
};

function validate(
  value: unknown,
  node: Node,
  where: string,
  problems: string[],
): void {
  const { field } = node;

  if (value === null) {
    if (!field.nullable) {
      problems.push(`${where} is null and the shape does not allow it`);
    }
    return;
  }

  const primitive = PRIMITIVE[field.type];
  if (primitive !== undefined) {
    if (typeof value !== primitive) {
      problems.push(`${where} is ${typeOf(value)}, declared ${field.type}`);
    }
    return;
  }

  if (field.type === 'string[]') {
    if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
      problems.push(`${where} is not an array of strings`);
    }
    return;
  }

  if (field.type === 'object') {
    if (typeOf(value) !== 'object') {
      problems.push(`${where} is ${typeOf(value)}, declared object`);
      return;
    }
    validateMembers(value as Record<string, unknown>, node, where, problems);
    return;
  }

  if (field.type === 'object[]') {
    if (!Array.isArray(value)) {
      problems.push(`${where} is ${typeOf(value)}, declared object[]`);
      return;
    }
    value.forEach((row, index) => {
      const at = `${where}[${String(index)}]`;
      if (typeOf(row) !== 'object') {
        problems.push(`${at} is ${typeOf(row)}, declared an object`);
        return;
      }
      validateMembers(row as Record<string, unknown>, node, at, problems);
    });
    return;
  }

  problems.push(`${where} declares an unknown type ${String(field.type)}`);
}

/** Every declared child must be present. An undeclared one is not an error. */
function validateMembers(
  value: Record<string, unknown>,
  node: Node,
  where: string,
  problems: string[],
): void {
  for (const [name, child] of node.children) {
    if (!(name in value)) {
      problems.push(`${where}.${name} is declared and absent`);
      continue;
    }
    validate(value[name], child, `${where}.${name}`, problems);
  }
}

function conform(document: unknown, shape: VerbShape): string[] {
  const problems: string[] = [];
  const roots = tree(shape.fields);

  if (typeOf(document) !== 'object') {
    return [`the document is ${typeOf(document)}`];
  }

  const record = document as Record<string, unknown>;
  for (const [name, node] of roots) {
    if (!(name in record)) {
      problems.push(`${name} is declared and absent`);
      continue;
    }
    validate(record[name], node, name, problems);
  }

  return problems;
}

/* -------------------------------------------------------------------- tests */

test('every fixture on disk is accounted for', () => {
  const onDisk = readdirSync(GOLDEN)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -'.json'.length))
    .sort();

  assert.deepEqual(onDisk, Object.keys(SOURCE).sort());
  assert.equal(onDisk.length, 28, 'upstream pins twenty-eight documents');
});

test('the verb table carries every verb the fixtures came from', () => {
  const named = new Set(Object.values(SOURCE).map(([verb]) => verb));
  for (const verb of named) {
    assert.ok(
      help.verbs.some((candidate) => candidate.name === verb),
      `${verb} is not in the verb table`,
    );
  }
});

for (const [name, [verb, index]] of Object.entries(SOURCE)) {
  test(`${name}.json conforms to the shape ${verb} declares`, () => {
    const declared = help.verbs.find((candidate) => candidate.name === verb);
    assert.ok(declared, `${verb} is not in the verb table`);

    const shape = declared.returns[index];
    assert.ok(shape, `${verb} declares no shape at index ${String(index)}`);

    const problems = conform(fixture(name), shape);
    assert.deepEqual(problems, [], problems.join('\n'));
  });
}

test('every document leads with the contract version', () => {
  for (const name of Object.keys(SOURCE)) {
    const document = fixture(name) as { contract?: unknown };
    assert.equal(
      document.contract,
      CONTRACT_VERSION,
      `${name}.json does not declare contract ${String(CONTRACT_VERSION)}`,
    );
  }
});

test('contract leads every declared shape, and is never nullable', () => {
  for (const verb of help.verbs) {
    for (const shape of verb.returns) {
      const first = shape.fields[0];
      assert.ok(first, `${verb.name} declares an empty shape`);
      assert.equal(first.name, 'contract', `${verb.name} does not lead with contract`);
      assert.equal(first.type, 'number');
      assert.equal(first.nullable, false);
    }
  }
});

test('the type vocabulary is the six words the shape system publishes', () => {
  const allowed = new Set<string>([
    'string',
    'number',
    'boolean',
    'string[]',
    'object',
    'object[]',
  ]);
  for (const verb of help.verbs) {
    for (const shape of verb.returns) {
      for (const field of shape.fields) {
        assert.ok(allowed.has(field.type), `${field.name} is typed ${field.type}`);
      }
    }
  }
});

test('no key in any document carries a dot, so the paths can be split', () => {
  // The flat form is only unambiguous because of this. A key with a dot in it
  // would make `tasks.id` mean two things.
  const walk = (value: unknown, where: string): void => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${where}[${String(index)}]`));
      return;
    }
    if (typeOf(value) !== 'object') {
      return;
    }
    for (const [key, member] of Object.entries(value as Record<string, unknown>)) {
      assert.ok(!key.includes('.'), `${where}.${key} carries a dot`);
      walk(member, `${where}.${key}`);
    }
  };

  for (const name of Object.keys(SOURCE)) {
    walk(fixture(name), name);
  }
});

test('mcp and watch declare no document, and every other verb does', () => {
  for (const verb of help.verbs) {
    const expected = verb.name === 'mcp' || verb.name === 'watch' ? 0 : 1;
    assert.ok(
      verb.returns.length >= expected,
      `${verb.name} declares no shape and is not mcp or watch`,
    );
    if (expected === 0) {
      assert.equal(verb.returns.length, 0, `${verb.name} should declare no shape`);
    }
  }
});
