/**
 * Which verbs are offered to a language model, and under what name.
 *
 * Kept apart from the registration so the read-only rule can be checked by
 * `node --test`: the assertion that matters is about this list, and it should
 * not need an editor to run.
 */

/** The verbs offered as tools. Every one of them reads (ADR-5c7baf6259ca). */
export const OFFERED_VERBS = [
  'context',
  'find',
  'show',
  'scope',
  'status',
  'graph',
] as const;

export type OfferedVerb = (typeof OFFERED_VERBS)[number];

/**
 * The tool name for a verb.
 *
 * `ank_<verb>`, because a bare `context` collides with every other server a
 * client has loaded and `ank context` is not a legal tool name. The MCP
 * surface names its tools the same way, so a model that has met one recognises
 * the other.
 */
export function toolName(verb: string): string {
  return `ank_${verb}`;
}
