/**
 * What the entity file does not carry.
 *
 * The virtual document serves the file byte for byte. Everything here comes
 * from somewhere else: `coordination` from `refs/ank/claims/<id>`,
 * `detached_proofs` from `refs/ank/proof/<id>`, the log and the machinery from
 * separate `LOG-*` entities split on `records`, and the edges from the graph.
 * Read the file alone and you see `in_progress` and not one word about who is
 * holding it, when the lease expires, or what they have learned.
 *
 * So this panel is not a prettier rendering of the document beside it. It is
 * the three sources the document is missing.
 */

import * as vscode from 'vscode';

import type { ShowDocument } from '../ank';
import type { Corpus } from '../corpus/corpus';
import { renderEntity } from './entityHtml';

export class EntityPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private showing: { corpus: Corpus; id: string } | undefined;

  /**
   * @param offered The commands this build actually registered.
   *
   * A button for a command nothing implements is a button that fails when it
   * is clicked, which is the same promise the manifest test refuses to let the
   * command palette make. Milestones land one at a time, so the panel is told
   * what exists rather than assuming.
   */
  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly offered: ReadonlySet<string>,
  ) {}

  /** Opens or reuses the panel, beside the document rather than over it. */
  reveal(corpus: Corpus, id: string, document: ShowDocument): void {
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        'ank.entity',
        'ank',
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
        {
          enableScripts: true,
          localResourceRoots: [this.extensionUri],
          retainContextWhenHidden: false,
        },
      );
      this.panel.onDidDispose(() => {
        this.panel = undefined;
        this.showing = undefined;
      });
      this.panel.webview.onDidReceiveMessage((message: unknown) => {
        void this.dispatch(message);
      });
    }

    this.showing = { corpus, id };
    this.panel.title = id;
    this.panel.webview.html = renderEntity(document, {
      cspSource: this.panel.webview.cspSource,
      offered: this.offered,
      nonce: makeNonce(),
    });
  }

  get current(): { corpus: Corpus; id: string } | undefined {
    return this.showing;
  }

  dispose(): void {
    this.panel?.dispose();
  }

  /**
   * A button in the panel runs a command, and the command does the work.
   *
   * Nothing here talks to the CLI. The panel offers the same commands the
   * palette and the tree offer, so a refusal is worded once and a confirmation
   * is asked once, wherever the act was started from.
   */
  private async dispatch(message: unknown): Promise<void> {
    if (typeof message !== 'object' || message === null) {
      return;
    }
    const { command, id } = message as { command?: unknown; id?: unknown };
    if (typeof command !== 'string' || !this.offered.has(command)) {
      return;
    }

    const showing = this.showing;
    if (!showing) {
      return;
    }

    await vscode.commands.executeCommand(command, {
      corpus: showing.corpus,
      id: typeof id === 'string' ? id : showing.id,
      kind: 'task',
      title: showing.id,
    });
  }
}

function makeNonce(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let index = 0; index < 32; index += 1) {
    nonce += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return nonce;
}
