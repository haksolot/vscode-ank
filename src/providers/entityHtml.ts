/**
 * The detail panel's markup, built without an editor.
 *
 * Kept apart from the panel so the things that matter about it can be asserted
 * by `node --test`: that every value coming out of the corpus is escaped, that
 * the content security policy is present and carries the nonce the one script
 * uses, that no colour is a literal, and that a button is only offered for a
 * command something actually registered.
 */

import { isTaskDocument, type Edge, type LogEntry, type ShowDocument } from '../ank';

export interface RenderOptions {
  /** What the webview will accept a stylesheet from. */
  cspSource: string;
  /** The commands this build registered. */
  offered: ReadonlySet<string>;
  /** Injected so a test can pin the markup. */
  nonce: string;
}

export function renderEntity(document: ShowDocument, options: RenderOptions): string {
  const policy = [
    "default-src 'none'",
    `style-src ${options.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${options.nonce}'`,
  ].join('; ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${policy}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${STYLE}</style>
</head>
<body>
${body(document, options.offered)}
<script nonce="${options.nonce}">
const vscode = acquireVsCodeApi();
for (const button of document.querySelectorAll('button[data-command]')) {
  button.addEventListener('click', () => {
    vscode.postMessage({ command: button.dataset.command, id: button.dataset.id });
  });
}
</script>
</body>
</html>`;
}

function body(document: ShowDocument, offered: ReadonlySet<string>): string {
  const parts: string[] = [];

  parts.push(`<h1>${escape(titleOf(document))}</h1>`);
  parts.push(`<p class="id">${escape(document.id)}</p>`);

  // Coordination comes from a git ref and is the single most important thing
  // the file cannot tell you.
  parts.push(
    document.coordination === null
      ? '<p class="free">Not held by anybody.</p>'
      : `<p class="held">${escape(document.coordination)}</p>`,
  );

  parts.push(actions(document, offered));

  if (isTaskDocument(document)) {
    parts.push(edges('Waits on', document.blocked_by));
    parts.push(edges('Unblocks', document.unblocks));
  }

  if (document.detached_proofs.length > 0) {
    const rows = document.detached_proofs
      .map(
        (proof) =>
          `<li><code>${escape(proof.type)}</code> ${escape(proof.ref)} ` +
          `<span class="meta">by ${escape(proof.by)} at ${escape(proof.at)}</span></li>`,
      )
      .join('');
    parts.push(`<h2>Proofs attested outside a commit</h2><ul class="proofs">${rows}</ul>`);
  }

  parts.push(
    entries(
      `Log (${String(document.log_total)})`,
      document.log,
      'What the holders wrote. This is the work trace, and it is what the context budget is spent on.',
    ),
  );

  if (document.machinery.length > 0) {
    parts.push(
      entries(
        `Machinery (${String(document.machinery.length)})`,
        document.machinery,
        'What the verbs wrote. Kept apart so a task edited eight times does not answer "what did the last holder learn" with eight mechanical lines.',
      ),
    );
  }

  return parts.filter((part) => part !== '').join('\n');
}

/**
 * The buttons.
 *
 * `accept` is deliberately absent (ADR-ea0325308b32). It signs a ratification
 * commit, and signing on somebody's behalf from a click that looks like every
 * other click is not something this panel will do.
 */
function actions(document: ShowDocument, offered: ReadonlySet<string>): string {
  const held = document.coordination !== null;
  const wanted: [command: string, label: string][] = [];

  if (isTaskDocument(document)) {
    if (held) {
      wanted.push(['ank.log', 'Log…'], ['ank.done', 'Done'], ['ank.release', 'Release…']);
    } else {
      wanted.push(['ank.claim', 'Claim']);
    }
  }
  wanted.push(['ank.openFile', 'Open the file']);

  const buttons = wanted
    .filter(([command]) => offered.has(command))
    .map(
      ([command, label]) =>
        `<button data-command="${escape(command)}" data-id="${escape(document.id)}">${escape(label)}</button>`,
    );

  return buttons.length === 0 ? '' : `<div class="actions">${buttons.join('')}</div>`;
}

function edges(heading: string, found: readonly Edge[]): string {
  if (found.length === 0) {
    return '';
  }
  const rows = found
    .map(
      (edge) =>
        `<li><code>${escape(edge.short)}</code> ${escape(edge.title ?? '(unknown)')}` +
        `${edge.status === null ? '' : ` <span class="meta">${escape(edge.status)}</span>`}</li>`,
    )
    .join('');
  return `<h2>${escape(heading)}</h2><ul class="edges">${rows}</ul>`;
}

function entries(heading: string, found: readonly LogEntry[], note: string): string {
  if (found.length === 0) {
    return `<h2>${escape(heading)}</h2><p class="empty">Nothing recorded.</p>`;
  }

  const rows = found
    .map(
      (entry) =>
        `<li><div class="meta">${escape(entry.who)} · ${escape(entry.timestamp)}` +
        `${entry.records === null ? '' : ` · records ${escape(entry.records)}`}</div>` +
        `<div>${escape(entry.message)}</div></li>`,
    )
    .join('');

  return `<h2>${escape(heading)}</h2><p class="note">${escape(note)}</p><ul class="log">${rows}</ul>`;
}

/**
 * The title, read off the frontmatter of the content.
 *
 * `show` already returned the whole file, so asking for the title separately
 * would be a second call for something in hand.
 */
export function titleOf(document: ShowDocument): string {
  const match = /^title:\s*(.+)$/m.exec(document.content);
  const raw = match?.[1]?.trim() ?? document.id;
  return raw.replace(/^["']|["']$/g, '');
}

/** Every value out of the corpus goes through this before it reaches markup. */
export function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Every colour is a theme variable.
 *
 * The panel follows whatever the reader is running rather than asserting a
 * palette over it, which is the same reason the trees take their colours from
 * the role table instead of from hex values.
 */
export const STYLE = `
body {
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  color: var(--vscode-foreground);
  background: var(--vscode-editor-background);
  padding: 0 1rem 2rem;
  line-height: 1.5;
}
h1 { font-size: 1.3rem; margin: 1rem 0 0.2rem; font-weight: 600; }
h2 {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vscode-descriptionForeground);
  margin: 1.6rem 0 0.4rem;
  border-bottom: 1px solid var(--vscode-panel-border);
  padding-bottom: 0.2rem;
}
p.id { font-family: var(--vscode-editor-font-family); color: var(--vscode-descriptionForeground); margin: 0 0 0.6rem; }
p.held { color: var(--vscode-charts-yellow); margin: 0 0 0.8rem; }
p.free { color: var(--vscode-descriptionForeground); margin: 0 0 0.8rem; }
p.note, p.empty { color: var(--vscode-descriptionForeground); font-size: 0.9em; margin: 0.2rem 0 0.6rem; }
.actions { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0 0 0.6rem; }
button {
  font-family: inherit;
  font-size: 0.9em;
  color: var(--vscode-button-foreground);
  background: var(--vscode-button-background);
  border: none;
  padding: 0.3rem 0.8rem;
  border-radius: 2px;
  cursor: pointer;
}
button:hover { background: var(--vscode-button-hoverBackground); }
ul { list-style: none; padding: 0; margin: 0; }
ul.edges li, ul.proofs li { padding: 0.15rem 0; }
ul.log li {
  padding: 0.4rem 0 0.4rem 0.7rem;
  border-left: 2px solid var(--vscode-panel-border);
  margin-bottom: 0.3rem;
  white-space: pre-wrap;
}
.meta { color: var(--vscode-descriptionForeground); font-size: 0.85em; }
code {
  font-family: var(--vscode-editor-font-family);
  background: var(--vscode-textCodeBlock-background);
  padding: 0.05rem 0.3rem;
  border-radius: 2px;
}
`;
