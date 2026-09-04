---
id: TASK-3e279b4aca7c
type: task
slug: the-lockfile-names-a-registry-only-this-network
title: The lockfile names a registry only this network can reach
created: 2026-09-04T06:47:56Z
author: mb635291@bid-e613543
status: done
scope:
  - package-lock.json
blocked_by: []
done_criteria: |
  Every resolved URL in package-lock.json names registry.npmjs.org, npm ci resolves against it both here and on a GitHub runner, and CI is green on ubuntu, windows and macos.
criteria_by: creator
verify: [compile, lint]
proof:
  - type: test
    ref: local/b29daaf8f02c@689315f
    tree: scope/feee9c2a6438
    criteria: 52454b4a12db
    verifier: compile@1499ad9e1de7
    via: verifier
  - type: test
    ref: local/fcccc353eb3b@689315f
    tree: scope/feee9c2a6438
    criteria: 52454b4a12db
    verifier: lint@fdfbf957c961
    via: verifier
schema: 4
version: 3
---
