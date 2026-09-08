---
id: TASK-2eff262d8bdb
type: task
slug: a-reading-opens-the-preview-wherever-the-reading
title: A reading opens the preview, wherever the reading started
created: 2026-09-08T12:19:59Z
author: mb635291@bid-e613543
status: done
scope:
  - src/commands/**
  - src/extension.ts
  - src/test/**
blocked_by: []
done_criteria: |
  Choosing an entity in Find, or in What Binds This File, opens its preview rather than the detail panel, through the same route a tree row and a chosen log entry take. A verb that changed something still leaves the reader in the panel. An integration test pins that ank.open and ank.show are two different answers: one opens a markdown preview and no panel, the other opens a panel and no preview.
criteria_by: creator
verify: [compile, lint]
proof:
  - type: test
    ref: local/b29daaf8f02c@11b3e7e
    tree: scope/f80bce8b0721
    criteria: 16b0647d0e97
    verifier: compile@1499ad9e1de7
    via: verifier
  - type: test
    ref: local/fcccc353eb3b@11b3e7e
    tree: scope/f80bce8b0721
    criteria: 16b0647d0e97
    verifier: lint@fdfbf957c961
    via: verifier
schema: 4
version: 3
---
