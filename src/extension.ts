import * as vscode from 'vscode';

import { AnkCli, AnkError, Capabilities, INSTALL_HINT, locate } from './ank';
import type { Located } from './ank';
import { CorpusRegistry } from './corpus/registry';
import { Log } from './log';
import {
  ANK_SCHEME,
  EntityDocumentProvider,
  entityUri,
} from './providers/entityDocument';
import { EntityPanel } from './providers/entityPanel';
import type { EntityRef } from './ui/tree';

/** What the extension resolved at activation. */
interface Binary {
  cli: AnkCli;
  located: Located;
  capabilities: Capabilities;
}

/** The commands this build registers. The panel is told, rather than assuming. */
const OFFERED = new Set(['ank.showLog', 'ank.refresh', 'ank.open', 'ank.openFile']);

let log: Log | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  log = new Log();
  context.subscriptions.push(log);

  context.subscriptions.push(
    vscode.commands.registerCommand('ank.showLog', () => log?.show()),
  );

  const binary = await open(log);
  await setContext('ank.hasBinary', binary !== undefined);
  if (!binary) {
    return;
  }

  log.info(
    `ank ${binary.located.version} at ${binary.located.binary}, ` +
      `${String(binary.capabilities.verbs.length)} verbs`,
  );

  const registry = new CorpusRegistry(binary.cli, log);
  const documents = new EntityDocumentProvider(registry);
  const panel = new EntityPanel(context.extensionUri, OFFERED);
  context.subscriptions.push(registry, documents, panel);

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(ANK_SCHEME, documents),
  );

  context.subscriptions.push(
    registry.onDidChange(() => {
      void announce(registry);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ank.refresh', async () => {
      await Promise.all(registry.corpora.map((corpus) => corpus.refresh()));
      documents.invalidateAll();
    }),
    vscode.commands.registerCommand('ank.open', (ref: EntityRef) =>
      openEntity(ref, documents, panel, true),
    ),
    vscode.commands.registerCommand('ank.openFile', (ref: EntityRef) =>
      openEntity(ref, documents, panel, false),
    ),
  );

  await registry.start();
  await announce(registry);
}

export function deactivate(): void {
  // Everything this extension owns is on `context.subscriptions`, which the
  // host disposes for us. Nothing is left to unwind by hand.
}

/**
 * Opens an entity: the file as a document, and what the file cannot say beside it.
 *
 * `show` runs once. The panel reads what it needs off the same document rather
 * than asking again -- two calls for one click would renew the lease twice,
 * which is harmless and still wrong for a reason worth keeping straight.
 */
async function openEntity(
  ref: EntityRef | undefined,
  documents: EntityDocumentProvider,
  panel: EntityPanel,
  withPanel: boolean,
): Promise<void> {
  if (!ref) {
    return;
  }

  const uri = entityUri(ref.corpus.folder.uri, ref.id);
  documents.invalidate(uri);

  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.languages.setTextDocumentLanguage(document, 'markdown');
  await vscode.window.showTextDocument(document, { preview: true });

  if (withPanel) {
    const shown = documents.peek(uri);
    if (shown) {
      panel.reveal(ref.corpus, ref.id, shown);
    }
  }
}

/**
 * The context keys the manifest gates commands and views on.
 *
 * `ank.hasClaim` is a disjunction and never a count: several corpora are
 * several repositories, and a number across them would be a fiction.
 */
async function announce(registry: CorpusRegistry): Promise<void> {
  const held = registry.corpora.some((corpus) => corpus.snapshot?.status.claim != null);
  await setContext('ank.hasCorpus', !registry.empty);
  await setContext('ank.hasClaim', held);
}

function setContext(key: string, value: boolean): Thenable<unknown> {
  return vscode.commands.executeCommand('setContext', key, value);
}

/**
 * Locates the binary and asks it what it can do.
 *
 * A binary that is absent is exit 9 territory: an environment to repair, not a
 * corpus that is broken. It is reported once, with the install line, and the
 * extension stays loaded rather than throwing out of activation -- the user
 * may install ank and reload without hunting for a setting.
 */
async function open(sink: Log): Promise<Binary | undefined> {
  const settings = vscode.workspace.getConfiguration('ank');
  const configured = settings.get<string>('path', '');
  const agent = settings.get<string>('agent', '');

  try {
    const located = await locate([configured, 'ank'], sink);
    const cli = new AnkCli(located.binary, sink, environment(agent));
    const capabilities = await Capabilities.probe(cli);
    return { cli, located, capabilities };
  } catch (error) {
    reportMissingBinary(sink, error);
    return undefined;
  }
}

/**
 * The identity this window writes under.
 *
 * `ANK_AGENT` falls back to `<user>@<hostname>`, and that fallback is the
 * thing to override: two windows on one tree with no distinct identities are
 * one agent as far as the claim refs are concerned, so they share a claim
 * instead of arbitrating over it and the second is quietly refused work it
 * should have been given.
 */
function environment(configured: string): Record<string, string> {
  const agent =
    configured.trim() !== '' ? configured.trim() : `vscode/${vscode.version}@${machine()}`;
  return { ANK_AGENT: agent };
}

/**
 * A stable name for this installation.
 *
 * The hostname would read better in `ank status`, and it is also a real
 * machine name written into a ref that may be pushed to a shared remote. The
 * editor already carries an opaque id that is stable across a rename, so that
 * is what goes in.
 */
function machine(): string {
  return vscode.env.machineId.slice(0, 8);
}

function reportMissingBinary(sink: Log, error: unknown): void {
  const message = error instanceof AnkError ? error.message : 'ank could not be started';
  sink.error(message);

  const install = 'Copy install command';
  const showLog = 'Show Log';
  void vscode.window.showWarningMessage(`${message}.`, install, showLog).then((chosen) => {
    if (chosen === install) {
      void vscode.env.clipboard.writeText(INSTALL_HINT);
    } else if (chosen === showLog) {
      sink.show();
    }
  });
}
