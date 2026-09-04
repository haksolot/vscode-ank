/**
 * Keeping the corpus honest, and setting one up.
 *
 * `check` is here and is never on a timer: it prunes the claim refs it finds
 * stale, so it writes, and it walks git history. It is the verb a human or a
 * pipeline runs deliberately.
 */

import * as vscode from 'vscode';

import { init, INSTALL_HINT } from '../ank';
import type { CommandContext, Register } from './index';
import { pickCorpus, refOf } from './pick';
import { ask, attempt, confirm, row } from './run';

export function registerHonest(register: Register, shared: CommandContext): void {
  const { registry, log } = shared;

  register('ank.check', 'check', async () => {
    const corpus = await pickCorpus(registry);
    if (!corpus) {
      return;
    }

    const checked = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Window, title: 'ank check' },
      () =>
        attempt({
          what: 'check the corpus',
          corpus,
          log,
          run: () => corpus.ank.check(),
        }),
    );
    if (!checked) {
      return;
    }

    const { document } = checked;
    if (document.pruned.length > 0) {
      log.info(`check pruned ${document.pruned.join(', ')}`);
    }

    // Exit 8 is findings and not a crash. Signals alone leave the code 0, and
    // reddening a build over an observation teaches a team to stop reading it.
    shared.onFindings(corpus, document);

    if (document.findings.length === 0) {
      void vscode.window.showInformationMessage(
        `${corpus.name}: nothing to report over ${String(document.tasks)} task(s) and ${String(document.adr)} decision(s).`,
      );
      return;
    }

    const chosen = await vscode.window.showQuickPick(
      document.findings.map((finding) =>
        row({
          label: `$(${finding.level === 'fault' ? 'error' : 'warning'}) ${finding.message}`,
          description: finding.subject,
          detail: finding.note[0],
          finding,
        }),
      ),
      {
        title: `ank check · ${corpus.name}`,
        placeHolder: `${String(document.faults)} fault(s), ${String(document.signals)} signal(s)`,
        matchOnDescription: true,
      },
    );

    if (chosen && chosen.finding.note.length > 0) {
      const copy = 'Copy';
      const answer = await vscode.window.showInformationMessage(
        chosen.finding.note.join('\n\n'),
        { modal: true },
        copy,
      );
      if (answer === copy) {
        await vscode.env.clipboard.writeText(chosen.finding.note.join('\n'));
      }
    }
  });

  register('ank.edit', 'edit', async (given: unknown) => {
    const ref = await refOf(given, registry, {
      title: 'Edit',
      kinds: ['task', 'adr', 'spec'],
      placeHolder: 'changes a content field; the freeze is anchored where an editor cannot reach',
    });
    if (!ref) {
      return;
    }

    const field = await vscode.window.showQuickPick(
      [
        { label: 'Title', key: 'title' as const },
        { label: 'Body', key: 'body' as const },
        {
          label: 'Constraint',
          key: 'constraint' as const,
          detail: 'ADRs only; what the decision binds',
        },
      ],
      { title: `Edit ${ref.id}` },
    );
    if (!field) {
      return;
    }

    const value = await ask({
      title: `Edit ${ref.id} · ${field.label}`,
      prompt: 'The new value',
    });
    if (value === undefined) {
      return;
    }

    const edited = await attempt({
      what: `edit ${ref.id}`,
      corpus: ref.corpus,
      log,
      run: () => ref.corpus.ank.edit(ref.id, { [field.key]: value }),
    });
    if (!edited) {
      return;
    }

    void vscode.window.showInformationMessage(
      `${edited.entity} is at version ${String(edited.version)}: ${edited.changed.join(', ')}.`,
    );
    await ref.corpus.refresh();
    shared.documents.invalidateAll(ref.corpus);
  });

  register('ank.migrate', 'migrate', async () => {
    const corpus = await pickCorpus(registry);
    if (!corpus) {
      return;
    }

    if (
      !(await confirm(
        `Rewrite the previous log directory of ${corpus.name} as entries, and remove what it read?`,
        'Migrate',
      ))
    ) {
      return;
    }

    const migrated = await attempt({
      what: 'migrate the corpus',
      corpus,
      log,
      run: () => corpus.ank.migrate(),
    });
    if (migrated) {
      void vscode.window.showInformationMessage(
        `${String(migrated.files)} file(s) read, ${String(migrated.created)} entit(ies) created.`,
      );
      await corpus.refresh();
    }
  });

  register('ank.config', 'config', async () => {
    const corpus = await pickCorpus(registry);
    if (!corpus) {
      return;
    }

    const key = await ask({
      title: `Config · ${corpus.name}`,
      prompt: 'Which key? The key alone reads; a value writes.',
      placeHolder: 'default_branch',
    });
    if (key === undefined) {
      return;
    }

    const read = await attempt({
      what: `read ${key}`,
      corpus,
      log,
      run: () => corpus.ank.readConfig(key),
    });
    if (!read) {
      return;
    }

    const value = await ask({
      title: `${key} = ${read.value ?? '(unset)'}`,
      prompt: `Currently from ${read.source}. Leave unchanged to stop here.`,
      value: read.value ?? '',
      required: false,
    });
    if (value === undefined || value === read.value) {
      return;
    }

    const written = await attempt({
      what: `write ${key}`,
      corpus,
      log,
      run: () => corpus.ank.writeConfig(key, value),
    });
    if (written?.changed === true) {
      void vscode.window.showInformationMessage(
        `${written.key}: ${written.previous ?? '(unset)'} to ${written.value ?? '(unset)'}.`,
      );
      await corpus.refresh();
    }
  });

  /**
   * Creates a corpus in a folder that has none.
   *
   * `init` is the one verb that refuses `--repo`, because it makes the
   * repository the flag would have named. The target is positional, and the
   * folder is picked rather than assumed.
   */
  register('ank.init', 'init', async () => {
    const folders = vscode.workspace.workspaceFolders ?? [];
    if (folders.length === 0) {
      void vscode.window.showInformationMessage('Open a folder first.');
      return;
    }

    const chosen =
      folders.length === 1
        ? folders[0]
        : (
            await vscode.window.showQuickPick(
              folders.map((folder) => ({ label: folder.name, folder })),
              { title: 'Create a corpus in which folder?' },
            )
          )?.folder;

    if (!chosen) {
      return;
    }

    if (registry.corpora.some((corpus) => corpus.folder.uri.toString() === chosen.uri.toString())) {
      void vscode.window.showInformationMessage(`${chosen.name} already carries a corpus.`);
      return;
    }

    if (
      !(await confirm(
        `Create a corpus in ${chosen.name}? This writes .ank/, a config and a refs/ank/* refspec.`,
        'Create',
      ))
    ) {
      return;
    }

    // `init` addresses no corpus, so it does not go through a `Corpus`: it is
    // the one command that runs before there is anything to address, and the
    // one verb that refuses `--repo`.
    try {
      const created = await init(shared.cli, chosen.uri.fsPath);
      void vscode.window.showInformationMessage(
        created.changed
          ? `Created ${[...created.created, ...created.wrote].join(', ')}.`
          : `${chosen.name} already carried everything init writes.`,
      );
      await registry.start();
    } catch (error) {
      log.error(`init: ${String(error)}`);
      void vscode.window.showErrorMessage(
        error instanceof Error ? error.message : String(error),
      );
    }
  });

  register('ank.installHint', null, async () => {
    await vscode.env.clipboard.writeText(INSTALL_HINT);
    void vscode.window.showInformationMessage(`Copied: ${INSTALL_HINT}`);
  });
}
