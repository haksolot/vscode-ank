import * as vscode from 'vscode';

import { AnkCli, AnkError, Capabilities, INSTALL_HINT, locate } from './ank';
import type { Located } from './ank';
import { registerCommands } from './commands';
import { CorpusRegistry } from './corpus/registry';
import { registerTools } from './lm/tools';
import { Log } from './log';
import { AnkMcpProvider, declare, MCP_PROVIDER_ID } from './mcp/provider';
import {
  ANK_SCHEME,
  EntityDocumentProvider,
  entityOf,
  entityUri,
} from './providers/entityDocument';
import { Findings } from './providers/diagnostics';
import { EntityPanel } from './providers/entityPanel';
import { BindsView } from './ui/bindsView';
import { DecisionsView } from './ui/decisionsView';
import { GraphView } from './ui/graphView';
import { StatusBar } from './ui/statusBar';
import { TasksView } from './ui/tasksView';
import type { EntityRef } from './ui/tree';

/** What the extension resolved at activation. */
interface Binary {
  cli: AnkCli;
  located: Located;
  capabilities: Capabilities;
}

/**
 * The commands this build registered.
 *
 * The panel holds this set by reference and reads it when it renders, so a
 * command that registers after the panel was built is still offered. A button
 * for a command nothing implements is a button that fails when it is clicked.
 */
const offered = new Set<string>();

let log: Log | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  log = new Log();
  context.subscriptions.push(log);

  context.subscriptions.push(
    vscode.commands.registerCommand('ank.showLog', () => log?.show()),
  );

  const binary = await open(log);
  await setContext('ank.hasBinary', binary !== undefined);
  if (!binary) {
    return;
  }

  log.info(
    `ank ${binary.located.version} at ${binary.located.binary}, ` +
      `${String(binary.capabilities.verbs.length)} verbs`,
  );

  const registry = new CorpusRegistry(binary.cli, log);
  const documents = new EntityDocumentProvider(registry);
  const panel = new EntityPanel(context.extensionUri, offered);
  const findings = new Findings();
  context.subscriptions.push(registry, documents, panel, findings);

  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider(ANK_SCHEME, documents),
  );

  const tasks = new TasksView(registry);
  const decisions = new DecisionsView(registry);
  const graph = new GraphView(registry);
  const binds = new BindsView(registry, log);
  const statusBar = new StatusBar(registry);
  context.subscriptions.push(binds, statusBar);

  context.subscriptions.push(
    vscode.window.createTreeView('ank.tasks', { treeDataProvider: tasks }),
    vscode.window.createTreeView('ank.decisions', { treeDataProvider: decisions }),
    vscode.window.createTreeView('ank.graph', { treeDataProvider: graph }),
    vscode.window.createTreeView('ank.binds', { treeDataProvider: binds }),
  );

  context.subscriptions.push(
    registry.onDidChange(() => {
      // One repaint, four views. They all read the same snapshot, so a corpus
      // that moved is one read and not four.
      tasks.refresh();
      decisions.refresh();
      graph.refresh();
      void announce(registry);
    }),
  );

  for (const id of ['ank.showLog', 'ank.refresh', 'ank.open', 'ank.openFile', 'ank.status']) {
    offered.add(id);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('ank.refresh', async () => {
      await Promise.all(registry.corpora.map((corpus) => corpus.refresh()));
      documents.invalidateAll();
    }),
    vscode.commands.registerCommand('ank.open', (given: EntityRef | vscode.Uri) =>
      openEntity(given, registry, documents, panel, log as Log),
    ),
    vscode.commands.registerCommand('ank.openFile', (given: EntityRef | vscode.Uri) =>
      openFile(given, registry, documents, log as Log),
    ),
    vscode.commands.registerCommand('ank.status', () => showStatus(registry)),
  );

  const fromTable = registerCommands(context, {
    registry,
    capabilities: binary.capabilities,
    documents,
    log,
    cli: binary.cli,
    reveal: async (corpus, id) => {
      await openEntity(
        { corpus, id, kind: 'task', title: id },
        registry,
        documents,
        panel,
        log as Log,
      );
    },
    onFindings: (corpus, checked) => findings.report(corpus, checked),
  });

  for (const id of fromTable) {
    offered.add(id);
  }

  // The editor spawns `ank mcp` itself, with the binary this extension
  // resolved rather than the name on the PATH -- on Windows those differ, and
  // a configuration file naming `ank` would start a server nothing can spawn.
  const mcp = new AnkMcpProvider(registry, binary.located, agentOf());
  context.subscriptions.push(
    mcp,
    vscode.lm.registerMcpServerDefinitionProvider(MCP_PROVIDER_ID, mcp),
    registry.onDidChange(() => mcp.refresh()),
    vscode.commands.registerCommand('ank.declareCorpus', () =>
      declare(binary.cli, registry, log as Log),
    ),
  );
  offered.add('ank.declareCorpus');

  registerTools(context, registry, binary.capabilities);

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (saved) => {
      // Off by default, and never a timer even when on: `check` prunes claim
      // refs and walks git history, so it runs when somebody did something.
      if (!vscode.workspace.getConfiguration('ank').get<boolean>('check.onSave', false)) {
        return;
      }
      const corpus = registry.forUri(saved.uri);
      if (corpus && saved.uri.scheme === 'file') {
        await vscode.commands.executeCommand('ank.check');
      }
    }),
  );

  await registry.start();
  await announce(registry);
}

