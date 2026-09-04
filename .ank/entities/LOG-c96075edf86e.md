---
id: LOG-c96075edf86e
type: log
title: "Providing the MCP definition rather than writing an mcp.json matters beyond tidiness: the binary"
created: 2026-09-03T13:07:30Z
author: claude-opus-5@vscode-ank
scope:
  - src/mcp/**
  - src/extension.ts
  - package.json
about: TASK-bbda0142966d
seq: 3
schema: 4
version: 1
---

 this extension resolved is not the name on the PATH -- on Windows it is the executable behind a .cmd shim -- so a config file naming ank would declare a server the editor cannot spawn. Handing over the resolved path means the two cannot disagree.
