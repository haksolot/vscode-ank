---
id: SPEC-2ab323e539da
type: spec
slug: the-refresh-policy
title: The refresh policy
created: 2026-09-03T11:36:43Z
author: claude-opus-5@vscode-ank
status: proposed
scope:
  - src/corpus/**
references: [ADR-eddf502cd27b, ADR-3be7c0dd26d4]
schema: 4
version: 1
---

## What a repaint may run

`status` and `find`. Nothing else, from no code path that a human did not
just click.

A single function issues every unattended read, and it is the only caller of
the adapter that the view layer can reach. Verbs that renew a lease or write
are reachable only from the command layer.

## Where change comes from

Three sources, in order of preference, and no timer in any of them.

**`events.jsonl`**, when a watcher is running. It lives beside `watch.yml` in
`%APPDATA%\ank` on Windows, `$XDG_CONFIG_HOME/ank` elsewhere, falling back to
`$HOME/.config/ank`. One line is one JSON object with exactly three keys:

    {"schema":1,"corpus":"<root commit>","change":"entities"}

`change` is `entities` or `refs` today and may gain a word; a word we do not
know still means repaint. `schema` is the shape of the line and is **not** the
contract version — skip a line whose schema we do not know.

Three rules are the whole protocol:

- Consume **whole lines only**. A half-written line names a corpus wrongly.
- If the file is **shorter than our offset**, the watcher started it over;
  read from the beginning again.
- If the file is **absent**, no watcher has ever run for this reader. That is
  not an error and not a degraded mode. Most installations have none.

Lines are matched against `status.corpus` — the root commit, which is how a
corpus is named. Never a path.

**A `FileSystemWatcher` on `.ank/`**, when no stream exists. It observes that
files changed; it does not read them.

**The refresh command**, always, and window focus.

## Coalescing

Events arrive in bursts. Reads are debounced per corpus and one in flight is
never joined by a second; the trailing request replaces the pending one.

## Identity of a corpus

A workspace folder is a corpus when `ank status --repo <folder>` answers. Its
identity is `status.corpus`, the root commit. It is what `events.jsonl`,
`watch.yml` and `corpora.yml` are keyed on, and it is what the MCP `corpus`
argument names. A path is never an identity: two worktrees of one repository
are one corpus.
