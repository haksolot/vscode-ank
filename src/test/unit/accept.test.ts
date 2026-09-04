/**
 * accept is handed to a terminal, never spawned (ADR-ea0325308b32).
 *
 * `accept` promotes a proposed decision through a signed ratification commit,
 * on the default branch, with no way around it. It is the one hard authority
 * line in a tool that otherwise refuses on state and never on who is asking.
 *
 * An extension that ran it from a button would be signing on the user's behalf
 * from a click that looked like every other click in the tree. So the command
 * composes the line into a terminal and leaves it unsent -- the same move
 * `ank tui` makes for every write it offers.
 *
 * The adapter still carries an `accept` method, because the verb table is
 * complete and a caller may want to read what it would refuse. What is
 * asserted here is that no command calls it.
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const root = path.resolve(__dirname, '..', '..', '..');

interface Source {
  file: string;
  text: string;
}

function collect(dir: string, found: Source[] = []): Source[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      collect(full, found);
      continue;
    }
    if (!full.endsWith('.ts')) {
      continue;
    }
    const file = path.relative(root, full).split(path.sep).join('/');
    if (file.startsWith('src/test/')) {
      continue;
    }
    found.push({ file, text: readFileSync(full, 'utf8') });
  }
  return found;
}

const sources = collect(path.join(root, 'src'));

test('nothing calls the adapter method', () => {
  // The method exists so the verb table is complete and a caller can read what
  // `accept` would refuse. Nothing invokes it.
  const callers = sources
    .filter(({ text }) => /\.accept\s*\(/.test(text))
    .map(({ file }) => file);

  assert.deepEqual(callers, [], 'something calls ank.accept');
});

test('the only argv naming accept outside the adapter is composed, not run', () => {
  // The adapter builds `['accept', id]` inside its own method, which nothing
  // calls. The command layer builds the same vector and hands it to `compose`,
  // which writes it into a terminal. Any third site would be a second route to
  // the same act.
  const offenders: string[] = [];

  for (const { file, text } of sources) {
    if (file === 'src/ank/verbs.ts') {
      continue;
    }
    for (const line of text.split(/\r?\n/)) {
      if (!/\[\s*'accept'/.test(line)) {
        continue;
      }
      if (!line.includes('compose(')) {
        offenders.push(`${file}: ${line.trim()}`);
      }
    }
  }

  assert.deepEqual(offenders, []);
});

test('the command that offers accept composes a line and sends nothing', () => {
  const shape = sources.find(({ file }) => file === 'src/commands/shape.ts');
  assert.ok(shape, 'the shaping commands are where accept is offered');

  // It reaches `compose`, which writes the line into a terminal.
  assert.match(shape.text, /compose\(ref\.corpus, \['accept', ref\.id\]\)/);
  assert.equal(/corpus\.ank\.accept/.test(shape.text), false);
});

test('compose writes the line without sending it', () => {
  const index = sources.find(({ file }) => file === 'src/commands/index.ts');
  assert.ok(index);

  // `sendText(line, false)` writes and does not press return. The `false` is
  // the whole of the decision, so it is asserted on its own: every `sendText`
  // reachable from `compose` must carry it.
  const composed = index.text
    .split(/\r?\n/)
    .filter((line) => line.includes('sendText('));

  assert.equal(composed.length, 1);
  assert.match(composed[0] ?? '', /,\s*false\)/);
});

test('the detail panel never offers accept as a button', () => {
  const html = sources.find(({ file }) => file === 'src/providers/entityHtml.ts');
  assert.ok(html);

  // The panel filters buttons against what was registered, so an accept
  // command existing must not be enough to put a button beside Claim.
  assert.equal(html.text.includes("'ank.accept'"), false);
});
