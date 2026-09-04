---
id: LOG-238433ddecfa
type: log
title: "meaning.ts imported vscode, which put the role table out of reach of node --test. Split it:"
created: 2026-09-03T12:39:51Z
author: claude-opus-5@vscode-ank
scope:
  - src/ui/**
  - src/extension.ts
  - resources/**
  - src/test/unit/meaning.test.ts
  - package.json
about: TASK-d1233dd19832
seq: 6
schema: 4
version: 1
---

 meaning.ts is the table and the two lookup rules and imports nothing; theme.ts maps a role to a ThemeIcon and a ThemeColor. The part that could be wrong about ank is now testable and the part that could be wrong about VS Code is small.
