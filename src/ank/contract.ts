/**
 * The gate every document passes before its other fields are read.
 *
 * `"contract": 1` leads every `--json` document and is the field to read
 * before deciding you can read the rest. It is not the version of the binary:
 * `ank --version` says which build is in hand, this says which shapes came out
 * of it, and a release that changes no document leaves it untouched.
 *
 * Within one version a document may gain a field, and may never lose, rename
 * or retype one. Both halves matter here. Nothing in this file validates a
 * document against a list of expected keys, because a parser that refused an
 * unknown field would turn a compatible ank release into a broken extension.
 */

import { CONTRACT_VERSION, type AnkDocument } from './types';

/** Raised where stdout carried something that is not an ank document. */
export class ContractError extends Error {
  override readonly name = 'ContractError';

  constructor(
    message: string,
    /** The version the document declared, where it declared one. */
    readonly declared: number | null,
  ) {
    super(message);
  }
}

/**
 * Parses one line of stdout into a document of the expected shape.
 *
 * The cast is deliberate and is the one place this client trusts the binary.
 * What justifies it is not optimism: the shapes are pinned by upstream golden
 * fixtures, and the conformance test in this repository walks the same
 * fixtures against the same interfaces. A field that moved fails there, at
 * build time, rather than here at runtime in front of a user.
 */
export function parseDocument<T extends AnkDocument>(stdout: string): T {
  const text = stdout.trim();
  if (text === '') {
    // A refusal leaves stdout empty. Reaching here with nothing to read means
    // a caller treated a non-zero exit as an answer.
    throw new ContractError('ank returned no document', null);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ContractError('ank returned something that is not JSON', null);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ContractError('ank returned JSON that is not a document', null);
  }

  const declared = (parsed as { contract?: unknown }).contract;
  if (typeof declared !== 'number') {
    throw new ContractError('the document carries no contract version', null);
  }

  if (declared !== CONTRACT_VERSION) {
    throw new ContractError(
      `this extension reads contract ${String(CONTRACT_VERSION)}, and ank answered with ${String(declared)}`,
      declared,
    );
  }

  return parsed as T;
}

/**
 * True where a version mismatch is the reason a document was refused.
 *
 * A mismatch is not a bug to report and not a corpus to repair: it means the
 * binary and this extension are at different points in history, and the answer
 * is to update one of them. The UI says exactly that, once, and degrades
 * rather than guessing at shapes it was not written against.
 */
export function isVersionMismatch(error: unknown): error is ContractError {
  return error instanceof ContractError && error.declared !== null;
}
