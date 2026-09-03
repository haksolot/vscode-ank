import * as vscode from 'vscode';

import { AnkCli, AnkError, Capabilities, INSTALL_HINT, locate } from './ank';
import type { Located } from './ank';
import { CorpusRegistry } from './corpus/registry';
import { Log } from './log';

/**
 * What the extension resolved at activation.
 *
 * Held so the layers built on top of it are handed one adapter rather than
 * each locating the binary again.
 */
export interface Session {
  cli: AnkCli;
  located: Located;
  capabilities: Capabilities;
  registry: CorpusRegistry;
}

let log: Log | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  log = new Log();
  context.subscriptions.push(log);

  context.subscriptions.push(
    vscode.commands.registerCommand('ank.showLog', () => log?.show()),
  );

  const opened = await open(log);
  await setContext('ank.hasBinary', opened !== undefined);

  if (!opened) {
    return;
  }

  const { cli, located, capabilities } = opened;
  log.info(
    `ank ${located.version} at ${located.binary}, ` +
      `${String(capabilities.verbs.length)} verbs`,
  );

  const registry = new CorpusRegistry(cli, log);
  context.subscriptions.push(registry);

  context.subscriptions.push(
    registry.onDidChange(() => {
      void announce(registry);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('ank.refresh', async () => {
      await Promise.all(registry.corpora.map((corpus) => corpus.refresh()));
    }),
  );

  await registry.start();
  await announce(registry);
}

export function deactivate(): void {
  // Everything this extension owns is on `context.subscriptions`, which the
  // host disposes for us. Nothing is left to unwind by hand.
}

/**
 * The context keys the manifest gates commands and views on.
 *
 * `ank.hasClaim` is true where any open corpus reports a claim held by this
 * identity. It is a disjunction and never a count: several corpora are several
 * repositories, and a number across them would be a fiction.
 */
async function announce(registry: CorpusRegistry): Promise<void> {
  const held = registry.corpora.some(
    (corpus) => corpus.snapshot?.status.claim != null,
  );
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
async function open(
  sink: Log,
): Promise<Omit<Session, 'registry'> | undefined> {
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
    configured.trim() !== ''
      ? configured.trim()
      : `vscode/${vscode.version}@${machine()}`;
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
  const message =
    error instanceof AnkError ? error.message : 'ank could not be started';
  sink.error(message);

  const install = 'Copy install command';
  const showLog = 'Show Log';
  void vscode.window
    .showWarningMessage(`${message}.`, install, showLog)
    .then((chosen) => {
      if (chosen === install) {
        void vscode.env.clipboard.writeText(INSTALL_HINT);
      } else if (chosen === showLog) {
        sink.show();
      }
    });
}
