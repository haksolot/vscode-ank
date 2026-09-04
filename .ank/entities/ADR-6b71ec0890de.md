---
id: ADR-6b71ec0890de
type: adr
slug: an-entity-is-served-as-a-read-only-virtual-docum
title: An entity is served as a read-only virtual document
created: 2026-09-03T11:36:04Z
author: claude-opus-5@vscode-ank
status: proposed
scope:
  - src/providers/**
constraint: |
  Entity content is exposed through a TextDocumentContentProvider on the ank scheme, carrying the content field of ank show byte for byte. No entity file is opened from disk and no editor writes one.
schema: 4
version: 1
---

`ank show --json` returns `content`: the file, byte for byte, so nothing is
lost by going through the verb rather than around it.

Serving it on a virtual scheme buys the markdown preview, find-in-file, diff,
folding and every theme, for no code. It is also read-only by construction,
which is what keeps the opacity rule from depending on anyone's discipline: a
content provider has no write path to offer.

What the file does not carry is served beside it, not inside it. `coordination`
comes from a git ref, `log` and `machinery` come from separate `LOG-*`
entities split on `records`, `blocked_by` and `unblocks` are edges, and
`detached_proofs` come from `refs/ank/proof/<id>`. Those belong to the detail
panel, which is why there is one.

Editing goes through `ank edit`, which is a verb, and never through a text
editor pointed at `.ank/entities/`.
