/**
 * One typed wrapper per verb.
 *
 * The argument vectors are built here and nowhere else. Because the process is
 * started with `execFile` and an array, a title carrying a quote, a newline or
 * a semicolon is just a string: there is no shell to protect against and
 * nothing is escaped on the way through.
 */

import type { AnkCli, Answer, CorpusAddress, RunOptions } from './cli';
import { ExitCode } from './errors';
import type {
  AcceptDocument,
  AmendDocument,
  AttestDocument,
  CheckDocument,
  ClaimDocument,
  CloseDocument,
  ConfigReadDocument,
  ConfigWriteDocument,
  ContextDocument,
  DoneDocument,
  EditDocument,
  FindDocument,
  GraphDocument,
  HelpDocument,
  InitDocument,
  LogReadDocument,
  LogWriteDocument,
  MigrateDocument,
  NewDocument,
  ReadDocument,
  ReleaseDocument,
  ReviewDocument,
  ScopeDocument,
  ShowDocument,
  StatusDocument,
} from './types';

/**
 * The verbs that renew a claim when the caller holds the task.
 *
 * `show`, `read`, `amend`, `attest` and `edit` renew the task their id names;
 * `context` in execution mode renews the task the caller holds. None of them
 * may be reached from a repaint: a view that polled one would keep a claim
 * alive in front of an empty chair, and no other agent could take the work.
 */
export const RENEWING_VERBS: ReadonlySet<string> = new Set([
  'context',
  'show',
  'read',
  'amend',
  'attest',
  'edit',
]);

/**
 * The verbs that change something outside this process.
 *
 * `check` is in the list because it prunes stale claim refs, which is a write
 * to the coordination plane and the one plane where losing a record loses a
 * fact nothing else carries.
 */
export const WRITING_VERBS: ReadonlySet<string> = new Set([
  'accept',
  'amend',
  'attest',
  'check',
  'claim',
  'close',
  'config',
  'done',
  'edit',
  'init',
  'log',
  'migrate',
  'new',
  'read',
  'release',
]);

/**
 * The only verbs an unattended refresh may run.
 *
 * All three are pure reads: none renews a lease and none writes. `graph` is
 * here because blockedness is an edge and not a field -- a task waiting on
 * another is `open` in its file, and a view that showed it as plain `open`
 * would be true to the file and useless to the reader. The alternative was
 * `context`, which computes readiness and renews the caller's claim doing it.
 *
 * Anything else is reached from something a person just clicked.
 */
export const REPAINT_VERBS: ReadonlySet<string> = new Set([
  'status',
  'find',
  'graph',
]);

/** `done` runs the verifiers itself, which is a build and not a read. */
const VERIFIER_TIMEOUT_MS = 15 * 60_000;

/** `check` and `review` walk git history, so they are slower than a read. */
const HISTORY_TIMEOUT_MS = 120_000;

/** Exit 8 is findings: a successful answer that happens to carry faults. */
const FINDINGS_ANSWER = [ExitCode.Ok, ExitCode.Findings] as const;

export interface NewEntityOptions {
  title: string;
  /** Mandatory: an entity attached to nothing is invisible. */
  scope: readonly string[];
  criteria?: string;
  blockedBy?: readonly string[];
  constraint?: string;
  supersedes?: string;
  references?: readonly string[];
  /** Names the verifiers to run; omitted, the task takes the declared defaults. */
  verify?: readonly string[];
  noVerify?: boolean;
  body?: string;
}

export interface AmendOptions {
  blockedBy?: readonly string[];
  dropBlockedBy?: readonly string[];
  references?: readonly string[];
  dropReferences?: readonly string[];
  scope?: readonly string[];
  dropScope?: readonly string[];
  /** Refused while a live claim freezes the criterion. That case is a release. */
  criteria?: string;
}

export interface EditOptions {
  title?: string;
  body?: string;
  constraint?: string;
}

export interface FindOptions {
  type?: string;
  status?: string;
  scope?: string;
  /** Full-text rather than the structured fields. */
  free?: boolean;
}

/** `<type>:<ref>`, where type is commit, human-review, assertion or test. */
export type Proof = `${'commit' | 'human-review' | 'assertion' | 'test'}:${string}`;

/**
 * Every verb, bound to one corpus.
 *
 * One instance addresses one corpus and never more. Nothing on it reaches
 * across two: claims are per repository and no arbitration spans clones, so a
 * value computed over several corpora would be a fiction.
 */
export class Ank {
  constructor(
    private readonly cli: AnkCli,
    readonly address: CorpusAddress,
  ) {}

  /* ------------------------------------------------------- run the loop */

