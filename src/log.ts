import * as vscode from 'vscode';

/**
 * The extension's single output channel.
 *
 * Everything the extension wants a human to be able to read after the fact
 * goes here: every command line handed to the binary, every non-zero exit and
 * the stderr that came with it. A user reporting a bug should be able to paste
 * this channel and have it be enough.
 */
export class Log implements vscode.Disposable {
  private readonly channel: vscode.LogOutputChannel;

  constructor() {
    this.channel = vscode.window.createOutputChannel('ank', { log: true });
  }

  info(message: string, ...args: unknown[]): void {
    this.channel.info(message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.channel.warn(message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.channel.error(message, ...args);
  }

  /** Reveals the channel without stealing focus from the editor. */
  show(): void {
    this.channel.show(true);
  }

  dispose(): void {
    this.channel.dispose();
  }
}
