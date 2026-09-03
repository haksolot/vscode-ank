/**
 * How a finding is classified, decided without an editor.
 *
 * Two small judgements that are easy to get backwards and worth asserting on
 * their own: which subjects name an entity, and which level is an error.
 */

/** An id, as ank writes them: a kind and twelve hex characters. */
const ENTITY_ID = /^(TASK|ADR|SPEC|LOG)-[0-9a-f]{12}$/;

/**
 * True where a finding is about an entity rather than about the corpus.
 *
 * `check` also reports on `allowed_signers` and `coordination`, which are
 * facts about the repository and not about anything the corpus contains.
 */
export function isEntitySubject(subject: string): boolean {
  return ENTITY_ID.test(subject);
}

/** What a level means for the Problems panel. */
export type Weight = 'error' | 'information';

/**
 * A fault is an error. A signal is information, and deliberately not a warning.
 *
 * Signals alone leave the exit code 0, and reddening a build over an
 * observation teaches a team to stop reading `check` -- which is the verb that
 * catches a frozen criterion diverging, so it is the last one to train people
 * to filter out.
 */
export function weightOf(level: string): Weight {
  return level === 'fault' ? 'error' : 'information';
}
