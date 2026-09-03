/**
 * Every corpus this window can see, each on its own.
 *
 * A window may hold several. What it may not do is treat them as one: rank a
 * task from one against a task from another, count what is ready across them,
 * or resolve an id without knowing which corpus it came from. Multiplexing and
 * merging are different things, and telling them apart is the whole of
 * ADR-3be7c0dd26d4.
 *
 * So nothing here returns a merged list. Callers ask for the corpora and
 * present them side by side, and every entity a view holds is a pair -- corpus
 * and id -- rather than an id alone.
 */

import * as vscode from 'vscode';

import type { AnkCli } from '../ank';
import type { Log } from '../log';
import { Corpus } from './corpus';

/** A workspace folder is a corpus when it carries a config the CLI wrote. */
const MARKER = '.ank/config.yml';

export class CorpusRegistry implements vscode.Disposable {
  private readonly open = new Map<string, Corpus>();
  private readonly disposables: vscode.Disposable[] = [];
  private readonly changed = new vscode.EventEmitter<void>();

  /** Fires when a corpus is added or removed, or when any of them repaints. */
  readonly onDidChange = this.changed.event;

  constructor(
    private readonly cli: AnkCli,
    private readonly log: Log,
  ) {
    this.disposables.push(this.changed);
    this.disposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders((event) => {
        void this.adopt(event.added);
        this.retire(event.removed);
      }),
    );
  }

  /** The corpora, in the order their folders sit in the workspace. */
  get corpora(): readonly Corpus[] {
    return [...this.open.values()];
  }

  get empty(): boolean {
    return this.open.size === 0;
  }

  /** The corpus a file belongs to, or undefined where it belongs to none. */
  forUri(uri: vscode.Uri): Corpus | undefined {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    return folder ? this.open.get(key(folder)) : undefined;
  }

  /**
   * The corpus a command should act on.
   *
   * With one open there is no question. With several, the active editor
   * decides, and failing that the caller has to ask -- picking the first would
   * be the window quietly speaking for a corpus nobody meant.
   */
  active(): Corpus | undefined {
    if (this.open.size === 1) {
      return this.corpora[0];
    }
    const editor = vscode.window.activeTextEditor;
    return editor ? this.forUri(editor.document.uri) : undefined;
  }

  async start(): Promise<void> {
    await this.adopt(vscode.workspace.workspaceFolders ?? []);
  }

  dispose(): void {
    for (const corpus of this.open.values()) {
      corpus.dispose();
    }
    this.open.clear();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  private async adopt(folders: readonly vscode.WorkspaceFolder[]): Promise<void> {
    const opened: Corpus[] = [];

    for (const folder of folders) {
      if (this.open.has(key(folder))) {
        continue;
      }
      if (!(await carriesCorpus(folder))) {
        continue;
      }

      const corpus = new Corpus(folder, this.cli, this.log);
      this.open.set(key(folder), corpus);
      this.disposables.push(corpus.onDidChange(() => this.changed.fire()));
      opened.push(corpus);
    }

    // Opened together rather than in turn: several corpora are several
    // repositories, and one being slow to answer should not hold up the rest.
    await Promise.all(opened.map((corpus) => corpus.open()));

    if (opened.length > 0) {
      this.changed.fire();
    }
  }

  private retire(folders: readonly vscode.WorkspaceFolder[]): void {
    let removed = false;
    for (const folder of folders) {
      const corpus = this.open.get(key(folder));
      if (corpus) {
        corpus.dispose();
        this.open.delete(key(folder));
        removed = true;
      }
    }
    if (removed) {
      this.changed.fire();
    }
  }
}

function key(folder: vscode.WorkspaceFolder): string {
  return folder.uri.toString();
}

/**
 * Whether a folder carries a corpus.
 *
 * Asking the CLI instead would be tempting and would be wrong. `ank status` in
 * a folder with no corpus exits 1, and so does a folder whose corpus the
 * binary cannot read -- a config at a schema it does not support, say. Both
 * are exit 1 because 1 is the generic code, and treating that as "no corpus
 * here" would report a broken corpus as an absent one and show the user
 * nothing at all.
 *
 * So presence is decided on the marker and content is decided by the CLI. This
 * asks the workspace filesystem whether one path exists; it opens nothing,
 * reads nothing and parses nothing, and it is the same file the activation
 * event names.
 */
async function carriesCorpus(folder: vscode.WorkspaceFolder): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(vscode.Uri.joinPath(folder.uri, MARKER));
    return true;
  } catch {
    return false;
  }
}
