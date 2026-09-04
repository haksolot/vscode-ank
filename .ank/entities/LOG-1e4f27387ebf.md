---
id: LOG-1e4f27387ebf
type: log
title: "The PNG is generated rather than committed as an opaque binary: scripts/icon.mjs writes it from the"
created: 2026-09-03T13:17:33Z
author: claude-opus-5@vscode-ank
scope:
  - README.md
  - CHANGELOG.md
  - .github/workflows/**
  - resources/**
  - scripts/**
  - package.json
  - .vscodeignore
about: TASK-8535e5295132
seq: 3
schema: 4
version: 1
---

 same ten rectangles the SVG draws, with node's zlib and no dependency. Because the grid is 24 units and the scale is a whole 5, every edge lands on a pixel boundary and nothing is resampled. The release workflow regenerates it and fails on a diff, so the checked-in binary cannot drift from the source it claims to come from.
