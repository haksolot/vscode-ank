---
id: ADR-332fddfe7db9
type: adr
slug: the-corpus-is-reached-only-by-running-the-binary
title: The corpus is reached only by running the binary
created: 2026-09-03T11:34:53Z
author: claude-opus-5@vscode-ank
status: proposed
scope:
  - src/**
constraint: |
  No code path under src/ reads, parses, writes or watches a file inside .ank/. Every fact about the corpus is obtained by executing the ank binary with --json, and every change to it is made by executing a verb.
schema: 4
version: 1
---

A task's state is not in its file. It is the file, plus `refs/ank/claims/<id>`,
plus `refs/ank/proof/<id>`, plus the `LOG-*` entities whose `about` names it.
Most of those refs live in `.git/packed-refs` rather than under `.git/refs/`.

A reader that walks `.ank/` therefore reports a held task as free, and it does
so **silently** — there is no error, no warning, and no way for the user to
tell. That failure mode is the reason `.ank/` is opaque the way `.git/` is, and
it is why this constraint is absolute rather than a preference for tidiness.

The derived SQLite index beside the entities is not an exception. It is
disposable, rebuilt from a content hash per file at read time, and never the
source of truth.

One consequence worth stating: this extension is slower than one that mmaps a
directory, and that is the trade. Correctness about who holds what is the whole
value of the tool being integrated.
