/**
 * Shaping the work: what a corpus gains, and what it promotes.
 *
 * `accept` is here as a command and is the one that runs nothing. It promotes
 * a proposed decision through a signed ratification commit, on the default
 * branch, and it is a human act (ADR-ea0325308b32). The line is composed into
 * a terminal and left unsent.
 */

import * as vscode from 'vscode';

import type { NewEntityOptions, Proof } from '../ank';
import { compose, type CommandContext, type Register } from './index';
import { pickCorpus, refOf } from './pick';
import { ask, attempt, confirm } from './run';

const PROOF_TYPES = ['commit', 'human-review', 'assertion', 'test'] as const;

export function registerShape(register: Register, shared: CommandContext): void {
  const { registry, log } = shared;

  for (const kind of ['task', 'adr', 'spec'] as const) {
    register(`ank.new.${kind}`, 'new', async () => {
      const corpus = await pickCorpus(registry);
      if (!corpus) {
        return;
      }

      const title = await ask({
        title: `New ${kind}`,
        prompt: 'Title',
      });
      if (title === undefined) {
        return;
      }

      // A scope is mandatory: an entity attached to nothing is invisible.
      const scope = await ask({
        title: `New ${kind} · scope`,
        prompt: 'Which files does this cover? A glob, or several separated by commas.',
        placeHolder: 'src/**',
        value: suggestedScope(),
      });
      if (scope === undefined) {
        return;
      }

      const options: NewEntityOptions = {
        title,
        scope: scope.split(',').map((glob) => glob.trim()).filter((glob) => glob !== ''),
      };

      if (kind === 'task') {
        // A criterion states what a verifier can check, not what an executor
        // should attempt. It is asked for here because a task without one
        // cannot be claimed: `claim` freezes it, and there is nothing to
        // freeze.
        const criteria = await ask({
          title: 'New task · criterion',
          prompt: 'What must be true for this to be done? State what a verifier can check.',
          required: false,
        });
        if (criteria !== undefined) {
          Object.assign(options, { criteria });
        }
      }

      if (kind === 'adr') {
        const constraint = await ask({
          title: 'New ADR · constraint',
          prompt: 'What does this bind? A rule the corpus is held to afterwards.',
          required: false,
        });
        if (constraint !== undefined) {
          Object.assign(options, { constraint });
        }
      }

      const created = await attempt({
        what: `create a ${kind}`,
        corpus,
        log,
        run: () => corpus.ank.create(kind, options),
      });
      if (!created) {
        return;
      }

      if (kind !== 'task') {
        void vscode.window.showInformationMessage(
          `${created.id} is proposed. It binds nobody until a human ratifies it with a signed accept on the default branch.`,
        );
      }

      await corpus.refresh();
      await shared.reveal(corpus, created.id);
    });
  }

  register('ank.amend', 'amend', async (given: unknown) => {
    const ref = await refOf(given, registry, {
      title: 'Amend',
      kinds: ['task', 'adr', 'spec'],
      placeHolder: 'blocked_by, references and scope, added and removed explicitly',
    });
    if (!ref) {
      return;
    }

    const what = await vscode.window.showQuickPick(
      [
        { label: 'Add a scope', key: 'scope' as const },
        { label: 'Drop a scope', key: 'dropScope' as const },
        { label: 'Add a blocker', key: 'blockedBy' as const },
        { label: 'Drop a blocker', key: 'dropBlockedBy' as const },
        { label: 'Add a reference', key: 'references' as const },
        { label: 'Drop a reference', key: 'dropReferences' as const },
        {
          label: 'Replace the criterion',
          key: 'criteria' as const,
          detail: 'refused while a live claim freezes it; that case is a release',
        },
      ],
      { title: `Amend ${ref.id}` },
    );
    if (!what) {
      return;
    }

    const value = await ask({
      title: `Amend ${ref.id} · ${what.label}`,
      prompt: what.key === 'criteria' ? 'The new criterion' : 'The value',
    });
    if (value === undefined) {
      return;
    }

    const amended = await attempt({
      what: `amend ${ref.id}`,
      corpus: ref.corpus,
      log,
      run: () =>
        ref.corpus.ank.amend(
          ref.id,
          what.key === 'criteria' ? { criteria: value } : { [what.key]: [value] },
        ),
    });
    if (!amended) {
      return;
    }

    for (const warning of amended.warnings) {
      void vscode.window.showWarningMessage(warning);
    }
    void vscode.window.showInformationMessage(
      `${amended.document.entity}: ${amended.document.amended.join(', ')}`,
    );
    await ref.corpus.refresh();
    shared.documents.invalidateAll(ref.corpus);
  });

  register('ank.read', 'read', async (given: unknown) => {
    const ref = await refOf(given, registry, {
      title: 'Mark as read',
      kinds: ['task', 'adr', 'spec'],
      placeHolder: 'records that a person read this and stands behind it',
    });
    if (!ref) {
      return;
    }

    // This is a claim about a person, made by a person. Asking first is the
    // difference between a record and a click.
    if (
      !(await confirm(
        `Record that you have read ${ref.id} and stand behind it?`,
        'I have read it',
      ))
    ) {
      return;
    }

    const recorded = await attempt({
      what: `record a reading of ${ref.id}`,
      corpus: ref.corpus,
      log,
      run: () => ref.corpus.ank.markRead(ref.id),
    });
    if (recorded) {
      void vscode.window.showInformationMessage(
        `${recorded.entity} has ${String(recorded.readings)} reading(s).`,
      );
      shared.documents.invalidateAll(ref.corpus);
    }
  });

  register('ank.attest', 'attest', async (given: unknown) => {
    const ref = await refOf(given, registry, {
      title: 'Attest',
      where: (entity) => entity.status === 'done',
      placeHolder: 'the one write allowed after done',
    });
    if (!ref) {
      return;
    }

    const type = await vscode.window.showQuickPick([...PROOF_TYPES], {
      title: `Attest ${ref.id}`,
      placeHolder: 'what kind of proof is this?',
    });
    if (!type) {
      return;
    }

    const reference = await ask({
      title: `${type} proof`,
      prompt: 'The reference: a commit, a run id, an assertion.',
    });
    if (reference === undefined) {
      return;
    }

    const attested = await attempt({
      what: `attest ${ref.id}`,
      corpus: ref.corpus,
      log,
      run: () => ref.corpus.ank.attest(ref.id, `${type}:${reference}` as Proof),
    });
    if (attested) {
      void vscode.window.showInformationMessage(
        `${attested.task} carries ${String(attested.proofs)} proof(s).`,
      );
      shared.documents.invalidateAll(ref.corpus);
    }
  });

  register('ank.review', 'review', async () => {
    const corpus = await pickCorpus(registry);
    if (!corpus) {
      return;
    }

    const reviewed = await attempt({
      what: 'review the corpus',
      corpus,
      log,
      run: () => corpus.ank.review(),
    });
    if (!reviewed) {
      return;
    }

    const { document } = reviewed;
    const rows: vscode.QuickPickItem[] = [];

    rows.push({
      label: `Proposed (${String(document.proposed.length)})`,
      kind: vscode.QuickPickItemKind.Separator,
    });
    for (const proposal of document.proposed) {
      rows.push({ label: proposal.title, description: proposal.id });
    }

    if (document.signers.length === 0) {
      rows.push({ label: 'Signers', kind: vscode.QuickPickItemKind.Separator });
      rows.push({
        label: 'No ratification key is declared',
        detail: 'permissions are advisory, not enforced',
      });
    }

    rows.push({
      label: `Live constraints (${String(document.live.length)}), ${String(document.dead)} dead scope(s)`,
      kind: vscode.QuickPickItemKind.Separator,
    });
    for (const live of document.live) {
      rows.push({
        label: live.title,
        description: live.id,
        detail: `${String(live.files)} file(s) covered`,
      });
    }

    await vscode.window.showQuickPick(rows, {
      title: `ank review · ${corpus.name}`,
      placeHolder: `${String(document.faults)} fault(s), ${String(document.signals)} signal(s)`,
    });
  });

  /**
   * Composes the ratification line and stops.
   *
   * Nothing in this extension executes `accept`. An extension that ran it from
   * a button would be signing on the user's behalf from a click that looked
   * like every other click in the tree.
   */
  register('ank.accept', 'accept', async (given: unknown) => {
    const ref = await refOf(given, registry, {
      title: 'Ratify',
      kinds: ['adr', 'spec'],
      where: (entity) => entity.status === 'proposed',
      placeHolder: 'a signed commit on the default branch: yours to run, not ours',
    });
    if (!ref) {
      return;
    }

    compose(ref.corpus, ['accept', ref.id]);
    void vscode.window.showInformationMessage(
      'The line is in the terminal, unsent. Ratifying is a signed commit on the default branch, and it is a human act.',
    );
  });

  /**
   * A scope suggestion from wherever the user is standing.
   *
   * A glob is confronted with the filesystem, so the directory of the active
   * file is a better first guess than an empty box.
   */
  function suggestedScope(): string | undefined {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.scheme !== 'file') {
      return undefined;
    }
    const relative = vscode.workspace.asRelativePath(editor.document.uri, false);
    const slash = relative.lastIndexOf('/');
    return slash === -1 ? relative : `${relative.slice(0, slash)}/**`;
  }
}
