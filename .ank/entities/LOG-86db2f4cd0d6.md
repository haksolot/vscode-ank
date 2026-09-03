---
id: LOG-86db2f4cd0d6
type: log
title: The tasks view groups on what a reader can do -- in progress, ready, blocked, finished -- and keeps
created: 2026-09-03T12:39:56Z
author: claude-opus-5@vscode-ank
scope:
  - src/ui/**
  - src/extension.ts
  - resources/**
  - src/test/unit/meaning.test.ts
  - package.json
about: TASK-d1233dd19832
seq: 7
schema: 4
version: 1
---

 the order the graph gives: ready first, then by how many other tasks each would unblock. Sorting alphabetically over that would throw away the only thing the corpus knows that a directory listing does not.
