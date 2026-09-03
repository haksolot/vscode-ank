---
id: TASK-f36e345f5ca0
type: task
slug: read-only-language-model-tools
title: Read-only language model tools
created: 2026-09-03T11:37:56Z
author: claude-opus-5@vscode-ank
status: done
scope:
  - src/lm/**
  - src/lm/offered.ts
  - src/test/unit/lm.test.ts
  - package.json
blocked_by: [TASK-dce6d0e0a701]
done_criteria: |
  The manifest contributes languageModelTools for context, find, show, scope, status and graph and for no verb that writes, asserted by a test comparing the contributed names against the verb table. Each modelDescription is the verb's own summary from ank help --json, and each tool returns the raw JSON document as its result.
criteria_by: creator
verify: [compile, lint, test]
proof:
  - type: test
    ref: local/b29daaf8f02c@2044986
    tree: scope/c6d93edc2834
    criteria: 1b5ccfcef755
    verifier: compile@1499ad9e1de7
    via: verifier
  - type: test
    ref: local/fcccc353eb3b@2044986
    tree: scope/c6d93edc2834
    criteria: 1b5ccfcef755
    verifier: lint@fdfbf957c961
    via: verifier
  - type: test
    ref: local/18b646ad6a6b@2044986
    tree: scope/c6d93edc2834
    criteria: 1b5ccfcef755
    verifier: test@c6dbe1d43704
    via: verifier
schema: 4
version: 5
---

Taking the descriptions from the verb table rather than writing our own keeps
them from disagreeing with the tool the model is actually calling.
