---
id: TASK-dce6d0e0a701
type: task
slug: the-cli-adapter-spawn-contract-gate-exit-codes-t
title: "The CLI adapter: spawn, contract gate, exit codes, typed verbs"
created: 2026-09-03T11:37:26Z
author: claude-opus-5@vscode-ank
status: open
scope:
  - src/ank/**
blocked_by: [TASK-ecc8ea8087dd]
done_criteria: |
  src/ank/ exposes one typed wrapper per verb and is the only module that spawns a process. Unit tests parse all 28 golden-json fixtures copied from the ank repository and assert every field of the shape each verb declares. A test asserts an error[N] stderr block parses to AnkError with code, message and hint, and that a non-zero exit with empty stdout is never parsed as JSON. No file under src/ opens a path inside .ank/.
criteria_by: creator
verify: [compile, lint, test]
schema: 4
version: 2
---

Upstream offers its fixtures for exactly this: "If you are writing a client,
these are the exact bytes to write it against." They are captured from the
process rather than from a function, so what they pin is what leaves the
binary. A shape that changes there without its fixture changing is a failing
test on their side, which is what makes the copy worth keeping.
