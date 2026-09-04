/**
 * The documents `ank --json` returns.
 *
 * Every interface here is transcribed from the `returns` list that
 * `ank help --json` publishes, which is generated from the same table the
 * binary dispatches from and therefore cannot fall behind it. The conformance
 * test walks that table against the golden fixtures, so a shape that drifts
 * here is a failing test rather than a bug that surfaces in a view.
 *
 * Two rules from the contract are visible in the shapes:
 *
 * - `nullable` is separate from the type. A nullable field is `T | null` and
 *   never `T | undefined`: `null` and the empty string are different answers,
 *   and `status.branch` is null on a detached HEAD while `status.refs` is null
 *   rather than zero unless `--remote` was passed.
 * - A document may gain a field within a contract version. Nothing here is
 *   exhaustive, and no parser refuses a field it does not know.
 */

/** The contract version this client is written against. */
export const CONTRACT_VERSION = 1;

/** Every top-level document leads with the contract version. */
export interface AnkDocument {
  contract: number;
}

/* -------------------------------------------------------------- shared rows */

/** A `blocked_by` or `unblocks` edge. Status and title are null on a dangling id. */
export interface Edge {
  id: string;
  short: string;
  status: string | null;
  title: string | null;
}

/** A proof recorded in `refs/ank/proof/<id>` rather than in the entity. */
export interface DetachedProof {
  type: string;
  ref: string;
  by: string;
  at: string;
}

/**
 * One line of a task's history.
 *
 * `records` splits the work trace from the machinery: it is null on an entry a
 * holder wrote, and names what it records on an entry a verb wrote.
 */
export interface LogEntry {
  id: string | null;
  timestamp: string;
  who: string;
  message: string;
  records: string | null;
}

/* ------------------------------------------------------------------ context */

export interface ContextConstraint {
  id: string;
  short: string;
  title: string;
  constraint: string;
  home: string | null;
}

export interface ContextProposed {
  id: string;
  short: string;
  title: string;
  home: string | null;
}

export interface ContextSpec {
  id: string;
  short: string;
  title: string;
}

export interface ContextTask {
  id: string;
  short: string;
  title: string;
  status: string;
  ready: boolean;
  /** How many other tasks finishing this one would unblock. The sort key. */
  unblocks: number;
  state: string;
}

export interface ContextDocument extends AnkDocument {
  /** `orientation` with no claim held; the execution mode is the other value. */
  mode: string;
  head: string | null;
  criteria: string | null;
  constraints: ContextConstraint[];
  proposed: ContextProposed[];
  specs: ContextSpec[];
  tasks: ContextTask[];
  log: string[];
  ready: number;
  blocked: number;
  finished_elsewhere: number;
  warnings: string[];
}

/* ------------------------------------------------------------------- status */

export interface Identity {
  value: string;
  source: string;
}

export interface HeldClaim {
  id: string;
  expires: string;
  lapsed: boolean;
}

export interface Drift {
  branch: string;
  entities: number;
}

export interface AlsoHeld {
  id: string;
  expires: string;
}

export interface RefsSummary {
  stale: number;
  absent: number;
}

export interface ClaimElsewhere {
  id: string;
  title: string | null;
  holder: string | null;
  expires: string | null;
  seen: string | null;
}

export interface StatusDocument extends AnkDocument {
  /** The repository identity: the root commit. Null in a tree with no history. */
  corpus: string | null;
  branch: string | null;
  default_branch: string | null;
  identity: Identity;
  claim: HeldClaim | null;
  drift: Drift | null;
  also_held: AlsoHeld[];
  remote: boolean;
  /** Null unless `--remote` was passed. Null is not zero. */
  refs: RefsSummary | null;
  elsewhere: ClaimElsewhere[];
  constraints: number;
  queue: number;
  unmerged: number;
  faults: number;
  signals: number;
}

/* --------------------------------------------------------------------- find */

export interface FindResult {
  id: string;
  kind: string;
  /** The stored status. */
  status: string;
  /** The resolved state: a claimed open task reads `claimed:who@host`. */
  state: string;
  title: string;
  created: string;
}

export interface FindDocument extends AnkDocument {
  corpus: string | null;
  total: number;
  shown: number;
  hidden: number;
  results: FindResult[];
}

/* -------------------------------------------------------------------- graph */

export interface GraphTask {
  id: string;
  short: string;
  status: string;
  title: string;
}

export interface GraphEdge {
  task: string;
  blocked_by: string;
}

export interface GraphDocument extends AnkDocument {
  path: string;
  tasks: GraphTask[];
  edges: GraphEdge[];
}

/* -------------------------------------------------------------------- scope */

export interface ScopeRow {
  id: string;
  kind: string;
  status: string;
  title: string;
}

export interface ScopeDocument extends AnkDocument {
  path: string;
  total: number;
  adr: ScopeRow[];
  specs: ScopeRow[];
  tasks: ScopeRow[];
}

/* --------------------------------------------------------------------- show */

/** The fields `show` returns over an ADR, a spec or a log entry. */
export interface ShowDocument extends AnkDocument {
  id: string;
  /** From the claim ref, never from the file. `claimed by tool/1.0`, or null. */
  coordination: string | null;
  detached_proofs: DetachedProof[];
  /** Counts the work trace and never the machinery. */
  log_total: number;
  log_shown: number;
  log: LogEntry[];
  machinery: LogEntry[];
  /** The entity file, byte for byte. */
  content: string;
}

