/**
 * What a status means, and how it looks (ADR-2a33a9a3bda3).
 *
 * Upstream publishes meanings rather than colours: a name maps to a role, and
 * the client picks how a role looks. No escape sequence is ever shipped from
 * there, and no second vocabulary of statuses is defined here. A name the
 * table does not carry has no role, and no role means leave it alone -- the
 * default foreground, not a colour we invented for the unknown.
 */

import * as vscode from 'vscode';

/** The roles the meaning table maps names onto. */
export type Role =
  | 'available'
  | 'underway'
  | 'accomplished'
  | 'retired'
  | 'awaiting'
  | 'attention'
  | 'fault'
  | 'identifier';

/** Status names, as ank publishes them. */
const STATUS: Readonly<Record<string, Role>> = {
  open: 'available',
  in_progress: 'underway',
  claimed: 'underway',
  done: 'accomplished',
  finished: 'accomplished',
  closed: 'retired',
  proposed: 'awaiting',
  accepted: 'accomplished',
  superseded: 'retired',
  expired: 'attention',
};

const KIND: Readonly<Record<string, Role>> = {
  task: 'identifier',
  adr: 'identifier',
  spec: 'identifier',
  log: 'identifier',
};

const SEVERITY: Readonly<Record<string, Role>> = {
  fault: 'fault',
  signal: 'attention',
};

/**
 * The role of a state string.
 *
 * Two rules, and both are load-bearing:
 *
 * 1. A state that **contains** `expired` is Attention whatever it expired
 *    from. The markers read `open expired:who@host` and `done
 *    expired:who@host`, so the word is not always at the front.
 * 2. Otherwise take everything before the first colon. What follows one is
 *    addressing and not state: `claimed:who@host`, `finished:abc1234 on main`.
 *
 * `blocked` is deliberately absent from the table. It is derived from
 * `blocked_by` at read time and no entity is stored carrying it, so this
 * answers null for it and the views derive it the same way ank does.
 */
export function roleOfStatus(state: string): Role | null {
  const text = state.trim().replace(/^\[/, '').replace(/\]$/, '');
  if (text.includes('expired')) {
    return 'attention';
  }
  const head = text.split(':', 1)[0]?.trim() ?? '';
  return STATUS[head] ?? null;
}

export function roleOfKind(kind: string): Role | null {
  return KIND[kind.toLowerCase()] ?? null;
}

export function roleOfSeverity(level: string): Role | null {
  return SEVERITY[level.toLowerCase()] ?? null;
}

/**
 * The colour a role wears.
 *
 * Every one is a theme token rather than a hex value, so the extension follows
 * whatever the user is running rather than asserting a palette over it.
 */
const COLOUR: Readonly<Record<Role, string | null>> = {
  available: 'charts.blue',
  underway: 'charts.yellow',
  accomplished: 'charts.green',
  retired: 'disabledForeground',
  awaiting: 'charts.purple',
  attention: 'editorWarning.foreground',
  fault: 'editorError.foreground',
  identifier: null,
};

/** The icon a role wears in a tree. */
const ICON: Readonly<Record<Role, string>> = {
  available: 'circle-outline',
  underway: 'circle-filled',
  accomplished: 'pass-filled',
  retired: 'circle-slash',
  awaiting: 'question',
  attention: 'warning',
  fault: 'error',
  identifier: 'symbol-file',
};

export function colourOf(role: Role | null): vscode.ThemeColor | undefined {
  if (role === null) {
    return undefined;
  }
  const token = COLOUR[role];
  return token === null ? undefined : new vscode.ThemeColor(token);
}

export function iconOf(role: Role | null, fallback = 'circle-outline'): vscode.ThemeIcon {
  if (role === null) {
    return new vscode.ThemeIcon(fallback);
  }
  return new vscode.ThemeIcon(ICON[role], colourOf(role));
}

/**
 * The icon for a task, which is the one case a status alone does not settle.
 *
 * A blocked task is `open` in its file. Blockedness is an edge, and a view
 * that showed it as plain `open` would be true to the file and useless to the
 * reader, so it is derived here exactly as ank derives it.
 */
export function taskIcon(state: string, ready: boolean): vscode.ThemeIcon {
  const role = roleOfStatus(state);
  if (role === 'available' && !ready) {
    return new vscode.ThemeIcon('circle-large-outline', colourOf('retired'));
  }
  return iconOf(role);
}

/**
 * The part of a state after the colon: who holds it, or where it finished.
 *
 * Null where the state carries no addressing, which is most of the time.
 */
export function addressingOf(state: string): string | null {
  const colon = state.indexOf(':');
  return colon === -1 ? null : state.slice(colon + 1).trim() || null;
}
