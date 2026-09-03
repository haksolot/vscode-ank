/**
 * What this binary can do, asked of the binary.
 *
 * `ank help --json` is the entry point for a client, and it is deliberately
 * not this file, not the documentation and not the source. The table it
 * returns is generated from the table the binary dispatches from, so it cannot
 * fall behind what the binary does. A list maintained by hand is a list that
 * will disagree, and the disagreement surfaces days later as a bug the user
 * sees and we cannot.
 *
 * Two things are read from it. Whether a verb exists at all, so a command
 * contributed against a verb an older binary lacks is disabled rather than
 * failing when it is clicked. And each verb's own summary, which becomes the
 * description of the matching language model tool: taking the wording from the
 * table keeps it from disagreeing with the tool the model is calling.
 */

import type { AnkCli } from './cli';
import { help } from './verbs';
import type { Verb, VerbRefusal, VerbShape } from './types';

export class Capabilities {
  private readonly byName: ReadonlyMap<string, Verb>;

  private constructor(readonly verbs: readonly Verb[]) {
    this.byName = new Map(verbs.map((verb) => [verb.name, verb]));
  }

  static async probe(cli: AnkCli): Promise<Capabilities> {
    const document = await help(cli);
    return new Capabilities(document.verbs);
  }

  /** For tests and for callers that already hold a table. */
  static of(verbs: readonly Verb[]): Capabilities {
    return new Capabilities(verbs);
  }

  has(verb: string): boolean {
    return this.byName.has(verb);
  }

  get(verb: string): Verb | undefined {
    return this.byName.get(verb);
  }

  /** The verb's own one-line description, as the table words it. */
  summary(verb: string): string | null {
    return this.byName.get(verb)?.summary ?? null;
  }

  /**
   * What a call will refuse, and with which code, before making it.
   *
   * Worth surfacing in a tooltip: a user who can see that `claim` refuses a
   * blocked task with exit 7 does not have to click to find out.
   */
  refusals(verb: string): readonly VerbRefusal[] {
    return this.byName.get(verb)?.refuses ?? [];
  }

  /**
   * The shapes a verb returns.
   *
   * A list, because a verb may answer two questions: `config <key>` reads and
   * `config <key> <value>` writes. Each shape names the call that returns it
   * in its `when`, which is null where the verb has only one.
   */
  shapes(verb: string): readonly VerbShape[] {
    return this.byName.get(verb)?.returns ?? [];
  }

  /** The verbs of one group, in the order the table declares them. */
  group(name: string): readonly Verb[] {
    return this.verbs.filter((verb) => verb.group === name);
  }

  /** Every group name, in the order they first appear. */
  groups(): readonly string[] {
    const seen: string[] = [];
    for (const verb of this.verbs) {
      if (!seen.includes(verb.group)) {
        seen.push(verb.group);
      }
    }
    return seen;
  }
}
