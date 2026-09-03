/**
 * `ank mcp`, served to the editor natively.
 *
 * A client with no shell reaches ank through `ank mcp`, a verb of the one
 * executable every route installs. There is no second file to fetch, sign or
 * discover: what the CLI dispatches is what the surface serves, because they
 * are the same file.
 *
 * Providing the definition rather than writing an `mcp.json` matters for a
 * reason beyond tidiness. The binary this extension resolved is not always the
 * name on the PATH -- on Windows it is the executable behind a `.cmd` shim --
 * and a configuration file naming `ank` would start a server the editor cannot
 * spawn. Handing over the resolved path means the two can never disagree.
 *
 * `--repo` is written out because a client spawns the server in whatever
 * directory it happens to be in, and with no `--repo` the server takes that
 * directory: a process quietly speaking for a corpus nobody meant, rather than
 * an error anyone sees.
 */

import * as vscode from 'vscode';

import { AnkError, declareCorpus, type AnkCli, type Located } from '../ank';
import type { CorpusRegistry } from '../corpus/registry';
import type { Log } from '../log';

export const MCP_PROVIDER_ID = 'ank';

export class AnkMcpProvider
  implements vscode.McpServerDefinitionProvider<vscode.McpStdioServerDefinition>
{
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChangeMcpServerDefinitions = this.changed.event;

  constructor(
    private readonly registry: CorpusRegistry,
    private readonly located: Located,
    private readonly agent: string,
  ) {}

  /**
   * One server per corpus.
   *
   * Not one server multiplexing them. A single process can reach several
   * corpora through the `corpus` argument, but only over corpora the reader
   * declared in `corpora.yml`, and every call still lands in one repository at
   * a time. One server per open folder is the shape that needs no declaration
   * and cannot address the wrong corpus.
   */
  provideMcpServerDefinitions(): vscode.McpStdioServerDefinition[] {
    return this.registry.corpora.map((corpus) => {
      const definition = new vscode.McpStdioServerDefinition(
        `ank · ${corpus.name}`,
        this.located.binary,
        ['mcp', '--repo', corpus.folder.uri.fsPath],
        {
          // The server writes under `ank-mcp/<version>` unless `$ANK_AGENT`
          // names an identity. This window already has one, and two surfaces
          // writing under two names would be two agents to the claim refs.
          ANK_AGENT: this.agent,
        },
        this.located.version,
      );
      definition.cwd = corpus.folder.uri;
      return definition;
    });
  }

  /** Tells the editor the set moved, when a folder is added or removed. */
  refresh(): void {
    this.changed.fire();
  }

  dispose(): void {
    this.changed.dispose();
  }
}

/**
 * Declares a corpus outside this workspace, so one server can reach it.
 *
 * The declaration lives in the reader's own `corpora.yml`, outside every
 * repository, and is keyed on the repository identity -- the root commit,
 * which `ank status` prints under `corpus`. Never a path, a remote or a slug:
 * a corpus reached by two paths is one corpus, and keying on a path would
 * invite two entries for it.
 */
export async function declare(
  cli: AnkCli,
  registry: CorpusRegistry,
  log: Log,
): Promise<void> {
  const choices = registry.corpora
    .filter((corpus) => corpus.identity !== null)
    .map((corpus) => ({
      label: corpus.name,
      description: corpus.identity ?? '',
      detail: corpus.folder.uri.fsPath,
      corpus,
    }));

  if (choices.length === 0) {
    void vscode.window.showInformationMessage(
      'No corpus here has an identity yet. A repository with no commits has no root commit to be named by.',
    );
    return;
  }

  const chosen = await vscode.window.showQuickPick(choices, {
    title: 'Declare a corpus for the MCP server',
    placeHolder: 'a corpus is named by its root commit, never by a path',
  });
  if (!chosen) {
    return;
  }

  const identity = chosen.corpus.identity;
  if (identity === null) {
    return;
  }

  try {
    const written = await declareCorpus(cli, identity, chosen.corpus.folder.uri.fsPath);
    void vscode.window.showInformationMessage(
      written.changed
        ? `Declared ${chosen.corpus.name} as ${identity.slice(0, 12)}… in your corpora.yml.`
        : `${chosen.corpus.name} was already declared.`,
    );
  } catch (error) {
    log.error(`declare: ${String(error)}`);
    const message =
      error instanceof AnkError ? error.message : 'the declaration could not be written';
    void vscode.window.showErrorMessage(message);
  }
}
