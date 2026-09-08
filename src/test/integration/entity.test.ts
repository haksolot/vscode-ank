/**
 * The virtual document, checked against the bytes the CLI returned.
 *
 * This runs inside a real editor with this repository open, which carries a
 * corpus of its own. It is the only test that can assert what
 * ADR-6b71ec0890de actually promises: that what a reader sees in the tab is
 * `content` from `ank show`, byte for byte, with nothing rewrapped, nothing
 * normalised and no line ending quietly changed on the way through.
 *
 * The test reaches the CLI directly rather than through the extension, so what
 * it compares are two independent answers to the same question.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as vscode from 'vscode';

import { locate } from '../../ank';
import { ANK_SCHEME, entityUri } from '../../providers/entityDocument';

const EXTENSION = 'haksolot.ank';

function folder(): vscode.WorkspaceFolder {
  const first = vscode.workspace.workspaceFolders?.[0];
  assert.ok(first, 'the tests open a workspace carrying a corpus');
  return first;
}

let binary = 'ank';

/**
 * Asks the binary directly, so the comparison has two independent sides.
 *
 * It goes through the extension's own resolver, which on Windows is the only
 * thing that finds an executable at all: the name on the PATH is a `.cmd`
 * shim, and node refuses to spawn one without a shell.
 */
function ank<T>(args: readonly string[]): T {
  const stdout = execFileSync(
    binary,
    [...args, '--repo', folder().uri.fsPath, '--json'],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );
  return JSON.parse(stdout) as T;
}

/** The markdown previews open right now, whatever they are pointed at. */
function markdownPreviews(): readonly vscode.Tab[] {
  return vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .filter(
      (tab) =>
        tab.input instanceof vscode.TabInputWebview &&
        tab.input.viewType.includes('markdown.preview'),
    );
}

/**
 * Waits for a tab to appear, because opening one is not done when the command
 * that opened it resolves.
 *
 * `markdown.showPreview` returns as soon as the preview is asked for. The tab
 * model catches up a moment later, and on the first call of a session it waits
 * on the built-in markdown extension activating too. Polling a short while is
 * what separates "nothing opened" from "not yet".
 */
async function settled(
  what: () => readonly vscode.Tab[],
  within = 10_000,
): Promise<readonly vscode.Tab[]> {
  const deadline = Date.now() + within;
  for (;;) {
    const found = what();
    if (found.length > 0 || Date.now() > deadline) {
      return found;
    }
    await new Promise((resume) => setTimeout(resume, 100));
  }
}

const quiet = { info: () => {}, warn: () => {}, error: () => {} };

suite('the entity document', () => {
  suiteSetup(async () => {
    const extension = vscode.extensions.getExtension(EXTENSION);
    assert.ok(extension, `${EXTENSION} is not installed in the test host`);
    await extension.activate();
    binary = (await locate(['ank'], quiet)).binary;
  });

  test('serves the content field byte for byte', async () => {
    const found = ank<{ results: { id: string }[] }>(['find', '--type', 'task']);
    const first = found.results[0];
    assert.ok(first, 'this repository carries at least one task');

    const shown = ank<{ content: string }>(['show', first.id]);
    const document = await vscode.workspace.openTextDocument(
      entityUri(folder().uri, first.id),
    );

    // `getText` gives back exactly what the provider returned. A difference
    // here means the editor, or us, changed the file on the way to the screen.
    assert.equal(document.getText(), shown.content);
  });

  test('opening an entity renders it, and shows nobody its source', async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');

    const found = ank<{ results: { id: string }[] }>(['find', '--type', 'task']);
    const first = found.results[0];
    assert.ok(first);

    const uri = entityUri(folder().uri, first.id);
    await vscode.commands.executeCommand('ank.open', uri);

    // The source in a tab is what this test exists to prevent. A rendered
    // preview is a webview, so no text editor may hold the entity -- and no
    // text editor may hold anything else either, since one click opened one
    // thing.
    assert.deepEqual(
      vscode.window.visibleTextEditors.map((editor) => editor.document.uri.toString()),
      [],
    );

    // What did open is the built-in markdown preview, pointed at the entity.
    // The tab is asked rather than the editor, because a webview is not one.
    const previews = await settled(markdownPreviews);
    assert.equal(previews.length, 1, 'exactly one markdown preview');
    assert.match(previews[0]?.label ?? '', new RegExp(first.id));
  });

  test('the panel button opens the file, and that one is an editor', async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');

    const found = ank<{ results: { id: string }[] }>(['find', '--type', 'adr']);
    const first = found.results[0];
    assert.ok(first);

    const uri = entityUri(folder().uri, first.id);
    await vscode.commands.executeCommand('ank.openFile', uri);

    const opened = vscode.window.visibleTextEditors.filter(
      (editor) => editor.document.uri.toString() === uri.toString(),
    );
    assert.equal(opened.length, 1);
  });

  test('has nowhere to be saved, so nothing reaches the corpus through it', async () => {
    const found = ank<{ results: { id: string }[] }>(['find', '--type', 'adr']);
    const first = found.results[0];
    assert.ok(first);

    const uri = entityUri(folder().uri, first.id);
    const document = await vscode.workspace.openTextDocument(uri);
    assert.equal(document.uri.scheme, ANK_SCHEME);

    // An edit through the API does reach the in-memory model -- a content
    // provider serves content and does not police a buffer. What it cannot do
    // is come back: the scheme has no filesystem behind it, so there is no
    // path from a keystroke to a file under `.ank/`. Editing goes through
    // `ank edit`, which is a verb.
    const edit = new vscode.WorkspaceEdit();
    edit.insert(uri, new vscode.Position(0, 0), 'x');
    await vscode.workspace.applyEdit(edit);

    assert.equal(await document.save(), false);

    // `undefined` rather than `false`: the editor answers false for a scheme
    // it knows to be read-only, and undefined for one with no filesystem
    // behind it at all. The second is the stronger answer, and it is the one
    // a content provider gets.
    assert.equal(vscode.workspace.fs.isWritableFileSystem(ANK_SCHEME), undefined);
  });

  test('renders a refusal as the document rather than losing it', async () => {
    const document = await vscode.workspace.openTextDocument(
      entityUri(folder().uri, 'TASK-000000000000'),
    );

    const text = document.getText();
    // Exit 2, and the hint the CLI named, kept where the reader can copy it.
    assert.match(text, /error\[2\]/);
    assert.match(text, /ank find/);
  });

  test('a uri naming no open corpus says so instead of throwing', async () => {
    const document = await vscode.workspace.openTextDocument(
      entityUri(vscode.Uri.file('/nowhere'), 'TASK-1'),
    );

    assert.match(document.getText(), /No open corpus/);
  });
});

