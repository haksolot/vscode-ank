import * as vscode from 'vscode';
import { Log } from './log';

let log: Log | undefined;

export function activate(context: vscode.ExtensionContext): void {
  log = new Log();
  context.subscriptions.push(log);

  context.subscriptions.push(
    vscode.commands.registerCommand('ank.showLog', () => log?.show()),
  );

  log.info('ank activated');
}

export function deactivate(): void {
  // Everything this extension owns is on `context.subscriptions`, which the
  // host disposes for us. Nothing is left to unwind by hand.
}
