/**
 * Where am I, in one line.
 *
 * The claim and its expiry when one is held, because a lease that lapses
 * without the holder noticing is how work gets taken out from under somebody.
 * Otherwise what is takeable, because that is the next question.
 *
 * Everything shown comes from the `status` document of the last repaint. This
 * starts no read of its own and holds no timer: the expiry is recomputed from
 * a timestamp already in hand whenever the bar is redrawn.
 */

import * as vscode from 'vscode';

import type { CorpusRegistry } from '../corpus/registry';
import { colourOf } from './theme';

export class StatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly registry: CorpusRegistry) {
    this.item = vscode.window.createStatusBarItem(
      'ank.status',
      vscode.StatusBarAlignment.Left,
      100,
    );
    this.item.name = 'ank';
    this.item.command = 'ank.status';
    this.disposables.push(this.item);
    this.disposables.push(registry.onDidChange(() => this.draw()));
    this.draw();
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  draw(): void {
    const corpora = this.registry.corpora;
    if (corpora.length === 0) {
      this.item.hide();
      return;
    }

    const held = corpora
      .map((corpus) => ({ corpus, claim: corpus.snapshot?.status.claim ?? null }))
      .filter((entry) => entry.claim !== null);

    if (held.length > 0) {
      this.showClaim(held);
    } else {
      this.showQueue();
    }

    this.item.show();
  }

  private showClaim(
    held: { corpus: { name: string }; claim: { id: string; expires: string; lapsed: boolean } | null }[],
  ): void {
    const first = held[0];
    const claim = first?.claim;
    if (!first || !claim) {
      return;
    }

    const remaining = expiresIn(claim.expires);
    const more = held.length > 1 ? ` +${String(held.length - 1)}` : '';

    this.item.text = `$(account) ${short(claim.id)}${remaining ? ` · ${remaining}` : ''}${more}`;
    this.item.tooltip = claim.lapsed
      ? 'Your claim has lapsed. Log against it to renew, or release it and say why.'
      : `You hold ${claim.id} in ${first.corpus.name}. Working on it renews the lease; a claim renewed by reporting would be a claim nothing keeps honest.`;

    // A lapsed claim is the one thing here worth a colour: somebody else may
    // take the task, and the holder should find out from the bar rather than
    // from a refusal.
    this.item.backgroundColor = claim.lapsed
      ? new vscode.ThemeColor('statusBarItem.warningBackground')
      : undefined;
    this.item.color = claim.lapsed ? undefined : colourOf('underway');
  }

  private showQueue(): void {
    let ready = 0;
    let faults = 0;
    const unread: string[] = [];

    for (const corpus of this.registry.corpora) {
      const snapshot = corpus.snapshot;
      if (!snapshot) {
        unread.push(corpus.name);
        continue;
      }
      ready += snapshot.tasks.filter(
        (task) =>
          task.blockedBy.length === 0 &&
          task.status !== 'done' &&
          task.status !== 'closed',
      ).length;
      faults += snapshot.status.faults;
    }

    if (unread.length === this.registry.corpora.length) {
      this.item.text = '$(loading~spin) ank';
      this.item.tooltip = 'Reading the corpus';
      this.item.backgroundColor = undefined;
      this.item.color = undefined;
      return;
    }

    // Faults come from the last `status`, which counts them without running
    // `check`. Showing the count is free; running the verb that produces it
    // would prune refs on a timer.
    this.item.text =
      faults > 0
        ? `$(law) ${String(ready)} ready · $(error) ${String(faults)}`
        : `$(law) ${String(ready)} ready`;
    this.item.tooltip =
      faults > 0
        ? `${String(ready)} task(s) takeable. ${String(faults)} fault(s) reported by the last status; run ank: Check to see them.`
        : `${String(ready)} task(s) takeable.`;
    this.item.backgroundColor = undefined;
    this.item.color = faults > 0 ? colourOf('fault') : undefined;
  }
}

function short(id: string): string {
  const dash = id.indexOf('-');
  return dash === -1 ? id : `${id.slice(0, dash)}-${id.slice(dash + 1, dash + 5)}`;
}

/**
 * How long is left on a lease, roughly.
 *
 * Rough on purpose: a bar that counted seconds would need a timer, and this
 * extension has none. The value is recomputed whenever something else causes
 * a redraw, which is often enough to be useful and never a reason to wake up.
 */
function expiresIn(expires: string): string | null {
  const at = Date.parse(expires);
  if (Number.isNaN(at)) {
    return null;
  }

  const minutes = Math.round((at - Date.now()) / 60_000);
  if (minutes <= 0) {
    return 'lapsed';
  }
  if (minutes < 60) {
    return `${String(minutes)}m`;
  }
  return `${String(Math.round(minutes / 60))}h`;
}
