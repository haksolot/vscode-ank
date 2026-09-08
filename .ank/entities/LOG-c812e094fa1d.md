---
id: LOG-c812e094fa1d
type: log
title: A context menu hands back the element the tree provider returned, so  is an EntityNode and not the
created: 2026-09-08T11:54:16Z
author: mb635291@bid-e613543
scope:
  - src/ui/**
  - src/commands/pick.ts
  - src/extension.ts
  - src/test/**
about: TASK-42a20f57f269
seq: 0
schema: 4
version: 1
---

 EntityRef a row's own command carries. The shape check read uid=1953090(mb635291) gid=1049089 groups=1049089 and  off it, found the node's own id and no corpus, and fell through to the picker. The rule now lives in src/ui/addressing.ts, imports no editor, and both callers -- refOf and the extension's addressed -- go through it.