  /** What binds this perimeter and what is claimable. Renews a held claim. */
  async context(path?: string, limit?: number): Promise<ContextDocument> {
    const argv = ['context', ...positional(path), ...flag('--limit', limit)];
    return this.document<ContextDocument>(argv);
  }

  /** Takes the task and freezes its criterion by hash. */
  async claim(
    id: string,
    options: { criteria?: string; ttl?: string } = {},
  ): Promise<ClaimDocument> {
    const argv = [
      'claim',
      id,
      ...flag('--criteria', options.criteria),
      ...flag('--ttl', options.ttl),
    ];
    return this.document<ClaimDocument>(argv);
  }

  /** The entity whole. Renews the claim where the id is the held task. */
  async show(id: string): Promise<ShowDocument> {
    return this.document<ShowDocument>(['show', id]);
  }

  /** Reads a task's log. No claim needed. */
  async readLog(id: string): Promise<LogReadDocument> {
    return this.document<LogReadDocument>(['log', id]);
  }

  /** Appends to a task's log, which renews the claim. */
  async appendLog(id: string, message: string): Promise<Answer<LogWriteDocument>> {
    return this.cli.json<LogWriteDocument>(['log', id, message], this.options());
  }

  /** Runs the verifiers the task names and records the proof. */
  async done(id?: string, proof?: Proof): Promise<Answer<DoneDocument>> {
    const argv = ['done', ...positional(id), ...flag('--proof', proof)];
    return this.cli.json<DoneDocument>(argv, {
      ...this.options(),
      timeoutMs: VERIFIER_TIMEOUT_MS,
    });
  }

  /** Hands the task back, with the reason recorded in its log. */
  async release(id: string | undefined, reason: string): Promise<Answer<ReleaseDocument>> {
    const argv = ['release', ...positional(id), '--reason', reason];
    return this.cli.json<ReleaseDocument>(argv, this.options());
  }

  /* ----------------------------------------------------- shape the work */

  async create(
    kind: 'task' | 'adr' | 'spec',
    options: NewEntityOptions,
  ): Promise<NewDocument> {
    const argv = [
      'new',
      kind,
      '--title',
      options.title,
      ...repeated('--scope', options.scope),
      ...flag('--criteria', options.criteria),
      ...repeated('--blocked-by', options.blockedBy),
      ...flag('--constraint', options.constraint),
      ...flag('--supersedes', options.supersedes),
      ...repeated('--reference', options.references),
      ...repeated('--verify', options.verify),
      ...(options.noVerify === true ? ['--no-verify'] : []),
      ...flag('--body', options.body),
    ];
    return this.document<NewDocument>(argv);
  }

  /** The ratification queue and the health of the corpus. Walks git history. */
  async review(path?: string): Promise<Answer<ReviewDocument>> {
    return this.cli.json<ReviewDocument>(['review', ...positional(path)], {
      ...this.options(),
      answers: FINDINGS_ANSWER,
      timeoutMs: HISTORY_TIMEOUT_MS,
    });
  }

  /** Records that a person read this entity and stands behind it. */
  async markRead(id: string): Promise<ReadDocument> {
    return this.document<ReadDocument>(['read', id]);
  }

  /** Closes a task that will never be done. The reason is mandatory. */
  async close(id: string, reason: string): Promise<CloseDocument> {
    return this.document<CloseDocument>(['close', id, '--reason', reason]);
  }

  async amend(id: string, options: AmendOptions): Promise<Answer<AmendDocument>> {
    const argv = [
      'amend',
      id,
      ...repeated('--blocked-by', options.blockedBy),
      ...repeated('--drop-blocked-by', options.dropBlockedBy),
      ...repeated('--reference', options.references),
      ...repeated('--drop-reference', options.dropReferences),
      ...repeated('--scope', options.scope),
      ...repeated('--drop-scope', options.dropScope),
      ...flag('--criteria', options.criteria),
    ];
    return this.cli.json<AmendDocument>(argv, this.options());
  }

  /** Appends a proof to a finished task: the one write allowed after done. */
  async attest(id: string, proof: Proof, detached = false): Promise<AttestDocument> {
    const argv = ['attest', id, '--proof', proof, ...(detached ? ['--detached'] : [])];
    return this.document<AttestDocument>(argv);
  }

  /**
   * Promotes a proposed decision through a signed ratification commit.
   *
   * Present so the verb table stays complete and so a caller can read what it
   * would refuse. Nothing in this extension calls it: `accept` is a human act,
   * and the command layer composes the line into a terminal instead.
   */
  async accept(id: string): Promise<AcceptDocument> {
    return this.document<AcceptDocument>(['accept', id]);
  }

  /* ------------------------------------------------------- look around */