export function deactivate(): void {
  // Everything this extension owns is on `context.subscriptions`, which the
  // host disposes for us. Nothing is left to unwind by hand.
}

/**
 * Opens an entity: the panel, and no editor beside it.
 *
 * The panel is the whole entity -- the file's own body, and the things the
 * file cannot carry: who holds it, what it waits on, what it unblocks, its log
 * split from the machinery. The raw frontmatter is the occasional thing rather
 * than the default one, and the panel carries a button for it.
 *
 * Focus is left where it was, so arrowing down a tree repaints the panel
 * instead of stealing the keyboard on every row.
 */
async function openEntity(
  given: EntityRef | vscode.Uri | undefined,
  registry: CorpusRegistry,
  documents: EntityDocumentProvider,
  panel: EntityPanel,
  log: Log,
): Promise<void> {
  const ref = addressed(given, registry);
  if (!ref) {
    return;
  }

  try {
    // Fresh: clicking a row is an explicit read, and the corpus may have moved
    // since the last one.
    const shown = await documents.fetch(ref.corpus, ref.id, true);
    panel.reveal(ref.corpus, ref.id, shown);
  } catch (error) {
    reportRefusal(log, ref.id, error);
  }
}

/**
 * Opens the entity file itself, on the read-only `ank:` scheme.
 *
 * Reached from the panel's own button and from the inline action on a tree
 * row. It serves what `fetch` already holds, so it costs no second `show`.
 */
async function openFile(
  given: EntityRef | vscode.Uri | undefined,
  registry: CorpusRegistry,
  documents: EntityDocumentProvider,
  log: Log,
): Promise<void> {
  const ref = addressed(given, registry);
  if (!ref) {
    return;
  }

  try {
    await documents.fetch(ref.corpus, ref.id);
  } catch (error) {
    reportRefusal(log, ref.id, error);
    return;
  }

  const uri = entityUri(ref.corpus.folder.uri, ref.id);
  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.languages.setTextDocumentLanguage(document, 'markdown');
  await vscode.window.showTextDocument(document, { preview: true });
}

/**
 * What a command was pointed at.
 *
 * A tree row and the detail panel both hand over an `EntityRef`. An `ank:` uri
 * is accepted too, which is what a link in a rendered entity carries and what
 * a test can invoke with -- the scheme already names a corpus and an id, so
 * there is nothing to look up beyond which open corpus it belongs to.
 */
function addressed(
  given: EntityRef | vscode.Uri | undefined,
  registry: CorpusRegistry,
): EntityRef | undefined {
  if (!given) {
    return undefined;
  }

  if (given instanceof vscode.Uri) {
    const found = entityOf(given, registry);
    return found
      ? { corpus: found.corpus, id: found.id, kind: 'task', title: found.id }
      : undefined;
  }

  return given;
}

/** A refusal is a fact about the corpus, and it names what to run next. */
function reportRefusal(log: Log, id: string, error: unknown): void {
  if (!(error instanceof AnkError)) {
    log.error(`${id}: ${String(error)}`);
    void vscode.window.showErrorMessage(`${id} could not be read: ${String(error)}`);
    return;
  }

  log.warn(`${id}: error[${String(error.code)}] ${error.message}`);

  const copy = 'Copy next command';
  const buttons = error.hint === null ? [] : [copy];
  void vscode.window
    .showErrorMessage(`${error.message} (${error.sense})`, ...buttons)
    .then((chosen) => {
      if (chosen === copy && error.hint !== null) {
        void vscode.env.clipboard.writeText(error.hint);
      }
    });
}

/**
 * Where am I, in full.
 *
 * The status bar shows one line of this. The rest -- the drift from the
 * default branch, who holds what elsewhere, the counts -- is what a person
 * asks for by clicking it, and every value comes from the last repaint rather
 * than from a fresh read: `status` is a repaint verb, and the snapshot is
 * never more than one event old.
 */
