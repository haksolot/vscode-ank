---
id: TASK-dce6d0e0a701
type: task
slug: the-cli-adapter-spawn-contract-gate-exit-codes-t
title: "The CLI adapter: spawn, contract gate, exit codes, typed verbs"
created: 2026-09-03T11:37:26Z
author: claude-opus-5@vscode-ank
status: done
scope:
  - src/ank/**
  - src/test/unit/**
  - src/test/fixtures/**
blocked_by: [TASK-ecc8ea8087dd]
done_criteria: |
  src/ank/ exposes one typed wrapper per verb and is the only module that spawns a process. Unit tests parse all 28 golden-json fixtures copied from the ank repository and assert every field of the shape each verb declares. A test asserts an error[N] stderr block parses to AnkError with code, message and hint, and that a non-zero exit with empty stdout is never parsed as JSON. No file under src/ opens a path inside .ank/.
criteria_by: creator
verify: [compile, lint, test]
proof:
  - type: test
    ref: local/b29daaf8f02c@a53de47
    tree: scope/f2f0f97e8769
    criteria: 28ec341d5975
    verifier: compile@1499ad9e1de7
    via: verifier
  - type: test
    ref: local/fcccc353eb3b@a53de47
    tree: scope/f2f0f97e8769
    criteria: 28ec341d5975
    verifier: lint@fdfbf957c961
    via: verifier
  - type: test
    ref: local/96bfb2a7db2b@a53de47
    tree: scope/f2f0f97e8769
    criteria: 28ec341d5975
    verifier: test@c6dbe1d43704
    via: verifier
schema: 4
version: 5
---

Upstream offers its fixtures for exactly this: "If you are writing a client,
these are the exact bytes to write it against." They are captured from the
process rather than from a function, so what they pin is what leaves the
binary. A shape that changes there without its fixture changing is a failing
test on their side, which is what makes the copy worth keeping.
