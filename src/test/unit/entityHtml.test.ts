/**
 * The detail panel's markup.
 *
 * The panel renders strings that came out of a repository other people write
 * to. An entity title is arbitrary text, and so is a log message. Everything
 * asserted here is about that: what is escaped, what the policy allows, and
 * what a button is allowed to promise.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

import type { ShowTaskDocument } from '../../ank';
import { escape, renderEntity, STYLE, titleOf } from '../../providers/entityHtml';

const shown = JSON.parse(
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
      'show.json',
    ),
    'utf8',
  ),
) as ShowTaskDocument;

const ALL = new Set([
  'ank.claim',
  'ank.log',
  'ank.done',
  'ank.release',
  'ank.openFile',
]);

function render(
  document: ShowTaskDocument = shown,
  offered: ReadonlySet<string> = ALL,
): string {
  return renderEntity(document, { cspSource: 'vscode-webview://x', offered, nonce: 'N0NCE' });
}

test('the policy denies everything by default and names the nonce', () => {
  const html = render();

  assert.match(html, /default-src 'none'/);
  assert.match(html, /script-src 'nonce-N0NCE'/);
  assert.match(html, /<script nonce="N0NCE">/);
});

test('the only script is the one the nonce covers', () => {
  const html = render();
  const scripts = html.match(/<script/g) ?? [];

  assert.equal(scripts.length, 1);
});

test('every colour is a theme variable, and none is a literal', () => {
  // A hex value would assert a palette over whatever the reader is running.
  assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(STYLE), false);
  assert.equal(/\brgb\(/.test(STYLE), false);
  assert.ok(STYLE.includes('var(--vscode-'));
});

test('a title carrying markup is escaped rather than rendered', () => {
  const hostile: ShowTaskDocument = {
    ...shown,
    content: 'title: <img src=x onerror="alert(1)">\n',
  };

  const html = render(hostile);
  assert.equal(html.includes('<img src=x'), false);
  assert.match(html, /&lt;img src=x/);
});

test('a log message carrying markup is escaped', () => {
  const hostile: ShowTaskDocument = {
    ...shown,
    log: [
      {
        id: 'LOG-1',
        timestamp: '2026-01-01T00:00:00Z',
        who: '</div><script>alert(1)</script>',
        message: 'a message with <b>tags</b> & an ampersand',
        records: null,
      },
    ],
    log_total: 1,
    log_shown: 1,
  };

  const html = render(hostile);
  assert.equal(html.includes('<script>alert(1)</script>'), false);
  assert.match(html, /&lt;b&gt;tags&lt;\/b&gt; &amp; an ampersand/);
});

test('coordination is shown, because the file cannot say it', () => {
  const held: ShowTaskDocument = { ...shown, coordination: 'claimed by tool/1.0' };

  assert.match(render(held), /claimed by tool\/1\.0/);
  assert.match(render({ ...shown, coordination: null }), /Not held by anybody/);
});

test('the edges, the proofs, the log and the machinery all appear', () => {
  const html = render();

  assert.match(html, /Waits on/);
  assert.match(html, /Unblocks/);
  assert.match(html, /Proofs attested outside a commit/);
  assert.match(html, /Log \(1\)/);
  assert.match(html, /Machinery \(1\)/);

  // The split is on `records`, and the two are never merged: the work trace is
  // what the budget is spent on, the machinery is listed under it.
  assert.ok(html.indexOf('Log (1)') < html.indexOf('Machinery (1)'));
});

test('a document with no machinery shows no machinery section', () => {
  const html = render({ ...shown, machinery: [] });
  assert.equal(html.includes('Machinery'), false);
});

test('an entity with no edges shows neither edge section', () => {
  const html = render({ ...shown, blocked_by: [], unblocks: [] });

  assert.equal(html.includes('Waits on'), false);
  assert.equal(html.includes('Unblocks'), false);
});

test('a held task offers log, done and release, and not claim', () => {
  const html = render({ ...shown, coordination: 'claimed by me' });

  assert.match(html, /data-command="ank\.log"/);
  assert.match(html, /data-command="ank\.done"/);
  assert.match(html, /data-command="ank\.release"/);
  assert.equal(html.includes('data-command="ank.claim"'), false);
});

test('a free task offers claim, and not done', () => {
  const html = render({ ...shown, coordination: null });

  assert.match(html, /data-command="ank\.claim"/);
  assert.equal(html.includes('data-command="ank.done"'), false);
});

test('no button is offered for a command nothing registered', () => {
  // A button for a command that does not exist is a button that fails when it
  // is clicked.
  const html = render(shown, new Set(['ank.openFile']));

  assert.equal(html.includes('data-command="ank.claim"'), false);
  assert.match(html, /data-command="ank\.openFile"/);
});

test('accept is never a button, whatever is registered', () => {
  // It signs a ratification commit. Signing on somebody's behalf from a click
  // that looks like every other click is not something this panel will do.
  const html = render(shown, new Set([...ALL, 'ank.accept']));

  assert.equal(html.includes('ank.accept'), false);
});

test('the title is read off the frontmatter the document already carried', () => {
  assert.equal(titleOf(shown), 'Example task');
  assert.equal(titleOf({ ...shown, content: 'no frontmatter here' }), shown.id);
  assert.equal(titleOf({ ...shown, content: 'title: "quoted"\n' }), 'quoted');
});

test('escaping covers the five characters that matter', () => {
  assert.equal(escape(`<>&"'`), '&lt;&gt;&amp;&quot;&#39;');
  // Ampersands are replaced first, so an escape is never escaped twice.
  assert.equal(escape('&lt;'), '&amp;lt;');
});
