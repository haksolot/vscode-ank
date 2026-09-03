/**
 * What a role looks like.
 *
 * Only the mapping from a role to an editor value lives here. Which role a
 * name has is in `meaning.ts`, which imports nothing, so the part that could
 * be wrong about ank is testable and the part that could be wrong about VS
 * Code is small.
 */

import * as vscode from 'vscode';

import { COLOUR, ICON, roleOfStatus, type Role } from './meaning';

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
