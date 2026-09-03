---
id: TASK-f36e345f5ca0
type: task
slug: read-only-language-model-tools
title: Read-only language model tools
created: 2026-09-03T11:37:56Z
author: claude-opus-5@vscode-ank
status: open
scope:
  - src/lm/**
blocked_by: [TASK-dce6d0e0a701]
done_criteria: |
  The manifest contributes languageModelTools for context, find, show, scope, status and graph and for no verb that writes, asserted by a test comparing the contributed names against the verb table. Each modelDescription is the verb's own summary from ank help --json, and each tool returns the raw JSON document as its result.
criteria_by: creator
verify: [compile, lint, test]
schema: 4
version: 2
---

Taking the descriptions from the verb table rather than writing our own keeps
them from disagreeing with the tool the model is actually calling.
