/**
 * Running a verb on somebody's behalf, and telling them what happened.
 *
 * A refusal is a fact about the corpus, not a crash, and the codes carry which
 * kind of fact it is. Four of them get a reaction of their own here:
 *
 * - **3** means somebody moved. Read again and retry, once. A loop that
 *   retried forever would be arguing with a corpus that has moved on.
 * - **4** means take something else. It is offered with the alternatives in
 *   hand rather than reported as a failure.
 * - **8** is findings from `check` or `review`. Not an error at all.
 * - **9** is the environment to repair, and must never be worded as though
 *   the work had failed.
 *
 * Every refusal names the exact command to run next on stderr. That hint is
 * offered as a button, and it is never what the code branches on.
 */

import * as vscode from 'vscode';

import { AnkError, ExitCode } from '../ank';
import type { Corpus } from '../corpus/corpus';
import type { Log } from '../log';

export interface Attempt<T> {
  /** What the user asked for, in a few words, for the message. */
  what: string;
  corpus: Corpus;
  log: Log;
  run: () => Promise<T>;
  /** Offered on exit 4, where taking something else is the right move. */
  alternatives?: () => Promise<void>;
}

/**
 * Runs a verb, reporting a refusal rather than throwing it.
 *
 * Returns undefined where the corpus said no, so a caller can stop without
 * having to know which code it was.
 */
export async function attempt<T>(options: Attempt<T>): Promise<T | undefined> {
  try {
    return await options.run();
  } catch (error) {
    if (!(error instanceof AnkError)) {
      options.log.error(`${options.what}: ${String(error)}`);
      void vscode.window.showErrorMessage(`${options.what} failed: ${String(error)}`);
      return undefined;
    }

    if (error.code === ExitCode.Conflict) {
      // Somebody moved. Read again and try once more; the second refusal is
      // reported like any other.
      options.log.info(`${options.what}: the entity moved, reading again`);
      await options.corpus.refresh();
      try {
        return await options.run();
      } catch (second) {
        await report(options, second);
        return undefined;
      }
    }

    await report(options, error);
    return undefined;
  }
}

async function report<T>(options: Attempt<T>, error: unknown): Promise<void> {
  if (!(error instanceof AnkError)) {
    void vscode.window.showErrorMessage(`${options.what} failed: ${String(error)}`);
    return;
  }

  options.log.warn(`${options.what}: error[${String(error.code)}] ${error.message}`);

  const buttons: string[] = [];
  const copyHint = 'Copy next command';
  const takeAnother = 'What is takeable?';
  const showLog = 'Show Log';

  if (error.code === ExitCode.Unavailable && options.alternatives) {
    buttons.push(takeAnother);
  }
  if (error.hint !== null) {
    buttons.push(copyHint);
  }
  buttons.push(showLog);

  // 9 is the environment and not the work, so it is a warning rather than an
  // error: nothing the user wrote is wrong.
  const show =
    error.code === ExitCode.Environment
      ? vscode.window.showWarningMessage
      : vscode.window.showErrorMessage;

  const chosen = await show(`${error.message} (${error.sense})`, ...buttons);

  if (chosen === copyHint && error.hint !== null) {
    await vscode.env.clipboard.writeText(error.hint);
  } else if (chosen === takeAnother && options.alternatives) {
    await options.alternatives();
  } else if (chosen === showLog) {
    options.log.show();
  }
}

/**
 * Asks for a line of text, refusing an empty one.
 *
 * Several verbs take a reason that is mandatory, and the reason is the whole
 * point of them: a closure nobody explained is one nobody can reopen.
 */
export async function ask(options: {
  title: string;
  prompt: string;
  placeHolder?: string | undefined;
  value?: string | undefined;
  required?: boolean | undefined;
}): Promise<string | undefined> {
  const answer = await vscode.window.showInputBox({
    title: options.title,
    prompt: options.prompt,
    ...(options.placeHolder === undefined ? {} : { placeHolder: options.placeHolder }),
    ...(options.value === undefined ? {} : { value: options.value }),
    ignoreFocusOut: true,
    validateInput: (text) =>
      options.required !== false && text.trim() === ''
        ? 'This cannot be empty.'
        : undefined,
  });

  const trimmed = answer?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}

/**
 * A quick pick row, with absent fields left out rather than set to undefined.
 *
 * `exactOptionalPropertyTypes` draws a real distinction between a field that
 * is missing and one that is present and undefined, and the editor's own types
 * take the first. This keeps the call sites readable instead of scattering
 * conditional spreads through every list.
 */
export function row<T extends object>(
  fields: {
    label: string;
    description?: string | null | undefined;
    detail?: string | null | undefined;
    kind?: vscode.QuickPickItemKind;
  } & T,
): vscode.QuickPickItem & T {
  const built: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) {
      built[key] = value;
    }
  }
  return built as vscode.QuickPickItem & T;
}

/** A yes that has to be typed rather than clicked past. */
export async function confirm(message: string, act: string): Promise<boolean> {
  const chosen = await vscode.window.showWarningMessage(
    message,
    { modal: true },
    act,
  );
  return chosen === act;
}
