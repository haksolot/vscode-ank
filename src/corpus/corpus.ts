/**
 * One workspace folder carrying a corpus, held open.
 *
 * A `Corpus` addresses exactly one repository and never reaches across two.
 * Claims are per repository and `refs/ank/*` cannot carry an arbitration
 * between clones, so a value computed over several corpora would be a fiction
 * (ADR-3be7c0dd26d4). Multi-root windows get one of these per folder, and
 * whatever presents them together must not rank one against another.
 */

import * as vscode from 'vscode';

import { Ank, AnkError, type AnkCli } from '../ank';
import type { Log } from '../log';
import { EventStream, eventsPath, type AnkEvent } from './events';
import { Coalescer, repaint, repaintReader, type Snapshot } from './refresh';

export class Corpus implements vscode.Disposable {
  readonly ank: Ank;

  private readonly disposables: vscode.Disposable[] = [];
  private readonly changed = new vscode.EventEmitter<Corpus>();
  private readonly coalescer: Coalescer;
  private stream: EventStream | undefined;

  private latest: Snapshot | undefined;
  private failure: AnkError | undefined;

  /** Fires after every repaint, whether or not anything moved. */
  readonly onDidChange = this.changed.event;

  constructor(
    readonly folder: vscode.WorkspaceFolder,
    cli: AnkCli,
    private readonly log: Log,
  ) {
    this.ank = new Ank(cli, { repo: folder.uri.fsPath });
    this.coalescer = new Coalescer(() => this.read());
    this.disposables.push(this.changed, this.coalescer);
  }

  /** The last repaint, or undefined until the first one lands. */
  get snapshot(): Snapshot | undefined {
    return this.latest;
  }

  /** Why the last repaint failed, where it did. */
  get error(): AnkError | undefined {
    return this.failure;
  }

  /** The repository identity: the root commit. Null in a tree with no history. */
  get identity(): string | null {
    return this.latest?.status.corpus ?? null;
  }

  get name(): string {
    return this.folder.name;
  }

  /**
   * Starts watching, then reads once.
   *
   * Three sources of change, in order of preference, and no timer in any of
   * them. Where a watcher is running, `events.jsonl` says a corpus moved.
   * Where none is, a `FileSystemWatcher` observes that files under the corpus
   * changed -- observing is not reading, and the answer still comes from the
   * CLI. The refresh command is always there.
   */
  async open(): Promise<void> {
    this.followStream();
    this.watchFiles();
    await this.coalescer.now();
  }

  /** Asks for a repaint soon, coalescing whatever else is asking. */
  invalidate(): void {
    this.coalescer.request();
  }

  /** Asks for a repaint now and waits for it. */
  async refresh(): Promise<void> {
    await this.coalescer.now();
  }

  dispose(): void {
    this.stream?.dispose();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  /**
   * The one unattended read.
   *
   * It goes through `repaintReader`, which hands out two verbs. Nothing here
   * can reach `show` or `context` even by accident, which is the point: both
   * renew a lease.
   */
  private async read(): Promise<void> {
    try {
      this.latest = await repaint(repaintReader(this.ank));
      this.failure = undefined;
    } catch (error) {
      this.failure = error instanceof AnkError ? error : undefined;
      this.log.error(
        `${this.folder.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    this.changed.fire(this);
  }

  private followStream(): void {
    const file = eventsPath();
    if (file === null) {
      return;
    }

    this.stream = new EventStream(
      file,
      (events) => this.onEvents(events),
      (message) => this.log.warn(message),
    );
    this.stream.start();
  }

  /**
   * Answers an event by reading, and by reading only.
   *
   * An event never says what to do about itself. There is one sensible thing,
   * which is to read the corpus again, and the stream does not presume to say
   * so. It also carries no entity content, so there is nothing here to believe
   * instead of the CLI.
   */
  private onEvents(events: readonly AnkEvent[]): void {
    const mine = this.identity;
    if (mine === null) {
      // We do not know our own identity yet, so we cannot tell whose events
      // these are. Reading is cheap and answers the question.
      this.invalidate();
      return;
    }

    if (events.some((event) => event.corpus === mine)) {
      this.invalidate();
    }
  }

  /**
   * Observes that files under the corpus changed.
   *
   * The glob names `.ank/` and that is deliberate and permitted: nothing here
   * opens what changed. A watcher that told us a file moved and a reader that
   * parsed it are different things, and only the second reports a held task as
   * free.
   */
  private watchFiles(): void {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(this.folder, '.ank/**'),
    );

    this.disposables.push(
      watcher,
      watcher.onDidCreate(() => this.invalidate()),
      watcher.onDidChange(() => this.invalidate()),
      watcher.onDidDelete(() => this.invalidate()),
    );
  }
}