  /**
   * Searches titles, scopes and criteria.
   *
   * The query is optional where a filter narrows the search: `find --type
   * task` lists every task, which is what a listing view asks for.
   */
  async find(query?: string, options: FindOptions = {}): Promise<FindDocument> {
    const argv = [
      'find',
      ...positional(query),
      ...flag('--type', options.type),
      ...flag('--status', options.status),
      ...flag('--scope', options.scope),
      ...(options.free === true ? ['--free'] : []),
    ];
    return this.document<FindDocument>(argv);
  }

  async status(remote = false): Promise<StatusDocument> {
    return this.document<StatusDocument>(['status', ...(remote ? ['--remote'] : [])]);
  }

  async graph(path?: string): Promise<GraphDocument> {
    return this.document<GraphDocument>(['graph', ...positional(path)]);
  }

  /** What covers a path: constraints, specifications and tasks. */
  async scope(path: string): Promise<ScopeDocument> {
    return this.document<ScopeDocument>(['scope', path]);
  }

  /* --------------------------------------------- keep the corpus honest */

  /** Changes the content field named. Renews the claim over a held task. */
  async edit(id: string, options: EditOptions): Promise<EditDocument> {
    const argv = [
      'edit',
      id,
      ...flag('--title', options.title),
      ...flag('--body', options.body),
      ...flag('--constraint', options.constraint),
    ];
    return this.document<EditDocument>(argv);
  }

  /**
   * The mechanical invariants.
   *
   * This writes: it prunes the claim refs it finds stale. It also walks git
   * history. Never put it on a timer.
   */
  async check(path?: string): Promise<Answer<CheckDocument>> {
    return this.cli.json<CheckDocument>(['check', ...positional(path)], {
      ...this.options(),
      answers: FINDINGS_ANSWER,
      timeoutMs: HISTORY_TIMEOUT_MS,
    });
  }

  async migrate(): Promise<MigrateDocument> {
    return this.document<MigrateDocument>(['migrate']);
  }

  /* ------------------------------------------------ set up a repository */

  async readConfig(key: string): Promise<ConfigReadDocument> {
    return this.document<ConfigReadDocument>(['config', key]);
  }

  async writeConfig(key: string, value: string): Promise<ConfigWriteDocument> {
    return this.document<ConfigWriteDocument>(['config', key, value]);
  }

  async unsetConfig(key: string): Promise<ConfigWriteDocument> {
    return this.document<ConfigWriteDocument>(['config', key, '--unset']);
  }

  /** The human-readable rendering of a verb, for a terminal or a preview. */
  async plain(argv: readonly string[]): Promise<string> {
    const result = await this.cli.run(argv, this.options());
    return result.stdout;
  }

  private async document<T extends { contract: number }>(
    argv: readonly string[],
  ): Promise<T> {
    const answer = await this.cli.json<T>(argv, this.options());
    return answer.document;
  }

  private options(): RunOptions {
    return { address: this.address };
  }
}

/* ---------------------------------------- verbs that address no corpus yet */

/**
 * The verb table, which is the entry point for a client.
 *
 * It is generated from the same table the binary dispatches from, so it cannot
 * fall behind what the binary does. Reading it is how this extension learns
 * which verbs exist rather than holding a list of its own that would disagree.
 */
export async function help(cli: AnkCli, verb?: string): Promise<HelpDocument> {
  const answer = await cli.json<HelpDocument>(['help', ...positional(verb)]);
  return answer.document;
}

/**
 * Creates a corpus.
 *
 * The one verb that refuses `--repo`, because it makes the repository the flag
 * would have named. The target is positional.
 */
export async function init(
  cli: AnkCli,
  target: string,
  at?: string,
): Promise<InitDocument> {
  const answer = await cli.json<InitDocument>([
    'init',
    target,
    ...flag('--at', at),
  ]);
  return answer.document;
}

/**
 * Declares a corpus in the reader's own configuration.
 *
 * `--user` reads and writes `corpora.yml` rather than the repository's config,
 * and its only key is `corpora.<identity>`. The identity is the root commit,
 * which `status` prints under `corpus`; a path is never an identity.
 */
export async function declareCorpus(
  cli: AnkCli,
  identity: string,
  path: string,
): Promise<ConfigWriteDocument> {
  const answer = await cli.json<ConfigWriteDocument>([
    'config',
    '--user',
    `corpora.${identity}`,
    path,
  ]);
  return answer.document;
}

/* ------------------------------------------------------------- argv helpers */

function positional(value: string | undefined): string[] {
  return value === undefined ? [] : [value];
}

function flag(name: string, value: string | number | undefined): string[] {
  return value === undefined ? [] : [name, String(value)];
}

function repeated(name: string, values: readonly string[] | undefined): string[] {
  return (values ?? []).flatMap((value) => [name, value]);
}
