/**
 * What binds the file in front of you.
 *
 * `ank scope <path>` answers three questions about one path: which constraints
 * bind it, which specifications govern it, and which tasks touch it. This is
 * the view that makes the corpus useful while writing code rather than while
 * planning it -- the reason ank attaches decisions to globs instead of to
 * labels is so that this question has a mechanical answer.
 *
 * It runs on the user's own navigation, and `scope` renews no lease and writes
 * nothing, so it sits inside ADR-eddf502cd27b rather than around it. The call
 * is still debounced: moving through a file tree with the keyboard would
 * otherwise start a process per keystroke.
 */

import * as vscode from 'vscode';

import { AnkError, type ScopeDocument, type ScopeRow } from '../ank';
import type { Corpus } from '../corpus/corpus';
import type { CorpusRegistry } from '../corpus/registry';
import type { Log } from '../log';
import { iconOf, roleOfStatus } from './meaning';
import {
  childrenOf,
  EntityNode,
  GroupNode,
  markdown,
  MessageNode,
  shortId,
} from './tree';

const DEBOUNCE_MS = 200;

interface Answered {
  corpus: Corpus;
  path: string;
  document: ScopeDocument;
}

export class BindsView
  implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.Disposable
{
  private readonly changed = new vscode.EventEmitter<void>();
  private readonly disposables: vscode.Disposable[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;

  private answered: Answered | undefined;
  private message = 'Open a file to see what binds it';
  private pending = false;

  readonly onDidChangeTreeData = this.changed.event;

  constructor(
    private readonly registry: CorpusRegistry,
    private readonly log: Log,
  ) {
    this.disposables.push(
      this.changed,
      vscode.window.onDidChangeActiveTextEditor(() => this.schedule()),
      registry.onDidChange(() => this.schedule()),
    );
    this.schedule();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
    if (element) {
      return childrenOf(element);
    }
    if (this.pending && !this.answered) {
      return [new MessageNode('Reading…', 'loading~spin')];
    }
    if (!this.answered) {
      return [new MessageNode(this.message, 'info')];
    }
    return sections(this.answered);
  }

  dispose(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
    }
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  private schedule(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.ask();
    }, DEBOUNCE_MS);
  }

  private async ask(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.scheme !== 'file') {
      // A virtual document, an output channel or nothing at all. The last
      // answer is cleared rather than left standing over a different file.
      this.settle(undefined, 'Open a file to see what binds it');
      return;
    }

    const corpus = this.registry.forUri(editor.document.uri);
    if (!corpus) {
      this.settle(undefined, 'This file is not in a folder carrying a corpus');
      return;
    }

    const relative = vscode.workspace.asRelativePath(editor.document.uri, false);
    this.pending = true;
    this.changed.fire();

    try {
      const document = await corpus.ank.scope(relative);
      this.settle({ corpus, path: relative, document }, '');
    } catch (error) {
      // A path the corpus does not cover is exit 1 and an ordinary answer, not
      // a failure worth a notification.
      const message =
        error instanceof AnkError
          ? error.message
          : `could not read the scope of ${relative}`;
      this.log.info(`scope ${relative}: ${message}`);
      this.settle(undefined, message);
    }
  }

  private settle(answered: Answered | undefined, message: string): void {
    this.answered = answered;
    this.message = message;
    this.pending = false;
    this.changed.fire();
  }
}

function sections({ corpus, path, document }: Answered): vscode.TreeItem[] {
  if (document.total === 0) {
    return [new MessageNode(`Nothing in the corpus covers ${path}`, 'blank')];
  }

  const built: vscode.TreeItem[] = [];

  if (document.adr.length > 0) {
    built.push(
      new GroupNode('Constraints', rows(document.adr, corpus), {
        description: String(document.adr.length),
        icon: new vscode.ThemeIcon('law'),
      }),
    );
  }
  if (document.specs.length > 0) {
    built.push(
      new GroupNode('Specifications', rows(document.specs, corpus), {
        description: String(document.specs.length),
        icon: new vscode.ThemeIcon('book'),
      }),
    );
  }
  if (document.tasks.length > 0) {
    built.push(
      new GroupNode('Tasks touching this', rows(document.tasks, corpus), {
        description: String(document.tasks.length),
        icon: new vscode.ThemeIcon('checklist'),
      }),
    );
  }

  return built;
}

function rows(found: readonly ScopeRow[], corpus: Corpus): vscode.TreeItem[] {
  return found.map((row) => {
    const node = new EntityNode(
      { corpus, id: row.id, kind: row.kind, title: row.title },
      iconOf(roleOfStatus(row.status), 'symbol-file'),
      shortId(row.id),
      markdown([`**${row.title}**`, `\`${row.id}\``, `Status \`${row.status}\`.`]),
    );
    node.contextValue = `ank.${row.kind}.${row.status}`;
    return node;
  });
}
