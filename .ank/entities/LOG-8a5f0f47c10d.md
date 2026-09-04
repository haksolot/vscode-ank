---
id: LOG-8a5f0f47c10d
type: log
title: One server per corpus rather than one multiplexing them. A single process can reach several through
created: 2026-09-03T13:07:35Z
author: claude-opus-5@vscode-ank
scope:
  - src/mcp/**
  - src/extension.ts
  - package.json
about: TASK-bbda0142966d
seq: 4
schema: 4
version: 1
---

 the corpus argument, but only over corpora declared in corpora.yml, and every call still lands in one repository. One per open folder needs no declaration and cannot address the wrong corpus.
