---
id: LOG-d35635fbbd25
type: log
title: "The integration test found a real bug that no unit test could: on Windows the name on the PATH is"
created: 2026-09-03T12:35:21Z
author: claude-opus-5@vscode-ank
scope:
  - src/providers/entityDocument.ts
  - src/providers/entityPanel.ts
  - src/providers/entityHtml.ts
  - src/test/unit/entityHtml.test.ts
  - src/test/integration/**
  - src/ank/locate.ts
about: TASK-0746b51ef279
seq: 2
schema: 4
version: 1
---

 ank.cmd, node refuses to spawn a .cmd without a shell (EINVAL, since the argument-injection fix), and the extension silently did not activate. shell:true would have made it run and would have put a command line back between us and the process, where a title carrying an ampersand becomes two commands. Resolved to the real .exe instead, the way the npm wrapper resolves it -- createRequire from the parent package, because npm may hoist the platform package or nest it and on this machine it nests.
