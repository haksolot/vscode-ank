---
id: TASK-b8bf53f4b83a
type: task
slug: ci-has-no-ank-so-the-test-that-finds-the-real-on
title: CI has no ank, so the test that finds the real one cannot run
created: 2026-09-04T06:58:15Z
author: mb635291@bid-e613543
status: done
scope:
  - .github/workflows/ci.yml
blocked_by: []
done_criteria: |
  The CI job installs ank before it runs the tests, and all 168 unit tests pass on ubuntu, windows and macos -- including the one that locates the real binary and reads its version.
criteria_by: creator
verify: [compile, lint]
proof:
  - type: test
    ref: local/b29daaf8f02c@f9b4c24
    tree: scope/4dc1fd07a637
    criteria: a504842585ed
    verifier: compile@1499ad9e1de7
    via: verifier
  - type: test
    ref: local/fcccc353eb3b@f9b4c24
    tree: scope/4dc1fd07a637
    criteria: a504842585ed
    verifier: lint@fdfbf957c961
    via: verifier
schema: 4
version: 3
---