suite('the extension', () => {
  test('activates on a workspace carrying a corpus', () => {
    const extension = vscode.extensions.getExtension(EXTENSION);
    assert.ok(extension);
    assert.equal(extension.isActive, true);
  });

  test('registers every view its container declares', async () => {
    // A declared view with no provider renders as a permanently empty pane.
    const declared = (
      vscode.extensions.getExtension(EXTENSION)?.packageJSON as {
        contributes?: { views?: Record<string, { id: string }[]> };
      }
    ).contributes?.views?.['ank'];

    assert.ok(declared);
    assert.deepEqual(
      declared.map((view) => view.id).sort(),
      ['ank.binds', 'ank.decisions', 'ank.graph', 'ank.tasks'],
    );

    // Focusing a view that has no provider throws rather than doing nothing.
    for (const view of declared) {
      await vscode.commands.executeCommand(`${view.id}.focus`);
    }
  });

  test('reads this repository and finds its own tasks', async () => {
    await vscode.commands.executeCommand('ank.refresh');

    const found = ank<{ total: number; results: { kind: string }[] }>([
      'find',
      '--type',
      'task',
    ]);

    // The repository the tests run in carries the milestones that built the
    // extension, so a corpus with no tasks would mean the read failed.
    assert.ok(found.total > 0);
    assert.ok(found.results.every((row) => row.kind === 'task'));
  });

  test('check fills the Problems panel, with signals as information', async () => {
    await vscode.commands.executeCommand('ank.check');

    const reported = vscode.languages
      .getDiagnostics()
      .flatMap(([, diagnostics]) => diagnostics)
      .filter((diagnostic) => diagnostic.source === 'ank');

    // This repository carries the milestones that built the extension, and at
    // least the corpus-level signals `check` always has something to say
    // about, so an empty panel would mean the command did nothing.
    assert.ok(reported.length > 0, 'check reported nothing at all');

    for (const diagnostic of reported) {
      if (diagnostic.code === 'signal') {
        assert.equal(
          diagnostic.severity,
          vscode.DiagnosticSeverity.Information,
          'a signal must not be a warning',
        );
      } else {
        assert.equal(diagnostic.severity, vscode.DiagnosticSeverity.Error);
      }
    }
  });

  test('registers a read-only tool for each verb it offers', async () => {
    const contributed = (
      vscode.extensions.getExtension(EXTENSION)?.packageJSON as {
        contributes?: { languageModelTools?: { name: string }[] };
      }
    ).contributes?.languageModelTools;

    assert.ok(contributed);
    const names = new Set(contributed.map((tool) => tool.name));

    // `vscode.lm.tools` lists what the host actually accepted, so a tool the
    // manifest declares and the code never registered shows up as missing.
    const live = vscode.lm.tools.filter((tool) => names.has(tool.name));
    assert.equal(live.length, contributed.length);

    // The descriptions come from the verb table, so they are the CLI's words.
    const help = ank<{ verbs: { name: string; summary: string }[] }>(['help']);
    for (const tool of live) {
      const verb = tool.name.replace(/^ank_/, '');
      const declared = help.verbs.find((candidate) => candidate.name === verb);
      assert.ok(declared, `${tool.name} names no verb`);
      assert.equal(tool.description, declared.summary);
    }

    await Promise.resolve();
  });

  test('contributes every command it registered', async () => {
    const registered = await vscode.commands.getCommands(true);
    const contributed = (
      vscode.extensions.getExtension(EXTENSION)?.packageJSON as {
        contributes?: { commands?: { command: string }[] };
      }
    ).contributes?.commands;

    for (const { command } of contributed ?? []) {
      assert.ok(registered.includes(command), `${command} is not registered`);
    }
  });
});
