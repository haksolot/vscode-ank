---
id: TASK-bbda0142966d
type: task
slug: serve-ank-mcp-to-vs-code-natively-and-declare-ex
title: Serve ank mcp to VS Code natively, and declare extra corpora
created: 2026-09-03T11:37:55Z
author: claude-opus-5@vscode-ank
status: open
scope:
  - src/mcp/**
blocked_by: [TASK-dce6d0e0a701]
done_criteria: |
  The extension contributes an mcpServerDefinitionProviders entry and registers a provider returning an McpStdioServerDefinition running the located binary with mcp and --repo, one per corpus, with no configuration file written by us. The corpora assistant writes a declaration through ank config --user corpora.<identity> <path>, taking the identity from status.corpus and refusing a path where an identity is required.
criteria_by: creator
verify: [compile, lint, test]
schema: 4
version: 2
---

The native provider means no editing of mcp.json and no second copy of the
binary path to drift. A corpus is named by its root commit, never by a path, a
remote or a slug.
