/**
 * The corpus is reached only by running the binary (ADR-332fddfe7db9).
 *
 * This is the assertion that gives that decision teeth. It is a source scan
 * rather than a behavioural test, and deliberately so: the failure it guards
 * against is silent. A reader that walks `.ank/` reports a held task as free
 * -- no error, no warning, and no way for a user to tell -- because a task's
 * state is the file plus `refs/ank/claims/<id>` plus `refs/ank/proof/<id>`
 * plus the log entities whose `about` names it. There is no runtime symptom to
 * write a test around, so the test is on the code.
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const root = path.resolve(__dirname, '..', '..', '..');
const src = path.join(root, 'src');

interface Source {
  /** Relative to the repository root, with forward slashes. */
  file: string;
  lines: string[];
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
    // The tests themselves are exempt: an integration test builds a throwaway
    // corpus and has to be able to look at what it built.
    if (file.startsWith('src/test/')) {
      continue;
    }
    found.push({ file, lines: readFileSync(full, 'utf8').split(/\r?\n/) });
  }
  return found;
}

const sources = collect(src);

/** A line that is only a comment cannot open a file. */
function isProse(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    trimmed.startsWith('/*') ||
    trimmed.startsWith('*/')
  );
}

const FILESYSTEM = new RegExp(
  [
    'readFile',
    'readdir',
    'createReadStream',
    'writeFile',
    'appendFile',
    'createWriteStream',
    'openSync',
    'statSync',
    'existsSync',
    'rmSync',
    'unlink',
    'mkdir',
    'copyFile',
    'realpath',
  ].join('|'),
);

test('nothing under src reads or writes a path inside .ank', () => {
  const offences: string[] = [];

  for (const { file, lines } of sources) {
    lines.forEach((line, index) => {
      if (isProse(line) || !line.includes('.ank')) {
        return;
      }
      if (FILESYSTEM.test(line)) {
        offences.push(`${file}:${String(index + 1)}: ${line.trim()}`);
      }
    });
  }

  assert.deepEqual(offences, [], offences.join('\n'));
});

test('nothing under src names the entities directory or the derived index', () => {
  // `.ank/entities` and `index.db` have no legitimate use in this extension.
  // The index in particular is disposable and is never the source of truth,
  // so a client that read it would be believing a cache over the files.
  const forbidden = ['.ank/entities', '.ank\\\\entities', 'index.db', 'packed-refs'];
  const offences: string[] = [];

  for (const { file, lines } of sources) {
    lines.forEach((line, index) => {
      if (isProse(line)) {
        return;
      }
      for (const needle of forbidden) {
        if (line.includes(needle)) {
          offences.push(`${file}:${String(index + 1)} names ${needle}`);
        }
      }
    });
  }

  assert.deepEqual(offences, [], offences.join('\n'));
});

test('exactly one file starts a process', () => {
  // Everything reaches the corpus through the same spawn, which is what makes
  // `--repo` and `--json` impossible for a caller to forget.
  const spawners = sources
    .filter(({ lines }) =>
      lines.some((line) => !isProse(line) && line.includes('node:child_process')),
    )
    .map(({ file }) => file);

  assert.deepEqual(spawners, ['src/ank/cli.ts']);
});

test('the adapter does not import vscode', () => {
  // Keeping the editor out of `src/ank` is what lets the whole contract layer
  // be tested by `node --test`, with no host to launch.
  const leaks = sources
    .filter(({ file }) => file.startsWith('src/ank/'))
    .filter(({ lines }) =>
      lines.some((line) => /from '(vscode)'/.test(line) && !isProse(line)),
    )
    .map(({ file }) => file);

  assert.deepEqual(leaks, []);
});
