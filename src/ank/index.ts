/**
 * The adapter's public surface.
 *
 * Nothing under `src/ank/` imports `vscode`, so everything here is testable
 * without an editor and nothing above it needs to know a process is involved.
 */

export { AnkCli } from './cli';
export type { Answer, CorpusAddress, RawResult, RunOptions, Sink } from './cli';

export { ContractError, isVersionMismatch, parseDocument } from './contract';

export {
  AnkError,
  ExitCode,
  isRetryable,
  parseRefusal,
  parseWarnings,
  refusalFrom,
  senseOf,
} from './errors';

export { Capabilities } from './help';

export { INSTALL_HINT, locate } from './locate';
export type { Located } from './locate';

export {
  Ank,
  declareCorpus,
  help,
  init,
  RENEWING_VERBS,
  REPAINT_VERBS,
  WRITING_VERBS,
} from './verbs';
export type {
  AmendOptions,
  EditOptions,
  FindOptions,
  NewEntityOptions,
  Proof,
} from './verbs';

export * from './types';
