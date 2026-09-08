---
id: LOG-9e3cb203ae43
type: log
title: The picker built plain QuickPickItems from the entries and threw the choice away, so every row
created: 2026-09-08T12:14:12Z
author: mb635291@bid-e613543
scope:
  - src/ui/**
  - src/commands/loop.ts
  - src/test/**
about: TASK-81fc928ae4c1
seq: 0
schema: 4
version: 1
---

 stood for a LOG entity and none of them said which. Rows are built by a pure traceRows in src/ui/trace.ts now, the choice opens ank.open on the entry, and the id is optional on the way out for two reasons that met: row drops what is null, and a heading stands for no entity. An entry whose id is null is migrated, predates entries being entities, and opens nothing.
