/**
 * Every verb, as a command.
 *
 * The registration is generated from the verb table rather than from a list
 * kept here, so a command contributed against a verb an older binary lacks is
 * disabled instead of failing when it is clicked.
 *
 * `accept` is the one verb with no command that runs it. It promotes a
 * proposed decision through a signed ratification commit, and it is a human
 * act (ADR-ea0325308b32). The command composes the line into a terminal and
 * leaves it unsent, which is the same move `ank tui` makes for every write it
 * offers: nothing runs until the line is on the screen and confirmed.
 */

import * as vscode from 'vscode';

import type { AnkCli, Capabilities, CheckDocument } from '../ank';
import type { Corpus } from '../corpus/corpus';
import type { CorpusRegistry } from '../corpus/registry';
import type { Log } from '../log';
import type { EntityDocumentProvider } from '../providers/entityDocument';
import { registerHonest } from './honest';
import { registerLoop } from './loop';
import { registerLook } from './look';
import { registerShape } from './shape';

export interface CommandContext {
  registry: CorpusRegistry;
  capabilities: Capabilities;
  documents: EntityDocumentProvider;
  log: Log;
  /** The adapter, for the one verb that addresses no corpus yet. */
  cli: AnkCli;
  /** Reopens an entity after a verb changed it. */
  reveal: (corpus: Corpus, id: string) => Promise<void>;
  /** Hands findings to whatever renders them. */
  onFindings: (corpus: Corpus, document: CheckDocument) => void;
}

/**
 * Registers what this binary can actually do, and answers what it registered.
 *
 * The returned set is handed to the detail panel so it offers a button only
 * for a command that exists.
 */
export function registerCommands(
  context: vscode.ExtensionContext,
  shared: CommandContext,
): ReadonlySet<string> {
  const registered = new Set<string>();

  const register = (
    id: string,
    verb: string | null,
    handler: (...args: unknown[]) => unknown,
  ): void => {
    if (verb !== null && !shared.capabilities.has(verb)) {
      shared.log.warn(`${id} is not registered: this ank has no ${verb} verb`);
      return;
    }
    context.subscriptions.push(
      vscode.commands.registerCommand(id, handler),
    );
    registered.add(id);
  };

  registerLoop(register, shared);
  registerShape(register, shared);
  registerLook(register, shared);
  registerHonest(register, shared);

  return registered;
}

export type Register = (
  id: string,
  verb: string | null,
  handler: (...args: unknown[]) => unknown,
) => void;

/**
 * Composes a command line into a terminal without sending it.
 *
 * The one route for a verb this extension will not run on somebody's behalf.
 */
export function compose(corpus: Corpus, argv: readonly string[]): void {
  const terminal = vscode.window.createTerminal({
    name: 'ank',
    cwd: corpus.folder.uri,
  });
  terminal.show();
  // `false` is the whole point: the line is written and not sent.
  terminal.sendText(['ank', ...argv].join(' '), false);
}
