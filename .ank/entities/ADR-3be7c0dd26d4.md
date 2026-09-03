---
id: ADR-3be7c0dd26d4
type: adr
slug: one-corpus-per-workspace-folder-and-nothing-is-m
title: One corpus per workspace folder, and nothing is merged
created: 2026-09-03T11:35:29Z
author: claude-opus-5@vscode-ank
status: proposed
scope:
  - src/corpus/**
constraint: |
  Each workspace folder carrying a .ank/ is addressed on its own with --repo. No view, command or model computes a value across two corpora, and no list they are shown in is sorted, filtered or arbitrated as one.
schema: 4
version: 1
---

`refs/ank/*` is per repository and cannot carry an arbitration across clones.
There is no merged claim space, and a client that presents several corpora as
one list must not act as though there were one.

Multiplexing and merging are different things, and telling them apart is the
whole of the decision. A multi-root window may show four corpora together;
what it may not do is rank a task from one against a task from another, count
"ready" across them, or resolve an id without knowing which corpus it came
from. Every entity the UI holds is a pair — corpus plus id — and never an id
alone.

The address is `--repo <path>`, with `--worktree <path>` as its second half
where the corpus is anchored to a tree elsewhere.
