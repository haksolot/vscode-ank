/**
 * The corpus, offered to a language model (ADR-5c7baf6259ca).
 *
 * Six tools, and every one of them reads. No tool claims, finishes, logs,
 * releases, creates, amends, closes, ratifies or runs `check`. A tool call is
 * a decision the model makes and the user approves in a dialog that is easy to
 * wave through, and those acts should be made deliberately from a surface that
 * shows what is about to happen.
 *
 * Read-only is also the honest division of labour: an agent that needs to
 * write has `ank mcp`, which this extension configures natively and which
 * spawns the CLI with the CLI's own refusals intact.
 *
 * Two of the six renew a lease the caller already holds -- `show` and
 * `context`. That is correct: a model calling them is an agent doing work, not
 * a screen repainting itself.
 *
 * Every description is the verb's own `summary`, taken from `ank help --json`
 * rather than written here. A description written twice is a description that
 * will disagree with the tool the model is actually calling.
 */

import * as vscode from 'vscode';

import { AnkError, type AnkDocument, type Capabilities } from '../ank';
import type { Corpus } from '../corpus/corpus';
import type { CorpusRegistry } from '../corpus/registry';
import { OFFERED_VERBS, toolName, type OfferedVerb } from './offered';

/** Every tool takes an optional corpus, because a window may hold several. */
interface Input {
  corpus?: string;
  id?: string;
  path?: string;
  query?: string;
  type?: string;
  status?: string;
}

export function registerTools(
  context: vscode.ExtensionContext,
  registry: CorpusRegistry,
  capabilities: Capabilities,
): void {
  for (const verb of OFFERED_VERBS) {
    if (!capabilities.has(verb)) {
      continue;
    }
    context.subscriptions.push(
      vscode.lm.registerTool<Input>(toolName(verb), new AnkTool(verb, registry)),
    );
  }
}

class AnkTool implements vscode.LanguageModelTool<Input> {
  constructor(
    private readonly verb: OfferedVerb,
    private readonly registry: CorpusRegistry,
  ) {}

  /**
   * Says what is about to be read, and asks nothing.
   *
   * A confirmation would be noise on a read. What the model is looking at is
   * still worth naming, so the progress line says which corpus and which verb.
   */
  prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<Input>,
  ): vscode.PreparedToolInvocation {
    const target = options.input.id ?? options.input.path ?? options.input.query;
    return {
      invocationMessage: target === undefined
        ? `Reading ank ${this.verb}`
        : `Reading ank ${this.verb} ${target}`,
    };
  }

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<Input>,
  ): Promise<vscode.LanguageModelToolResult> {
    const corpus = this.resolve(options.input.corpus);
    if (!corpus) {
      return text(
        this.registry.empty
          ? 'No corpus is open in this workspace. ank keeps tasks and decisions in a repository, under .ank/.'
          : `No open corpus matches ${String(options.input.corpus)}. A corpus is named by the root commit that ank status prints under "corpus".`,
      );
    }

    try {
      return text(JSON.stringify(await this.read(corpus, options.input)));
    } catch (error) {
      // A refusal is an answer. Handing the model the code and the hint lets
      // it react the way a caller should rather than treating every non-zero
      // exit as a failure.
      if (error instanceof AnkError) {
        return text(
          JSON.stringify({
            error: error.code,
            meaning: error.sense,
            message: error.message,
            next: error.hint,
          }),
        );
      }
      return text(JSON.stringify({ error: 1, message: String(error) }));
    }
  }

  private async read(corpus: Corpus, input: Input): Promise<AnkDocument> {
    switch (this.verb) {
      case 'context':
        return corpus.ank.context(input.path);
      case 'find':
        return corpus.ank.find(input.query, {
          ...(input.type === undefined ? {} : { type: input.type }),
          ...(input.status === undefined ? {} : { status: input.status }),
        });
      case 'show':
        return corpus.ank.show(input.id ?? '');
      case 'scope':
        return corpus.ank.scope(input.path ?? '.');
      case 'status':
        return corpus.ank.status();
      case 'graph':
        return corpus.ank.graph(input.path);
    }
  }

  /**
   * Which corpus a call is about.
   *
   * Named by its repository identity -- the root commit -- and never by a
   * path, which is the same rule the MCP surface enforces. With one corpus
   * open and no identity given there is nothing to disambiguate.
   */
  private resolve(identity: string | undefined): Corpus | undefined {
    if (identity === undefined) {
      return this.registry.corpora.length === 1 ? this.registry.corpora[0] : undefined;
    }
    return this.registry.corpora.find((corpus) => corpus.identity === identity);
  }
}

function text(value: string): vscode.LanguageModelToolResult {
  return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(value)]);
}
