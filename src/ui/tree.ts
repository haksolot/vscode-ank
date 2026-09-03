/**
 * What every tree in this extension shares.
 *
 * An entity is always addressed as a pair -- the corpus it came from and its
 * id -- and never as an id alone. Two corpora may carry ids that look alike,
 * and nothing merges their claim spaces, so a node that lost its corpus would
 * be a command aimed at whichever one answered first.
 */

import * as vscode from 'vscode';

import type { Corpus } from '../corpus/corpus';

/** An entity, addressed. Commands take one of these and never a bare id. */
export interface EntityRef {
  corpus: Corpus;
  id: string;
  kind: string;
  title: string;
}

/** A node that stands for an entity, so a command can act on it. */
export class EntityNode extends vscode.TreeItem {
  constructor(
    readonly ref: EntityRef,
    icon: vscode.ThemeIcon,
    description: string,
    tooltip: vscode.MarkdownString,
  ) {
    super(ref.title, vscode.TreeItemCollapsibleState.None);
    this.id = `${ref.corpus.folder.uri.toString()}::${ref.id}`;
    this.iconPath = icon;
    this.description = description;
    this.tooltip = tooltip;
    // `contextValue` is what the manifest matches on to place a command in a
    // node's context menu. The kind is enough to decide most of them.
    this.contextValue = `ank.${ref.kind}`;
    this.command = {
      command: 'ank.open',
      title: 'Open',
      arguments: [ref],
    };
  }
}

/** A heading with children under it: a section, or a corpus in a multi-root. */
export class GroupNode extends vscode.TreeItem {
  constructor(
    label: string,
    readonly children: vscode.TreeItem[],
    options: {
      description?: string;
      icon?: vscode.ThemeIcon;
      collapsed?: boolean;
      contextValue?: string;
    } = {},
  ) {
    super(
      label,
      options.collapsed === true
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.Expanded,
    );
    if (options.description !== undefined) {
      this.description = options.description;
    }
    if (options.icon !== undefined) {
      this.iconPath = options.icon;
    }
    if (options.contextValue !== undefined) {
      this.contextValue = options.contextValue;
    }
  }
}

/** A line of prose where a list would otherwise be empty or broken. */
export class MessageNode extends vscode.TreeItem {
  constructor(message: string, icon?: string) {
    super(message, vscode.TreeItemCollapsibleState.None);
    if (icon !== undefined) {
      this.iconPath = new vscode.ThemeIcon(icon);
    }
  }
}

export type Node = EntityNode | GroupNode | MessageNode;

/** The children of a node, for trees whose groups carry their own children. */
export function childrenOf(node: vscode.TreeItem | undefined): vscode.TreeItem[] {
  return node instanceof GroupNode ? node.children : [];
}

/**
 * Wraps sections so a single corpus is shown flat.
 *
 * With one corpus open there is nothing to disambiguate and a folder heading
 * over every list is noise. With several, each gets a heading -- side by side,
 * never merged.
 */
export function perCorpus(
  corpora: readonly Corpus[],
  sectionsOf: (corpus: Corpus) => vscode.TreeItem[],
): vscode.TreeItem[] {
  if (corpora.length === 0) {
    return [];
  }
  if (corpora.length === 1) {
    const only = corpora[0];
    return only ? sectionsOf(only) : [];
  }
  return corpora.map(
    (corpus) =>
      new GroupNode(corpus.name, sectionsOf(corpus), {
        icon: new vscode.ThemeIcon('repo'),
        contextValue: 'ank.corpus',
      }),
  );
}

/** A short, monospaced id for the description column. */
export function shortId(id: string): string {
  const dash = id.indexOf('-');
  return dash === -1 ? id : `${id.slice(0, dash)}-${id.slice(dash + 1, dash + 5)}`;
}

export function markdown(lines: readonly string[]): vscode.MarkdownString {
  const built = new vscode.MarkdownString(lines.join('\n\n'));
  built.supportThemeIcons = true;
  return built;
}
