import * as vscode from 'vscode';

import { AnkCli, AnkError, Capabilities, INSTALL_HINT, locate } from './ank';
import type { Located } from './ank';
import { Log } from './log';

/**
 * What the extension resolved at activation.
 *
 * Held so the layers built on top of it can be handed one adapter rather than
 * each locating the binary again.
 */
export interface Session {
  cli: AnkCli;
  located: Located;
  capabilities: Capabilities;
}

let log: Log | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  log = new Log();
  context.subscriptions.push(log);

  context.subscriptions.push(
    vscode.commands.registerCommand('ank.showLog', () => log?.show()),
  );

  const session = await open(log);
  await vscode.commands.executeCommand(
    'setContext',
    'ank.hasBinary',
    session !== undefined,
  );

  if (session) {
    log.info(
      `ank ${session.located.version} at ${session.located.binary}, ` +
        `${String(session.capabilities.verbs.length)} verbs`,
    );
  }
}

export function deactivate(): void {
  // Everything this extension owns is on `context.subscriptions`, which the
  // host disposes for us. Nothing is left to unwind by hand.
}

/**
 * Locates the binary and asks it what it can do.
 *
 * A binary that is absent is exit 9 territory: an environment to repair, not a
 * corpus that is broken. It is reported once, with the install line, and the
 * extension stays loaded rather than throwing out of activation -- the user
 * may install ank and reload without hunting for a setting.
 */
async function open(sink: Log): Promise<Session | undefined> {
  const configured = vscode.workspace.getConfiguration('ank').get<string>('path', '');
  const agent = vscode.workspace.getConfiguration('ank').get<string>('agent', '');

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
      : `vscode/${vscode.version}@${hostname()}`;
  return { ANK_AGENT: agent };
}

function hostname(): string {
  // `os.hostname()` would do, but the machine id VS Code already carries is
  // stable across a rename and is not a name to leak into a shared ref.
  return vscode.env.machineId.slice(0, 8);
}

function reportMissingBinary(sink: Log, error: unknown): void {
  const message =
    error instanceof AnkError ? error.message : 'ank could not be started';
  sink.error(message);

  const install = 'Copy install command';
  void vscode.window
    .showWarningMessage(`${message}.`, install, 'Show Log')
    .then((chosen) => {
      if (chosen === install) {
        void vscode.env.clipboard.writeText(INSTALL_HINT);
      } else if (chosen === 'Show Log') {
        sink.show();
      }
    });
}
