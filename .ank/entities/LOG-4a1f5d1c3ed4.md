---
id: LOG-4a1f5d1c3ed4
type: log
title: "Commands are registered from the verb table, not from a list kept here: a command contributed"
created: 2026-09-03T12:51:11Z
author: claude-opus-5@vscode-ank
scope:
  - src/commands/**
  - src/extension.ts
  - package.json
  - src/test/unit/accept.test.ts
about: TASK-a4b4e28d4047
seq: 2
schema: 4
version: 1
---

 against a verb an older binary lacks is skipped with a line in the log rather than failing when it is clicked. The set that was registered is handed to the detail panel by reference, so a button is only drawn for a command that exists.
