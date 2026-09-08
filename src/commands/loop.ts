/**
 * The four verbs that carry the loop, plus the two beside them.
 *
 * `context` for what binds here and what is takeable, `claim` to take a task
 * and freeze its criterion, `log` while you work, `done` to finish with a
 * proof. `show` and `release` complete the group.
 */

import * as vscode from 'vscode';

import type { Proof } from '../ank';
import type { CommandContext, Register } from './index';
import { isHeading, traceRows } from '../ui/trace';
import { ask, attempt, confirm, row } from './run';
import { pickCorpus, refOf } from './pick';

const PROOF_TYPES = ['commit', 'human-review', 'assertion', 'test'] as const;

export function registerLoop(register: Register, shared: CommandContext): void {
  const { registry, log } = shared;

  register('ank.context', 'context', async () => {
    const corpus = await pickCorpus(registry);
    if (!corpus) {
      return;
    }

    // `context` renews the caller's claim in execution mode. That is correct
    // from a command: somebody just asked for it. It is why no view calls it.
    const document = await attempt({
      what: 'read the context',
      corpus,
      log,
      run: () => corpus.ank.context(),
    });
    if (!document) {
      return;
    }

    const rows: vscode.QuickPickItem[] = [];

    if (document.criteria !== null) {
      rows.push({ label: 'Criterion', kind: vscode.QuickPickItemKind.Separator });
      rows.push({ label: document.criteria, detail: 'frozen by your claim' });
    }

    rows.push({
      label: `Constraints (${String(document.constraints.length)})`,
      kind: vscode.QuickPickItemKind.Separator,
    });
    for (const constraint of document.constraints) {
      rows.push({
        label: constraint.title,
        description: constraint.id,
        detail: constraint.constraint,
      });
    }

    rows.push({
      label: `Takeable (${String(document.ready)} ready, ${String(document.blocked)} blocked)`,
      kind: vscode.QuickPickItemKind.Separator,
    });
    for (const task of document.tasks) {
      rows.push({
        label: task.title,
        description: task.id,
        detail: task.ready
          ? `ready · unblocks ${String(task.unblocks)}`
          : `blocked · ${task.state}`,
      });
    }

    await vscode.window.showQuickPick(rows, {
      title: `ank context · ${corpus.name}`,
      placeHolder: 'what binds this perimeter, and what is claimable',
    });
  });

  register('ank.claim', 'claim', async (given: unknown) => {
    const ref = await refOf(given, registry, {
      title: 'Claim',
      where: (entity) => entity.status === 'open',
      placeHolder: 'the criterion is frozen by hash the moment you claim it',
    });
    if (!ref) {
      return;
    }

    const claimed = await attempt({
      what: `claim ${ref.id}`,
      corpus: ref.corpus,
      log,
      run: () => ref.corpus.ank.claim(ref.id),
      alternatives: async () => {
        await vscode.commands.executeCommand('ank.context');
      },
    });
    if (!claimed) {
      return;
    }

    for (const warning of claimed.warnings) {
      // A live claim whose scope intersects yours is a fact to read, not an
      // error: `claim` names it and takes the task anyway.
      void vscode.window.showWarningMessage(warning);
    }

    await ref.corpus.refresh();
    await shared.reveal(ref.corpus, ref.id);
  });

  register('ank.show', 'show', async (given: unknown) => {
    const ref = await refOf(given, registry, {
      title: 'Show',
      kinds: ['task', 'adr', 'spec'],
    });
    if (ref) {
      await shared.reveal(ref.corpus, ref.id);
    }
  });

  register('ank.log', 'log', async (given: unknown) => {
    const ref = await refOf(given, registry, {
      title: 'Log against',
      placeHolder: 'what you learned, logged when you learn it',
    });
    if (!ref) {
      return;
    }

    const message = await ask({
      title: `Log against ${ref.id}`,
      prompt: 'What did you learn? This renews the claim.',
      placeHolder: 'the layout is not the contract',
    });
    if (message === undefined) {
      return;
    }

    const written = await attempt({
      what: `log against ${ref.id}`,
      corpus: ref.corpus,
      log,
      run: () => ref.corpus.ank.appendLog(ref.id, message),
    });
    if (!written) {
      return;
    }

    for (const warning of written.warnings) {
      void vscode.window.showWarningMessage(warning);
    }
    await ref.corpus.refresh();
    shared.documents.invalidateAll(ref.corpus);
  });

  register('ank.readLog', 'log', async (given: unknown) => {
    const ref = await refOf(given, registry, {
      title: 'Read the log of',
      kinds: ['task', 'adr', 'spec'],
      placeHolder: 'what previous holders tried, and why they stopped',
    });
    if (!ref) {
      return;
    }

    const read = await attempt({
      what: `read the log of ${ref.id}`,
      corpus: ref.corpus,
      log,
      run: () => ref.corpus.ank.readLog(ref.id),
    });
    if (!read) {
      return;
    }

    const trace = traceRows(read);
    if (trace.length === 0) {
      void vscode.window.showInformationMessage(`${ref.id} has no log yet.`);
      return;
    }

    // Every entry is a `LOG-*` entity, and a picker over them is a reader
    // asking to read: the row carries its id so choosing one can open it.
    // `id` is optional on the way out because `row` drops what is null, and
    // because a heading stands for no entity at all.
    const rows: (vscode.QuickPickItem & { id?: string | null | undefined })[] = trace.map(
      (entry) =>
        isHeading(entry)
          ? row({ label: entry.heading, kind: vscode.QuickPickItemKind.Separator })
          : row(entry),
    );

    const chosen = await vscode.window.showQuickPick(rows, {
      title: `Log · ${ref.id}`,
      placeHolder: `${String(read.total)} entr(ies) in the work trace`,
    });

    // A migrated entry is not an entity, so there is nothing to open and
    // nothing to say about it: the picker read, which is what it was for.
    const opening = chosen?.id;
    if (opening === undefined || opening === null) {
      return;
    }

    await shared.preview(ref.corpus, opening);
  });

  register('ank.done', 'done', async (given: unknown) => {
    const ref = await refOf(given, registry, {
      title: 'Finish',
      where: (entity) => entity.status === 'in_progress',
      placeHolder: 'the verifiers run here, and the proof records what ran',
    });
    if (!ref) {
      return;
    }

    // A proof is only asked for where the task names no verifier. Asking
    // always would teach people to type one rather than declare one.
    const proof = await proofIfNeeded(ref.id);
    if (proof === CANCELLED) {
      return;
    }

    const finished = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `ank done ${ref.id}`,
        cancellable: false,
      },
      () =>
        attempt({
          what: `finish ${ref.id}`,
          corpus: ref.corpus,
          log,
          run: () => ref.corpus.ank.done(ref.id, proof),
        }),
    );
    if (!finished) {
      return;
    }

    const { document } = finished;
    void vscode.window.showInformationMessage(
      `${document.task} is ${document.status}, ${String(document.proofs)} proof(s) recorded at ${document.commit.slice(0, 7)}.`,
    );
    await ref.corpus.refresh();
    shared.documents.invalidateAll(ref.corpus);
  });

  register('ank.release', 'release', async (given: unknown) => {
    const ref = await refOf(given, registry, {
      title: 'Release',
      where: (entity) => entity.status === 'in_progress',
      placeHolder: 'stuck or wrong about the approach: say so',
    });
    if (!ref) {
      return;
    }

    const reason = await ask({
      title: `Release ${ref.id}`,
      prompt: 'Why? This is recorded in the log, and it is what the next holder reads.',
      placeHolder: 'the criterion is wrong',
    });
    if (reason === undefined) {
      return;
    }

    const released = await attempt({
      what: `release ${ref.id}`,
      corpus: ref.corpus,
      log,
      run: () => ref.corpus.ank.release(ref.id, reason),
    });
    if (!released) {
      return;
    }

    await ref.corpus.refresh();
    shared.documents.invalidateAll(ref.corpus);
  });

  const CANCELLED = Symbol('cancelled');

  /**
   * A proof, where the user says one is needed.
   *
   * `done` refuses with exit 5 when the task names no verifier and no proof
   * was given, and that refusal is the honest first answer: it tells the user
   * their task declares no verification. This offers the escape hatch after
   * they have seen it, rather than before.
   */
  async function proofIfNeeded(id: string): Promise<Proof | undefined | typeof CANCELLED> {
    const chosen = await vscode.window.showQuickPick(
      [
        {
          label: 'Run the declared verifiers',
          detail: 'what the task names in its verify: list',
          proof: undefined,
        },
        ...PROOF_TYPES.map((type) => ({
          label: `Attach a ${type} proof`,
          detail: 'for a task that declares no verifier',
          proof: type,
        })),
      ],
      { title: `Finish ${id}`, placeHolder: 'an agent that grades itself can simply be wrong' },
    );

    if (!chosen) {
      return CANCELLED;
    }
    if (chosen.proof === undefined) {
      return undefined;
    }

    const reference = await ask({
      title: `${chosen.proof} proof`,
      prompt: 'What is the reference? A commit, a run id, an assertion.',
    });
    if (reference === undefined) {
      return CANCELLED;
    }

    // `chosen.proof` is one of the four declared types, so the template
    // already has the shape `<type>:<ref>` the grammar asks for.
    return `${chosen.proof}:${reference}`;
  }

  register('ank.close', 'close', async (given: unknown) => {
    const ref = await refOf(given, registry, {
      title: 'Close',
      where: (entity) => entity.status !== 'done' && entity.status !== 'closed',
      placeHolder: 'a task that will never be done',
    });
    if (!ref) {
      return;
    }

    const reason = await ask({
      title: `Close ${ref.id}`,
      prompt: 'Why? A closure nobody explained is one nobody can reopen.',
    });
    if (reason === undefined) {
      return;
    }

    if (!(await confirm(`Close ${ref.id}? ${reason}`, 'Close'))) {
      return;
    }

    const closed = await attempt({
      what: `close ${ref.id}`,
      corpus: ref.corpus,
      log,
      run: () => ref.corpus.ank.close(ref.id, reason),
    });
    if (!closed) {
      return;
    }

    if (closed.claim_revoked) {
      void vscode.window.showWarningMessage(
        `${closed.task} was held, and closing it revoked the claim.`,
      );
    }
    await ref.corpus.refresh();
    shared.documents.invalidateAll(ref.corpus);
  });
}
