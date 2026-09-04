---
id: TASK-fdb498a034e6
type: task
slug: corpus-state-and-the-refresh-policy
title: Corpus state and the refresh policy
created: 2026-09-03T11:37:26Z
author: claude-opus-5@vscode-ank
status: done
scope:
  - src/corpus/**
  - src/extension.ts
  - src/test/unit/refresh.test.ts
  - src/test/unit/events.test.ts
blocked_by: [TASK-dce6d0e0a701]
done_criteria: |
  A repaint cycle driven by a test executes exactly the verbs status and find and no others; the test fails if the set differs. events.jsonl handling is covered by tests for a partial trailing line, a file shorter than the held offset, and an absent file. Each workspace folder carrying a corpus is addressed with its own --repo and no value is computed across two of them.
criteria_by: creator
verify: [compile, lint, test]
proof:
  - type: test
    ref: local/b29daaf8f02c@3eb4333
    tree: scope/2dc70349a4ff
    criteria: 7f6b37d645ae
    verifier: compile@1499ad9e1de7
    via: verifier
  - type: test
    ref: local/fcccc353eb3b@3eb4333
    tree: scope/2dc70349a4ff
    criteria: 7f6b37d645ae
    verifier: lint@fdfbf957c961
    via: verifier
  - type: test
    ref: local/967a4caee209@3eb4333
    tree: scope/2dc70349a4ff
    criteria: 7f6b37d645ae
    verifier: test@c6dbe1d43704
    via: verifier
schema: 4
version: 5
---

The guard test is the point of this task. The rule it protects is the easiest
one to break by accident — a view that calls `show` to fill a tooltip keeps a
claim alive in front of an empty chair — and the breakage is invisible from
inside the extension.
