---
id: TASK-ecc8ea8087dd
type: task
slug: scaffold-the-extension-manifest-typescript-bundl
title: "Scaffold the extension: manifest, TypeScript, bundler, tests, CI"
created: 2026-09-03T11:37:25Z
author: claude-opus-5@vscode-ank
status: open
scope:
  - package.json
  - tsconfig.json
  - esbuild.mjs
  - eslint.config.mjs
blocked_by: []
done_criteria: |
  npm ci, npm run compile, npm run lint and npm test each exit 0 from a clean clone, and npx vsce package produces a .vsix. package.json declares engines.vscode ^1.104.0, activates on workspaceContains:.ank/config.yml, and contributes nothing that has no implementation.
criteria_by: creator
verify: [compile, lint, test]
schema: 4
version: 1
---

TypeScript in strict mode, bundled with esbuild, linted with a flat eslint
config, tested with @vscode/test-cli for integration and node:test for units.
`.vscode/launch.json` opens an Extension Development Host on this repository,
which has a corpus of its own to look at.

CI runs compile, lint and test on push.