async function showStatus(registry: CorpusRegistry): Promise<void> {
  const rows: vscode.QuickPickItem[] = [];

  for (const corpus of registry.corpora) {
    const snapshot = corpus.snapshot;
    if (!snapshot) {
      rows.push({ label: corpus.name, description: 'not read yet' });
      continue;
    }

    const { status } = snapshot;
    if (registry.corpora.length > 1) {
      rows.push({ label: corpus.name, kind: vscode.QuickPickItemKind.Separator });
    }

    rows.push({
      label: '$(git-branch) branch',
      description: status.branch ?? 'detached HEAD',
      detail:
        status.default_branch === null
          ? 'the default branch could not be determined'
          : `default ${status.default_branch}`,
    });
    rows.push({
      label: '$(account) identity',
      description: status.identity.value,
      detail: `from ${status.identity.source}`,
    });
    rows.push(
      status.claim === null
        ? { label: '$(circle-outline) claim', description: 'none held here' }
        : {
            label: '$(circle-filled) claim',
            description: status.claim.id,
            detail: status.claim.lapsed
              ? 'lapsed: log against it to renew, or release it and say why'
              : `expires ${status.claim.expires}`,
          },
    );
    if (status.drift !== null) {
      rows.push({
        label: '$(git-compare) drift',
        description: `${String(status.drift.entities)} entity file(s) differ from ${status.drift.branch}`,
        detail: 'a stale base turns a green tree red elsewhere',
      });
    }
    for (const other of status.elsewhere) {
      rows.push({
        label: '$(person) elsewhere',
        description: `${other.id} held by ${other.holder ?? 'somebody'}`,
        ...(other.title === null ? {} : { detail: other.title }),
      });
    }
    rows.push({
      label: '$(law) corpus',
      description: `${String(status.queue)} proposal(s), ${String(status.faults)} fault(s), ${String(status.signals)} signal(s)`,
      ...(status.unmerged > 0
        ? {
            detail: `${String(status.unmerged)} task(s) finished on another branch and not merged here`,
          }
        : {}),
    });
  }

  if (rows.length === 0) {
    await vscode.window.showInformationMessage('No corpus in this workspace.');
    return;
  }

  await vscode.window.showQuickPick(rows, {
    title: 'ank status',
    placeHolder: 'from the last read; nothing here starts one',
  });
}

/**
 * The context keys the manifest gates commands and views on.
 *
 * `ank.hasClaim` is a disjunction and never a count: several corpora are
 * several repositories, and a number across them would be a fiction.
 */
async function announce(registry: CorpusRegistry): Promise<void> {
  const held = registry.corpora.some((corpus) => corpus.snapshot?.status.claim != null);
  await setContext('ank.hasCorpus', !registry.empty);
  await setContext('ank.hasClaim', held);
}

function setContext(key: string, value: boolean): Thenable<unknown> {
  return vscode.commands.executeCommand('setContext', key, value);
}

/**
 * Locates the binary and asks it what it can do.
 *
 * A binary that is absent is exit 9 territory: an environment to repair, not a
 * corpus that is broken. It is reported once, with the install line, and the
 * extension stays loaded rather than throwing out of activation -- the user
 * may install ank and reload without hunting for a setting.
 */
async function open(sink: Log): Promise<Binary | undefined> {
  const settings = vscode.workspace.getConfiguration('ank');
  const configured = settings.get<string>('path', '');
  const agent = settings.get<string>('agent', '');

  try {
    const located = await locate([configured, 'ank'], sink);
    const cli = new AnkCli(located.binary, sink, environment(agent));
    const capabilities = await Capabilities.probe(cli);
    return { cli, located, capabilities };
  } catch (error) {
    reportMissingBinary(sink, error);
    return undefined;
  }
}

/**
 * The identity this window writes under.
 *
 * `ANK_AGENT` falls back to `<user>@<hostname>`, and that fallback is the
 * thing to override: two windows on one tree with no distinct identities are
 * one agent as far as the claim refs are concerned, so they share a claim
 * instead of arbitrating over it and the second is quietly refused work it
 * should have been given.
 */
function environment(configured: string): Record<string, string> {
  return { ANK_AGENT: agentOf(configured) };
}

/**
 * The identity, computed the same way wherever it is needed.
 *
 * The MCP server writes under `ank-mcp/<version>` unless `$ANK_AGENT` names
 * one. It has to be handed this window's, because two surfaces writing under
 * two names are two agents to the claim refs -- and one of them would be
 * refused work the other is holding.
 */
function agentOf(configured?: string): string {
  const named =
    configured ?? vscode.workspace.getConfiguration('ank').get<string>('agent', '');
  return named.trim() !== '' ? named.trim() : `vscode/${vscode.version}@${machine()}`;
}

/**
 * A stable name for this installation.
 *
 * The hostname would read better in `ank status`, and it is also a real
 * machine name written into a ref that may be pushed to a shared remote. The
 * editor already carries an opaque id that is stable across a rename, so that
 * is what goes in.
 */
function machine(): string {
  return vscode.env.machineId.slice(0, 8);
}

function reportMissingBinary(sink: Log, error: unknown): void {
  const message = error instanceof AnkError ? error.message : 'ank could not be started';
  sink.error(message);

  const install = 'Copy install command';
  const showLog = 'Show Log';
  void vscode.window.showWarningMessage(`${message}.`, install, showLog).then((chosen) => {
    if (chosen === install) {
      void vscode.env.clipboard.writeText(INSTALL_HINT);
    } else if (chosen === showLog) {
      sink.show();
    }
  });
}
