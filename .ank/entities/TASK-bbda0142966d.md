---
id: TASK-bbda0142966d
type: task
slug: serve-ank-mcp-to-vs-code-natively-and-declare-ex
title: Serve ank mcp to VS Code natively, and declare extra corpora
created: 2026-09-03T11:37:55Z
author: claude-opus-5@vscode-ank
status: done
scope:
  - src/mcp/**
  - src/extension.ts
  - package.json
blocked_by: [TASK-dce6d0e0a701]
done_criteria: |
  The extension contributes an mcpServerDefinitionProviders entry and registers a provider returning an McpStdioServerDefinition running the located binary with mcp and --repo, one per corpus, with no configuration file written by us. The corpora assistant writes a declaration through ank config --user corpora.<identity> <path>, taking the identity from status.corpus and refusing a path where an identity is required.
criteria_by: creator
verify: [compile, lint, test]
proof:
  - type: test
    ref: local/b29daaf8f02c@2044986
    tree: scope/4d72b6bd2d53
    criteria: c45a8d2a11f2
    verifier: compile@1499ad9e1de7
    via: verifier
  - type: test
    ref: local/fcccc353eb3b@2044986
    tree: scope/4d72b6bd2d53
    criteria: c45a8d2a11f2
    verifier: lint@fdfbf957c961
    via: verifier
  - type: test
    ref: local/d3c0027015e9@2044986
    tree: scope/4d72b6bd2d53
    criteria: c45a8d2a11f2
    verifier: test@c6dbe1d43704
    via: verifier
schema: 4
version: 5
---

The native provider means no editing of mcp.json and no second copy of the
binary path to drift. A corpus is named by its root commit, never by a path, a
remote or a slug.
