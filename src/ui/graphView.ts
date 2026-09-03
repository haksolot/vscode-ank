/**
 * The blocked_by DAG, indented under what blocks it.
 *
 * The same shape `ank graph` prints, in a tree that expands. Two things it has
 * to get right, and both come from the DAG being a DAG and not a hierarchy:
 *
 * - A task with several blockers appears under each of them. The second and
 *   later appearances are marked rather than hidden, because a reader
 *   following one branch needs to know the task is also waiting on something
 *   they cannot see from here.
 * - A cycle would otherwise recurse forever. `check` reports one as a fault,
 *   but a view must survive meeting one before anybody has run `check`.
 */

import * as vscode from 'vscode';

import type { Corpus } from '../corpus/corpus';
import type { CorpusRegistry } from '../corpus/registry';
import type { ReadyTask } from '../corpus/refresh';
import { taskIcon } from './meaning';
import { GroupNode, markdown, MessageNode, perCorpus, shortId } from './tree';

/** A node in the DAG, carrying the path that reached it. */
class GraphNode extends vscode.TreeItem {
  constructor(
    readonly corpus: Corpus,
    readonly task: ReadyTask,
    readonly seen: ReadonlySet<string>,
    readonly children: readonly ReadyTask[],
    repeated: boolean,
  ) {
    super(
      task.title,
      children.length === 0
        ? vscode.TreeItemCollapsibleState.None
        : repeated
          ? vscode.TreeItemCollapsibleState.None
          : vscode.TreeItemCollapsibleState.Expanded,
    );

    this.id = `${corpus.folder.uri.toString()}::${[...seen].join('>')}>${task.id}`;
    this.iconPath = taskIcon(task.state, task.blockedBy.length === 0);
    this.description = repeated
      ? `${shortId(task.id)} · also above`
      : shortId(task.id);
    this.contextValue = 'ank.task';
    this.tooltip = markdown([
      `**${task.title}**`,
      `\`${task.id}\``,
      repeated
        ? 'Shown above as well: this task waits on more than one thing.'
        : `Status \`${task.status}\`.`,
    ]);
    this.command = {
      command: 'ank.open',
      title: 'Open',
      arguments: [{ corpus, id: task.id, kind: 'task', title: task.title }],
    };
  }
}

export class GraphView implements vscode.TreeDataProvider<vscode.TreeItem> {
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
    if (element instanceof GraphNode) {
      return this.expand(element);
    }
    if (element instanceof GroupNode) {
      return [...element.children];
    }
    if (element) {
      return [];
    }
    if (this.registry.empty) {
      return [new MessageNode('No corpus in this workspace', 'info')];
    }
    return perCorpus(this.registry.corpora, (corpus) => this.roots(corpus));
  }

  /**
   * The roots: tasks nothing is waiting for, which is where the DAG starts.
   *
   * `ank graph` prints these as roots too. A task with no unfinished blockers
   * and nothing depending on it is a root of its own one-node tree, and it
   * belongs here rather than being hidden for being uninteresting.
   */
  private roots(corpus: Corpus): vscode.TreeItem[] {
    const snapshot = corpus.snapshot;
    if (!snapshot) {
      return [new MessageNode('Reading…', 'loading~spin')];
    }

    const open = snapshot.tasks.filter(
      (task) => task.status !== 'done' && task.status !== 'closed',
    );
    if (open.length === 0) {
      return [new MessageNode('Nothing open', 'blank')];
    }

    const roots = open.filter((task) => task.blockedBy.length === 0);
    if (roots.length === 0) {
      // Every open task waits on another: the graph is a cycle, or everything
      // that would have been a root is finished. Either way, show the lot.
      return open.map(
        (task) => new GraphNode(corpus, task, new Set(), [], false),
      );
    }

    return roots.map(
      (task) =>
        new GraphNode(corpus, task, new Set([task.id]), waitingOn(corpus, task.id), false),
    );
  }

  private expand(node: GraphNode): vscode.TreeItem[] {
    return node.children.map((child) => {
      const repeated = node.seen.has(child.id);
      const seen = new Set([...node.seen, child.id]);
      return new GraphNode(
        node.corpus,
        child,
        seen,
        repeated ? [] : waitingOn(node.corpus, child.id),
        repeated,
      );
    });
  }
}

/** The open tasks that name this one among their unfinished blockers. */
function waitingOn(corpus: Corpus, id: string): ReadyTask[] {
  const tasks = corpus.snapshot?.tasks ?? [];
  return tasks.filter(
    (task) =>
      task.status !== 'done' && task.status !== 'closed' && task.blockedBy.includes(id),
  );
}
