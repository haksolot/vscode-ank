---
id: TASK-fdb498a034e6
type: task
slug: corpus-state-and-the-refresh-policy
title: Corpus state and the refresh policy
created: 2026-09-03T11:37:26Z
author: claude-opus-5@vscode-ank
status: open
scope:
  - src/corpus/**
blocked_by: [TASK-dce6d0e0a701]
done_criteria: |
  A repaint cycle driven by a test executes exactly the verbs status and find and no others; the test fails if the set differs. events.jsonl handling is covered by tests for a partial trailing line, a file shorter than the held offset, and an absent file. Each workspace folder carrying a corpus is addressed with its own --repo and no value is computed across two of them.
criteria_by: creator
verify: [compile, lint, test]
schema: 4
version: 2
---

The guard test is the point of this task. The rule it protects is the easiest
one to break by accident — a view that calls `show` to fill a tooltip keeps a
claim alive in front of an empty chair — and the breakage is invisible from
inside the extension.
