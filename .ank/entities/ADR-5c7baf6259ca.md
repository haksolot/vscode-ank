---
id: ADR-5c7baf6259ca
type: adr
slug: language-model-tools-are-read-only
title: Language model tools are read-only
created: 2026-09-03T11:36:02Z
author: claude-opus-5@vscode-ank
status: proposed
scope:
  - src/lm/**
constraint: |
  Tools registered with vscode.lm expose context, find, show, scope, status and graph, and no verb that writes to the corpus, to git refs or to the filesystem.
schema: 4
version: 1
---

A tool call is a decision the model makes and the user approves in a dialog
that is easy to wave through. Claiming a task, logging against it or finishing
it are acts a person should be making deliberately, from a surface that shows
what is about to happen.

Read-only is also the honest division of labour. An agent that needs to write
has `ank mcp`, which the extension configures natively and which spawns the CLI
with the CLI's own refusals intact.

Two of the exposed verbs renew a lease when the caller holds the task —
`show` and `context`. That is correct here and is not a violation of the
repaint rule: a model calling them is an agent doing work, not a screen
repainting itself.
