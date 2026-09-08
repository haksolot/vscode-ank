---
id: TASK-81fc928ae4c1
type: task
slug: choosing-a-log-entry-opens-it
title: Choosing a log entry opens it
created: 2026-09-08T12:01:25Z
author: mb635291@bid-e613543
status: in_progress
scope:
  - src/ui/**
  - src/commands/loop.ts
  - src/test/**
blocked_by: []
done_criteria: |
  Choosing an entry in the Read Log picker opens that entry's preview. Every row the picker offers carries the id of the LOG entity it stands for, and an entry with no id of its own is offered as a row that opens nothing rather than one that opens the wrong thing. The rule that turns a work trace into rows is pure, imports no editor, and a unit test covers the entries, the machinery heading and an entry with no id.
criteria_by: creator
verify: [compile, lint]
schema: 4
version: 2
---
