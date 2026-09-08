/**
 * Looking around.
 *
 * `find`, `scope`, `graph` and `tui`. None of them writes and none renews a
 * lease, which is why the binds view can call `scope` on navigation; they are
 * commands here because a person may want to ask directly.
 */

import * as vscode from 'vscode';

import { ICON, roleOfStatus } from '../ui/meaning';
import type { CommandContext, Register } from './index';
import { pickCorpus } from './pick';
import { ask, attempt } from './run';

export function registerLook(register: Register, shared: CommandContext): void {
  const { registry, log } = shared;

  register('ank.find', 'find', async () => {
    const corpus = await pickCorpus(registry);
    if (!corpus) {
      return;
    }

    const query = await ask({
      title: `Find in ${corpus.name}`,
      prompt: 'Searches titles, scopes and criteria.',
      required: false,
    });
    if (query === undefined) {
      return;
    }

    const found = await attempt({
      what: `find ${query}`,
      corpus,
      log,
      run: () => corpus.ank.find(query),
    });
    if (!found) {
      return;
    }

    if (found.results.length === 0) {
      void vscode.window.showInformationMessage(`Nothing matches ${query}.`);
      return;
    }

    const chosen = await vscode.window.showQuickPick(
      found.results.map((row) => ({
        label: `$(${ICON[roleOfStatus(row.state) ?? 'identifier']}) ${row.title}`,
        description: `${row.id} · ${row.kind}`,
        detail: row.state,
        row,
      })),
      {
        title: `${String(found.shown)} of ${String(found.total)}`,
        matchOnDescription: true,
      },
    );

    if (chosen) {
      await shared.preview(corpus, chosen.row.id);
    }
  });

  register('ank.scope', 'scope', async (given: unknown) => {
    const uri = given instanceof vscode.Uri ? given : vscode.window.activeTextEditor?.document.uri;
    if (!uri) {
      void vscode.window.showInformationMessage('Open a file first.');
      return;
    }

    const corpus = registry.forUri(uri);
    if (!corpus) {
      void vscode.window.showInformationMessage(
        'That file is not in a folder carrying a corpus.',
      );
      return;
    }

    const relative = vscode.workspace.asRelativePath(uri, false);
    const covered = await attempt({
      what: `read the scope of ${relative}`,
      corpus,
      log,
      run: () => corpus.ank.scope(relative),
    });
    if (!covered) {
      return;
    }

    if (covered.total === 0) {
      void vscode.window.showInformationMessage(`Nothing in the corpus covers ${relative}.`);
      return;
    }

    const rows = [
      ...section('Constraints', covered.adr),
      ...section('Specifications', covered.specs),
      ...section('Tasks', covered.tasks),
    ];

    const chosen = await vscode.window.showQuickPick(rows, {
      title: `What covers ${relative}`,
      placeHolder: `${String(covered.total)} entit(ies)`,
    });

    if (chosen?.id !== undefined) {
      await shared.preview(corpus, chosen.id);
    }
  });

  register('ank.graph', 'graph', async () => {
    const corpus = await pickCorpus(registry);
    if (!corpus) {
      return;
    }

    // The tree renders the same DAG. This one is the CLI's own rendering,
    // indented under what blocks it, for a reader who wants the shape whole.
    const drawn = await attempt({
      what: 'draw the graph',
      corpus,
      log,
      run: () => corpus.ank.plain(['graph']),
    });
    if (drawn === undefined) {
      return;
    }

    const document = await vscode.workspace.openTextDocument({
      content: drawn,
      language: 'plaintext',
    });
    await vscode.window.showTextDocument(document, { preview: true });
  });

  /**
   * Opens the full-screen reader in a terminal.
   *
   * `ank tui` is the same corpus for a human at a terminal, and it reaches
   * every byte it shows by running the CLI with `--json`. Handing it a
   * terminal is the whole integration: there is nothing to reimplement.
   */
  register('ank.tui', 'tui', async () => {
    const corpus = await pickCorpus(registry);
    if (!corpus) {
      return;
    }

    const terminal = vscode.window.createTerminal({
      name: `ank tui · ${corpus.name}`,
      cwd: corpus.folder.uri,
    });
    terminal.show();
    terminal.sendText('ank tui', true);
    await Promise.resolve();
  });
}

interface Row extends vscode.QuickPickItem {
  id?: string;
}

function section(
  heading: string,
  found: readonly { id: string; status: string; title: string }[],
): Row[] {
  if (found.length === 0) {
    return [];
  }
  return [
    { label: heading, kind: vscode.QuickPickItemKind.Separator },
    ...found.map((row) => ({
      label: `$(${ICON[roleOfStatus(row.status) ?? 'identifier']}) ${row.title}`,
      description: row.id,
      detail: row.status,
      id: row.id,
    })),
  ];
}
