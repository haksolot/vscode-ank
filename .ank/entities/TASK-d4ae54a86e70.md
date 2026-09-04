---
id: TASK-d4ae54a86e70
type: task
slug: opening-an-entity-opens-the-panel-and-not-the-fi
title: Opening an entity opens the panel, and not the file beside it
created: 2026-09-03T13:22:48Z
author: claude-opus-5@vscode-ank
status: done
scope:
  - src/extension.ts
  - src/providers/entityDocument.ts
  - src/providers/entityHtml.ts
blocked_by: []
done_criteria: |
  Clicking a row in any tree reveals the detail panel and opens no text editor, asserted by a test that counts the visible editors before and after. The panel's own button opens the file on the ank: scheme, and does so without a second ank show: the document is fetched once per click and the text provider serves what is already held.
criteria_by: creator
verify: [compile, lint, test]
proof:
  - type: test
    ref: local/b29daaf8f02c@17bb459
    tree: scope/67b0ed46ac3d
    criteria: 4b11d7465cdd
    verifier: compile@1499ad9e1de7
    via: verifier
  - type: test
    ref: local/fcccc353eb3b@17bb459
    tree: scope/67b0ed46ac3d
    criteria: 4b11d7465cdd
    verifier: lint@fdfbf957c961
    via: verifier
  - type: test
    ref: local/c323dd5b6dbe@17bb459
    tree: scope/67b0ed46ac3d
    criteria: 4b11d7465cdd
    verifier: test@c6dbe1d43704
    via: verifier
schema: 4
version: 4
---

Two tabs for one click, and the second one is the same entity in a plainer
form. The panel already carries a button for the file, which is the right
place for it: reading the frontmatter raw is the occasional thing, not the
default one.

There is a mechanical reason to prefer it too. `show` renews the claim when
the id names the task the caller holds, so every extra fetch is an extra
renewal. Fetching once per click and serving the held document to the text
provider means clicking through a tree costs one `show` per row rather than
one per row per surface.
