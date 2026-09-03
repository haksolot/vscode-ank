/**
 * An entity, served as a read-only virtual document (ADR-6b71ec0890de).
 *
 * `ank show --json` returns `content`: the file, byte for byte, so nothing is
 * lost by going through the verb rather than around it. Serving those bytes on
 * a scheme of our own buys the markdown preview, find-in-file, diff, folding
 * and every theme, for no code -- and it is read-only by construction, which
 * is what keeps the opacity rule from depending on anyone's discipline. A
 * content provider has no write path to offer.
 *
 * The URI is `ank://<corpus>/<id>.md`. The authority is the workspace folder
 * the entity came from, because an id alone is not an address: two corpora may
 * carry ids that look alike and nothing merges their claim spaces.
 */

import * as vscode from 'vscode';

import { AnkError, isTaskDocument, type ShowDocument } from '../ank';
import type { Corpus } from '../corpus/corpus';
import type { CorpusRegistry } from '../corpus/registry';

export const ANK_SCHEME = 'ank';

/**
 * The URI an entity is served at.
 *
 * `ank:/<id>.md?<folder>`. The `.md` suffix is what makes VS Code light the
 * document up as markdown -- an entity is YAML frontmatter over a markdown
 * body, and that is exactly how it should read.
 *
 * The folder goes in the query rather than in the authority. An authority has
 * a restricted character set, so a `file:///c:/...` folded into one has to be
 * escaped, and the editor escapes it again on the way to a resource it can no
 * longer resolve. A query carries arbitrary text and round-trips.
 */
export function entityUri(folder: vscode.Uri, id: string): vscode.Uri {
  return vscode.Uri.from({
    scheme: ANK_SCHEME,
    path: `/${id}.md`,
    query: folder.toString(),
  });
}

/** The corpus and id a URI addresses, or undefined where it addresses none. */
export function entityOf(
  uri: vscode.Uri,
  registry: CorpusRegistry,
): { corpus: Corpus; id: string } | undefined {
  if (uri.scheme !== ANK_SCHEME) {
    return undefined;
  }

  const corpus = registry.corpora.find(
    (candidate) => candidate.folder.uri.toString() === uri.query,
  );
  if (!corpus) {
    return undefined;
  }

  const id = uri.path.replace(/^\//, '').replace(/\.md$/, '');
  return id === '' ? undefined : { corpus, id };
}

export class EntityDocumentProvider
  implements vscode.TextDocumentContentProvider, vscode.Disposable
{
  private readonly changed = new vscode.EventEmitter<vscode.Uri>();
  private readonly cache = new Map<string, ShowDocument>();

  readonly onDidChange = this.changed.event;

  constructor(private readonly registry: CorpusRegistry) {}

  /**
   * The entity file, byte for byte.
   *
   * This runs `show`, which renews the claim where the id is the task the
   * caller holds. That is correct: opening an entity is something a person
   * just did. It is also why nothing repaints through here -- the provider is
   * asked only when a document is opened or explicitly refreshed.
   */
  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const addressed = entityOf(uri, this.registry);
    if (!addressed) {
      return `# Not found\n\nNo open corpus answers for \`${uri.toString()}\`.\n`;
    }

    try {
      const document = await addressed.corpus.ank.show(addressed.id);
      this.cache.set(uri.toString(), document);
      return document.content;
    } catch (error) {
      this.cache.delete(uri.toString());
      return refusal(addressed.id, error);
    }
  }

  /**
   * The last document fetched for a URI.
   *
   * The detail panel needs what the file does not carry -- `coordination` from
   * a git ref, the log and machinery from separate entities, the edges -- and
   * would otherwise run `show` a second time, renewing a lease twice for one
   * click.
   */
  peek(uri: vscode.Uri): ShowDocument | undefined {
    return this.cache.get(uri.toString());
  }

  /** Asks the editor to re-fetch a document that is already open. */
  invalidate(uri: vscode.Uri): void {
    this.cache.delete(uri.toString());
    this.changed.fire(uri);
  }

  /** Re-fetches every open entity document of a corpus. */
  invalidateAll(corpus?: Corpus): void {
    for (const key of [...this.cache.keys()]) {
      const uri = vscode.Uri.parse(key);
      const addressed = entityOf(uri, this.registry);
      if (!corpus || addressed?.corpus === corpus) {
        this.invalidate(uri);
      }
    }
  }

  dispose(): void {
    this.changed.dispose();
    this.cache.clear();
  }
}

/**
 * A refusal, rendered as the document.
 *
 * Showing the error where the content would have been is better than a
 * notification that disappears: the tab stays open with the reason in it, and
 * the hint the CLI named is right there to copy.
 */
function refusal(id: string, error: unknown): string {
  if (!(error instanceof AnkError)) {
    return `# ${id}\n\nCould not be read.\n\n\`\`\`\n${String(error)}\n\`\`\`\n`;
  }

  const lines = [
    `# ${id}`,
    '',
    `\`error[${String(error.code)}]\` ${error.message}`,
    '',
    `> ${error.sense}`,
  ];

  if (error.hint !== null) {
    lines.push('', 'What the CLI says to run next:', '', '```sh');
    lines.push(...error.hint.split('\n'));
    lines.push('```');
  }

  return `${lines.join('\n')}\n`;
}

/** True where the document carries the edges only a task has. */
export { isTaskDocument };
