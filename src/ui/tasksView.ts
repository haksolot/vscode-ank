/**
 * The work, grouped by what a reader can do about it.
 *
 * Ready first, then by how many other tasks each would unblock. That ordering
 * comes from the graph and is not recomputed here for presentation: it is the
 * answer to "what should I take next", and a view that sorted alphabetically
 * over it would be throwing away the only thing the corpus knows that a
 * directory listing does not.
 */

import * as vscode from 'vscode';

import type { Corpus } from '../corpus/corpus';
import type { CorpusRegistry } from '../corpus/registry';
import type { ReadyTask } from '../corpus/refresh';
import { addressingOf, taskIcon } from './meaning';
import {
  childrenOf,
  EntityNode,
  GroupNode,
  markdown,
  MessageNode,
  perCorpus,
  shortId,
} from './tree';

/** A status that means the task is finished, whichever way it finished. */
const FINISHED = new Set(['done', 'closed']);

export class TasksView implements vscode.TreeDataProvider<vscode.TreeItem> {
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
    const failure = corpus.error;
    return [
      new MessageNode(
        failure ? `error[${String(failure.code)}]: ${failure.message}` : 'Reading…',
        failure ? 'error' : 'loading~spin',
      ),
    ];
  }

  const held = snapshot.status.claim?.id ?? null;
  const open = snapshot.tasks.filter((task) => !FINISHED.has(task.status));

  const underway = open.filter((task) => task.status === 'in_progress');
  const ready = open.filter(
    (task) => task.status !== 'in_progress' && task.blockedBy.length === 0,
  );
  const blocked = open.filter(
    (task) => task.status !== 'in_progress' && task.blockedBy.length > 0,
  );
  const finished = snapshot.tasks.filter((task) => FINISHED.has(task.status));

  const built: vscode.TreeItem[] = [];

  if (underway.length > 0) {
    built.push(
      section('In progress', underway, corpus, held, {
        icon: 'debug-continue',
      }),
    );
  }

  built.push(
    section('Ready', ready, corpus, held, {
      icon: 'play',
      empty: 'Nothing is takeable',
    }),
  );

  if (blocked.length > 0) {
    built.push(section('Blocked', blocked, corpus, held, { icon: 'circle-slash' }));
  }

  if (finished.length > 0) {
    built.push(
      section('Finished', finished, corpus, held, {
        icon: 'pass',
        collapsed: true,
      }),
    );
  }

  return built;
}

function section(
  label: string,
  tasks: readonly ReadyTask[],
  corpus: Corpus,
  held: string | null,
  options: { icon: string; collapsed?: boolean; empty?: string },
): GroupNode {
  const children: vscode.TreeItem[] =
    tasks.length === 0 && options.empty !== undefined
      ? [new MessageNode(options.empty, 'blank')]
      : tasks.map((task) => taskNode(task, corpus, held));

  return new GroupNode(label, children, {
    description: String(tasks.length),
    icon: new vscode.ThemeIcon(options.icon),
    ...(options.collapsed === true ? { collapsed: true } : {}),
  });
}

function taskNode(task: ReadyTask, corpus: Corpus, held: string | null): EntityNode {
  const mine = task.id === held;
  const ready = task.blockedBy.length === 0;

  const node = new EntityNode(
    { corpus, id: task.id, kind: 'task', title: task.title },
    mine ? new vscode.ThemeIcon('account') : taskIcon(task.state, ready),
    describe(task, mine),
    tooltip(task, mine),
  );

  // The menus distinguish a task this identity holds from one it does not:
  // claim is offered on the second, done and release on the first.
  node.contextValue = mine ? 'ank.task.held' : `ank.task.${ready ? 'ready' : 'blocked'}`;
  return node;
}

/**
 * The right-hand column: the id, and whatever the state adds to the status.
 *
 * A claimed task's state reads `claimed:who@host`. The part after the colon is
 * addressing, and it is what a reader wants here -- who has it -- rather than
 * the word `claimed`, which the icon already said.
 */
function describe(task: ReadyTask, mine: boolean): string {
  const parts = [shortId(task.id)];

  const holder = addressingOf(task.state);
  if (holder !== null && !mine) {
    parts.push(holder);
  }
  if (task.blockedBy.length > 0) {
    parts.push(`waits on ${String(task.blockedBy.length)}`);
  } else if (task.unblocks > 0) {
    parts.push(`unblocks ${String(task.unblocks)}`);
  }

  return parts.join(' · ');
}

function tooltip(task: ReadyTask, mine: boolean): vscode.MarkdownString {
  const lines = [`**${task.title}**`, `\`${task.id}\``];

  if (mine) {
    lines.push('$(account) You hold this task.');
  } else {
    const holder = addressingOf(task.state);
    if (holder !== null) {
      lines.push(`Held by \`${holder}\`.`);
    }
  }

  if (task.blockedBy.length > 0) {
    lines.push(
      `Waits on:\n${task.blockedBy.map((id) => `- \`${id}\``).join('\n')}`,
    );
  } else if (task.unblocks > 0) {
    lines.push(`Finishing this unblocks ${String(task.unblocks)} other task(s).`);
  }

  lines.push(`Status \`${task.status}\`, state \`${task.state}\`.`);
  return markdown(lines);
}
