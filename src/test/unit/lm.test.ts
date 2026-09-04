/**
 * The language model tools are read-only (ADR-5c7baf6259ca).
 *
 * The check is against the verb table rather than against a list written
 * twice: a tool named after a verb that claims, finishes or writes is what
 * this test exists to catch, and the table is what says which verbs those are.
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import { Capabilities, RENEWING_VERBS, WRITING_VERBS } from '../../ank';
import type { HelpDocument } from '../../ank';
import { OFFERED_VERBS, toolName } from '../../lm/offered';

const root = path.resolve(__dirname, '..', '..', '..');

interface Manifest {
  contributes?: {
    languageModelTools?: {
      name: string;
      modelDescription: string;
      toolReferenceName?: string;
      inputSchema?: { properties?: Record<string, unknown> };
    }[];
    mcpServerDefinitionProviders?: { id: string; label: string }[];
  };
}

const manifest = JSON.parse(
  readFileSync(path.join(root, 'package.json'), 'utf8'),
) as Manifest;

const help = JSON.parse(
  readFileSync(
    path.join(root, 'src', 'test', 'fixtures', 'golden-json', 'help.json'),
    'utf8',
  ),
) as HelpDocument;

const capabilities = Capabilities.of(help.verbs);
const tools = manifest.contributes?.languageModelTools ?? [];

test('no tool is named after a verb that writes', () => {
  // The whole of the decision. Claiming, finishing and logging are acts a
  // person should be making from a surface that shows what is about to happen,
  // not from a dialog that is easy to wave through.
  for (const verb of OFFERED_VERBS) {
    assert.equal(WRITING_VERBS.has(verb), false, `${verb} writes`);
  }
});

test('the contributed tools are exactly what the code registers', () => {
  assert.deepEqual(
    tools.map((tool) => tool.name).sort(),
    OFFERED_VERBS.map(toolName).sort(),
  );
});

test('every tool names a verb the table carries', () => {
  for (const verb of OFFERED_VERBS) {
    assert.ok(capabilities.has(verb), `${verb} is not a verb`);
  }
});

test('each description is the verb table own wording', () => {
  // Written once. A description maintained by hand is one that will disagree
  // with the tool the model is actually calling.
  for (const tool of tools) {
    const verb = tool.name.replace(/^ank_/, '');
    assert.equal(
      tool.modelDescription,
      capabilities.summary(verb),
      `${tool.name} does not carry the summary of ${verb}`,
    );
  }
});

test('every tool takes a corpus, because a window may hold several', () => {
  // Named by repository identity and never by a path, which is the same rule
  // the MCP surface enforces.
  for (const tool of tools) {
    const properties = tool.inputSchema?.properties ?? {};
    assert.ok('corpus' in properties, `${tool.name} cannot be addressed at a corpus`);
  }
});

test('the two tools that renew a lease are the ones an agent works with', () => {
  // `show` and `context` renew the task the caller holds. That is correct from
  // a model doing work, and it is why no view calls either.
  const renewing = OFFERED_VERBS.filter((verb) => RENEWING_VERBS.has(verb));
  assert.deepEqual(renewing.sort(), ['context', 'show']);
});

test('nothing under src registers a tool for a writing verb', () => {
  const sources = collect(path.join(root, 'src'))
    .filter(({ file }) => !file.startsWith('src/test/'))
    .map(({ text }) => text)
    .join('\n');

  for (const verb of WRITING_VERBS) {
    assert.equal(
      sources.includes(`'${toolName(verb)}'`) || sources.includes(`"${toolName(verb)}"`),
      false,
      `${toolName(verb)} is named somewhere in the source`,
    );
  }
});

test('the mcp provider is contributed under the id the code registers', () => {
  const declared = manifest.contributes?.mcpServerDefinitionProviders ?? [];
  assert.deepEqual(
    declared.map((provider) => provider.id),
    ['ank'],
  );
});

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
    if (full.endsWith('.ts')) {
      found.push({
        file: path.relative(root, full).split(path.sep).join('/'),
        text: readFileSync(full, 'utf8'),
      });
    }
  }
  return found;
}
