/**
 * What `check` found, in the Problems panel.
 *
 * One decision here is load-bearing and easy to get backwards: a **signal is
 * Information, not Warning**. Upstream is emphatic about why -- a signal alone
 * leaves the exit code 0, and reddening a build over an observation teaches a
 * team to stop reading `check`. `check` is also the verb that catches a frozen
 * criterion diverging, which is the thing you least want people ignoring.
 *
 * The other is that nothing here runs on a timer. `check` prunes the claim
 * refs it finds stale, so it writes, and losing a coordination ref loses a
 * fact nothing else carries. It also walks git history. It runs from the
 * command, and from an on-save setting that defaults to off.
 */

import * as vscode from 'vscode';

import type { CheckDocument, Finding } from '../ank';
import type { Corpus } from '../corpus/corpus';
import { MARKER } from '../corpus/registry';
import { entityUri } from './entityDocument';
import { isEntitySubject, weightOf } from './findings';

export class Findings implements vscode.Disposable {
  private readonly collection: vscode.DiagnosticCollection;

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection('ank');
  }

  dispose(): void {
    this.collection.dispose();
  }

  /** Replaces everything reported for one corpus. */
  report(corpus: Corpus, document: CheckDocument): void {
    this.clear(corpus);

    const byUri = new Map<string, vscode.Diagnostic[]>();

    for (const finding of document.findings) {
      const uri = anchorOf(corpus, finding.subject);
      const key = uri.toString();
      byUri.set(key, [...(byUri.get(key) ?? []), diagnosticOf(corpus, finding)]);
    }

    for (const [key, diagnostics] of byUri) {
      this.collection.set(vscode.Uri.parse(key), diagnostics);
    }
  }

  /**
   * Forgets what was reported for one corpus.
   *
   * Findings are only as current as the last `check`, and `check` is not a
   * poll. Leaving a stale one in the Problems panel after the corpus moved
   * would be worse than showing nothing: the panel is read as current.
   */
  clear(corpus: Corpus): void {
    const prefix = corpus.folder.uri.toString();
    const stale: vscode.Uri[] = [];

    this.collection.forEach((uri) => {
      if (uri.query === prefix || uri.toString().startsWith(prefix)) {
        stale.push(uri);
      }
    });

    for (const uri of stale) {
      this.collection.delete(uri);
    }
  }

  clearAll(): void {
    this.collection.clear();
  }
}

/**
 * Where a finding is shown.
 *
 * An entity subject anchors on the entity, served on the `ank:` scheme, so
 * clicking the problem opens the thing it is about. A corpus-level subject --
 * `allowed_signers`, `coordination` -- anchors on the config, which is where
 * `ank config` writes and therefore where its resolution lives.
 */
function anchorOf(corpus: Corpus, subject: string): vscode.Uri {
  return isEntitySubject(subject)
    ? entityUri(corpus.folder.uri, subject)
    : vscode.Uri.joinPath(corpus.folder.uri, MARKER);
}

function diagnosticOf(corpus: Corpus, finding: Finding): vscode.Diagnostic {
  const diagnostic = new vscode.Diagnostic(
    new vscode.Range(0, 0, 0, 0),
    finding.message,
    severityOf(finding.level),
  );

  diagnostic.source = 'ank';
  diagnostic.code = finding.level;

  const related: vscode.DiagnosticRelatedInformation[] = [];

  // The notes are what to do about it, and every one of them names a command.
  for (const note of finding.note) {
    related.push(
      new vscode.DiagnosticRelatedInformation(
        new vscode.Location(anchorOf(corpus, finding.subject), new vscode.Position(0, 0)),
        note,
      ),
    );
  }

  // `charge` is context-budget accounting: which entity costs what against the
  // budget this scope has. It belongs beside the finding rather than inside
  // its message, which is one line and should stay one.
  for (const charge of finding.charge) {
    related.push(
      new vscode.DiagnosticRelatedInformation(
        new vscode.Location(anchorOf(corpus, charge.id), new vscode.Position(0, 0)),
        `${charge.id} costs ${String(charge.characters)} characters`,
      ),
    );
  }

  if (related.length > 0) {
    diagnostic.relatedInformation = related;
  }

  return diagnostic;
}

/**
 * A fault is an error. A signal is Information, and deliberately not a warning.
 *
 * Signals alone leave the exit code 0. Rendering an observation as something
 * that needs fixing is how a team learns to filter the whole source out.
 */
function severityOf(level: string): vscode.DiagnosticSeverity {
  return weightOf(level) === 'error'
    ? vscode.DiagnosticSeverity.Error
    : vscode.DiagnosticSeverity.Information;
}