/** The fields `show` returns over a task: the edges an ADR would carry empty. */
export interface ShowTaskDocument extends ShowDocument {
  blocked_by: Edge[];
  unblocks: Edge[];
}

/** Narrows a `show` document to the shape the verb returns over a task. */
export function isTaskDocument(doc: ShowDocument): doc is ShowTaskDocument {
  return Array.isArray((doc as ShowTaskDocument).blocked_by);
}

/* --------------------------------------------------------- the loop's verbs */

export interface ClaimInAnotherCorpus {
  task: string;
  /** The path the reader declared in corpora.yml, not a repository identity. */
  corpus: string;
  expires: string;
}

export interface ClaimDocument extends AnkDocument {
  task: string;
  holder: string;
  expires: string;
  warnings: string[];
  /** Present only where this identity holds a claim in a declared corpus. */
  claims_elsewhere?: ClaimInAnotherCorpus[];
}

export interface DoneDocument extends AnkDocument {
  task: string;
  status: string;
  commit: string;
  branch: string | null;
  proofs: number;
}

export interface ReleaseDocument extends AnkDocument {
  task: string;
  status: string;
  reason: string;
  warnings: string[];
}

export interface LogReadDocument extends AnkDocument {
  about: string;
  total: number;
  shown: number;
  entries: LogEntry[];
  machinery: LogEntry[];
}

export interface LogWriteDocument extends AnkDocument {
  about: string;
  entry: string;
  logged: boolean;
  warnings: string[];
}

/* --------------------------------------------------------- shaping the work */

export interface NewDocument extends AnkDocument {
  id: string;
  kind: string;
  created: string;
}

export interface AmendDocument extends AnkDocument {
  entity: string;
  amended: string[];
}

export interface EditDocument extends AnkDocument {
  entity: string;
  changed: string[];
  version: number;
}

export interface CloseDocument extends AnkDocument {
  task: string;
  status: string;
  claim_revoked: boolean;
}

export interface AcceptDocument extends AnkDocument {
  id: string;
  kind: string;
  status: string;
  superseded: string | null;
  commit: string;
  anchor: string;
}

export interface ReadDocument extends AnkDocument {
  entity: string;
  kind: string;
  by: string;
  at: string;
  readings: number;
}

export interface AttestDocument extends AnkDocument {
  task: string;
  appended: { type: string; ref: string };
  proofs: number;
}

/* ------------------------------------------------ keeping the corpus honest */

export interface FindingCharge {
  id: string;
  characters: number;
}

export interface Finding {
  /** `fault` or `signal`. Only a fault reaches exit 8. */
  level: string;
  /** An entity id, or a corpus-level subject such as `coordination`. */
  subject: string;
  message: string;
  note: string[];
  /** What this finding costs against the context budget, by entity. */
  charge: FindingCharge[];
}

export interface CheckDocument extends AnkDocument {
  faults: number;
  signals: number;
  tasks: number;
  adr: number;
  /** The claim refs this run deleted. `check` writes. */
  pruned: string[];
  findings: Finding[];
}

export interface ReviewProposed {
  id: string;
  title: string;
}

export interface ReviewSigner {
  principal: string;
  keytype: string;
}

export interface ReviewLive {
  id: string;
  title: string;
  files: number;
}

export interface ReviewDocument extends AnkDocument {
  proposed: ReviewProposed[];
  signers: ReviewSigner[];
  live: ReviewLive[];
  dead: number;
  faults: number;
  signals: number;
}

export interface MigrateDocument extends AnkDocument {
  files: number;
  entries: number;
  created: number;
}

/* --------------------------------------------------- setting up a repository */

export interface InitDocument extends AnkDocument {
  created: string[];
  wrote: string[];
  added: string[];
  changed: boolean;
}

export interface ConfigReadDocument extends AnkDocument {
  key: string;
  value: string | null;
  source: string;
}

export interface ConfigWriteDocument extends AnkDocument {
  key: string;
  previous: string | null;
  value: string | null;
  changed: boolean;
}

/* ---------------------------------------------------------------------- tui */

export interface TuiClaim {
  id: string;
  short: string;
  holder: string;
  expires: string;
  mine: boolean;
}

export interface TuiEntity {
  id: string;
  short: string;
  kind: string;
  status: string;
  title: string;
}

export interface TuiDocument extends AnkDocument {
  corpus: string;
  branch: string;
  default_branch: string;
  identity: string;
  total: number;
  shown: number;
  claims: TuiClaim[];
  entities: TuiEntity[];
}

/* --------------------------------------------------------------------- help */

export interface VerbFlag {
  name: string;
  /** The short form with its dash, `-c`, or null where there is none. */
  short: string | null;
  takes_value: boolean;
  repeatable: boolean;
}

export interface VerbRefusal {
  code: number;
  when: string;
}

/** The closed six-word type vocabulary the shape system publishes. */
export type ShapeType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'string[]'
  | 'object'
  | 'object[]';

export interface ShapeField {
  /** A dotted path: `tasks`, then `tasks.id`. No key contains a dot. */
  name: string;
  type: ShapeType;
  nullable: boolean;
}

export interface VerbShape {
  /** The call that returns this shape, or null where the verb has one. */
  when: string | null;
  fields: ShapeField[];
}

export interface Verb {
  name: string;
  usage: string;
  summary: string;
  group: string;
  flags: VerbFlag[];
  notes: string[];
  refuses: VerbRefusal[];
  /** Empty for `mcp` and `watch`, which emit no document. */
  returns: VerbShape[];
}

export interface HelpDocument extends AnkDocument {
  verbs: Verb[];
}
