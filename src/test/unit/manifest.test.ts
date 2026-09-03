import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const root = path.resolve(__dirname, '..', '..', '..');

interface Manifest {
  engines: { vscode: string };
  main: string;
  activationEvents: string[];
  contributes?: { commands?: { command: string; title: string }[] };
}

const manifest = JSON.parse(
  readFileSync(path.join(root, 'package.json'), 'utf8'),
) as Manifest;

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...sourceFiles(full));
    } else if (full.endsWith('.ts')) {
      found.push(full);
    }
  }
  return found;
}

const sources = sourceFiles(path.join(root, 'src'))
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');

test('the manifest declares the engine the extension is written against', () => {
  assert.equal(manifest.engines.vscode, '^1.104.0');
});

test('the extension activates on a workspace carrying a corpus', () => {
  assert.ok(
    manifest.activationEvents.includes('workspaceContains:.ank/config.yml'),
    'a window with no corpus must not pay for this extension',
  );
});

test('every contributed command has an implementation', () => {
  // The manifest is a promise to the command palette. A contributed id with no
  // `registerCommand` behind it is an entry that fails when it is clicked.
  for (const { command } of manifest.contributes?.commands ?? []) {
    assert.ok(
      sources.includes(`'${command}'`) || sources.includes(`"${command}"`),
      `${command} is contributed but never registered`,
    );
  }
});

test('every contributed command is namespaced and titled', () => {
  for (const { command, title } of manifest.contributes?.commands ?? []) {
    assert.ok(command.startsWith('ank.'), `${command} is not under the ank. prefix`);
    assert.ok(title.length > 0, `${command} has no title`);
  }
});
