/**
 * Choosing a corpus, and choosing an entity in one.
 *
 * Every command starts here, because an entity is addressed as a pair and
 * never as an id alone. With one corpus open there is nothing to ask. With
 * several, the active editor decides where it can, and the user is asked where
 * it cannot -- picking the first would be the window quietly speaking for a
 * corpus nobody meant.
 */

import * as vscode from 'vscode';

import type { FindResult } from '../ank';
import type { Corpus } from '../corpus/corpus';
import type { CorpusRegistry } from '../corpus/registry';
import { entityOf } from '../providers/entityDocument';
import { refIn } from '../ui/addressing';
import { addressingOf, roleOfStatus } from '../ui/meaning';
import { ICON } from '../ui/meaning';
import type { EntityRef } from '../ui/tree';
import { row } from './run';

export async function pickCorpus(
  registry: CorpusRegistry,
  title = 'Which corpus?',
): Promise<Corpus | undefined> {
  const settled = registry.active();
  if (settled) {
    return settled;
  }
  if (registry.empty) {
    void vscode.window.showInformationMessage('No corpus in this workspace.');
    return undefined;
  }

  const chosen = await vscode.window.showQuickPick(
    registry.corpora.map((corpus) =>
      row({ label: corpus.name, description: corpus.identity, corpus }),
    ),
    { title, placeHolder: 'Claims are per repository; nothing merges them.' },
  );

  return chosen?.corpus;
}

interface Choice extends vscode.QuickPickItem {
  entity: FindResult;
}

/**
 * Picks an entity out of the last snapshot.
 *
 * Off the snapshot rather than off a fresh `find`, so opening a picker is not
 * a read. The snapshot is never more than one event old, and the verb the user
 * is about to run will refuse on a stale id with exit 2 or 3 -- which is a
 * better answer than a picker that took a second to open.
 */
export async function pickEntity(
  corpus: Corpus,
  options: {
    title: string;
    kinds?: readonly string[];
    /** Narrows to what the command can actually act on. */
    where?: (entity: FindResult) => boolean;
    placeHolder?: string;
  },
): Promise<EntityRef | undefined> {
  const snapshot = corpus.snapshot;
  if (!snapshot) {
    void vscode.window.showInformationMessage(`${corpus.name} has not been read yet.`);
    return undefined;
  }

  const kinds = options.kinds ?? ['task'];
  const pool = kinds.includes('task')
    ? [...snapshot.tasks, ...(kinds.length > 1 ? snapshot.decisions : [])]
    : snapshot.decisions;

  const choices: Choice[] = pool
    .filter((entity) => kinds.includes(entity.kind))
    .filter((entity) => options.where?.(entity) ?? true)
    .map((entity) =>
      row({
        label: `$(${ICON[roleOfStatus(entity.state) ?? 'identifier']}) ${entity.title}`,
        description: entity.id,
        detail: detailOf(entity),
        entity,
      }),
    );

  if (choices.length === 0) {
    void vscode.window.showInformationMessage(`Nothing in ${corpus.name} to ${options.title.toLowerCase()}.`);
    return undefined;
  }

  const chosen = await vscode.window.showQuickPick(choices, {
    title: options.title,
    ...(options.placeHolder === undefined ? {} : { placeHolder: options.placeHolder }),
    matchOnDescription: true,
    matchOnDetail: true,
  });

  return chosen
    ? {
        corpus,
        id: chosen.entity.id,
        kind: chosen.entity.kind,
        title: chosen.entity.title,
      }
    : undefined;
}

function detailOf(entity: FindResult): string {
  const holder = addressingOf(entity.state);
  return holder === null ? entity.status : `${entity.status} · ${holder}`;
}

/**
 * The entity a command was pointed at, whatever pointed it.
 *
 * A tree row, its context menu and the panel each hand over a different shape,
 * and `refIn` knows those. An `ank:` uri is the fourth: it is what a link in a
 * rendered entity carries and what a test can invoke with, and resolving it
 * needs the registry -- the scheme names a corpus and an id, so there is
 * nothing to look up beyond which open corpus it belongs to.
 *
 * The kind is a guess for a uri, because the scheme does not carry one. No
 * command reads it for anything but a label.
 */
export function pointedAt(given: unknown, registry: CorpusRegistry): EntityRef | undefined {
  if (given instanceof vscode.Uri) {
    const found = entityOf(given, registry);
    return found
      ? { corpus: found.corpus, id: found.id, kind: 'task', title: found.id }
      : undefined;
  }

  return refIn(given);
}

/**
 * The entity a command should act on.
 *
 * Pointed at one, it acts on it. From the palette it arrives pointed at
 * nothing, and only then is the user asked.
 */
export async function refOf(
  given: unknown,
  registry: CorpusRegistry,
  options: Parameters<typeof pickEntity>[1],
): Promise<EntityRef | undefined> {
  const pointed = pointedAt(given, registry);
  if (pointed) {
    return pointed;
  }
  const corpus = await pickCorpus(registry);
  return corpus ? pickEntity(corpus, options) : undefined;
}
