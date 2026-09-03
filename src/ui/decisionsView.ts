/**
 * The decisions, split by whether they bind anybody yet.
 *
 * A proposed ADR binds nobody until a human ratifies it with a signed accept
 * on the default branch. That is not a detail to bury in a tooltip: a reader
 * looking for what constrains their work needs to see at a glance which of
 * these are rules and which are proposals, so the split is the top level of
 * this tree rather than a badge on a flat list.
 */

import * as vscode from 'vscode';

import type { FindResult } from '../ank';
import type { Corpus } from '../corpus/corpus';
import type { CorpusRegistry } from '../corpus/registry';
import { iconOf, roleOfStatus } from './meaning';
import {
  childrenOf,
  EntityNode,
  GroupNode,
  markdown,
  MessageNode,
  perCorpus,
  shortId,
} from './tree';

export class DecisionsView implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changed.event;

  constructor(private readonly registry: CorpusRegistry) {}

  refresh(): void {
    this.changed.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
    if (element) {
      return childrenOf(element);
    }
    if (this.registry.empty) {
      return [new MessageNode('No corpus in this workspace', 'info')];
    }
    return perCorpus(this.registry.corpora, (corpus) => sections(corpus));
  }
}

function sections(corpus: Corpus): vscode.TreeItem[] {
  const snapshot = corpus.snapshot;
  if (!snapshot) {
    return [new MessageNode('Reading…', 'loading~spin')];
  }

  const accepted = snapshot.decisions.filter((row) => row.status === 'accepted');
  const proposed = snapshot.decisions.filter((row) => row.status === 'proposed');
  const retired = snapshot.decisions.filter(
    (row) => row.status !== 'accepted' && row.status !== 'proposed',
  );

  const built: vscode.TreeItem[] = [
    new GroupNode('Binding', rows(accepted, corpus), {
      description: String(accepted.length),
      icon: new vscode.ThemeIcon('law'),
    }),
  ];

  if (proposed.length > 0) {
    built.push(
      new GroupNode('Proposed', rows(proposed, corpus), {
        description: String(proposed.length),
        icon: new vscode.ThemeIcon('question'),
      }),
    );
  }

  if (retired.length > 0) {
    built.push(
      new GroupNode('Superseded', rows(retired, corpus), {
        description: String(retired.length),
        icon: new vscode.ThemeIcon('archive'),
        collapsed: true,
      }),
    );
  }

  return built;
}

function rows(found: readonly FindResult[], corpus: Corpus): vscode.TreeItem[] {
  if (found.length === 0) {
    return [new MessageNode('Nothing here yet', 'blank')];
  }

  return [...found]
    .sort((left, right) => left.created.localeCompare(right.created))
    .map((row) => {
      const node = new EntityNode(
        { corpus, id: row.id, kind: row.kind, title: row.title },
        iconOf(roleOfStatus(row.state), 'symbol-file'),
        `${shortId(row.id)} · ${row.kind}`,
        markdown([
          `**${row.title}**`,
          `\`${row.id}\``,
          row.status === 'proposed'
            ? 'Proposed. It binds nobody until a human ratifies it with a signed `ank accept` on the default branch.'
            : `Status \`${row.status}\`.`,
        ]),
      );
      node.contextValue = `ank.${row.kind}.${row.status}`;
      return node;
    });
}
