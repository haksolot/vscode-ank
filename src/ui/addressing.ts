/**
 * What a command was pointed at.
 *
 * Three surfaces point a command at an entity, and none of them hands over the
 * same thing. A tree row's own `command` carries an `EntityRef`, because we
 * wrote that argument list ourselves. A context menu carries the node instead
 * -- the editor hands back the element the provider returned, not what we hung
 * on it -- so the address is one field down. The panel posts a corpus and an
 * id, which is a ref already.
 *
 * Getting this wrong is not a crash, which is what makes it worth a file and a
 * test: the command falls through to a picker and asks which entity, which is
 * the one thing the user said by right-clicking that row.
 *
 * Nothing here imports `vscode`. The shapes are ours, the rule is arithmetic
 * on them, and an editor is not needed to say whether it holds.
 */

import type { EntityRef } from './tree';

/** The address carried by whatever a surface handed over, if it carries one. */
export function refIn(given: unknown): EntityRef | undefined {
  if (typeof given !== 'object' || given === null) {
    return undefined;
  }

  // A node first: it is both a `TreeItem` with an `id` of its own and a
  // carrier of a ref, so asking it about the ref before asking about its shape
  // is what keeps the node's id from being read as an entity's.
  const carried = (given as { ref?: unknown }).ref;
  if (isRef(carried)) {
    return carried;
  }

  return isRef(given) ? given : undefined;
}

/**
 * An address is a pair, never an id alone.
 *
 * Two corpora may carry ids that look alike and nothing merges their claim
 * spaces, so a value with an id and no corpus is not half an address: it is
 * none.
 */
function isRef(value: unknown): value is EntityRef {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<EntityRef>;
  return typeof candidate.id === 'string' && candidate.corpus !== undefined;
}
