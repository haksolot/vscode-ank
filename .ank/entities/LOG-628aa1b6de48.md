---
id: LOG-628aa1b6de48
type: log
title: locate.ts spawned its own --version probe, which contradicted the claim that cli.ts is the only
created: 2026-09-03T12:08:21Z
author: claude-opus-5@vscode-ank
scope:
  - src/ank/**
  - src/test/unit/**
  - src/test/fixtures/**
about: TASK-dce6d0e0a701
seq: 4
schema: 4
version: 1
---

 file that starts a process. Routed it through AnkCli. opacity.test.ts now asserts the spawner list is exactly [src/ank/cli.ts], so the claim is checked rather than stated.
