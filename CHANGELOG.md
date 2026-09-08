# Changelog

All notable changes to this extension are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the versioning is
[semantic](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **A reading opens the preview, wherever the reading started.** Choosing an
  entity in Find or in What Binds This File opened the detail panel, while
  clicking the same entity in a tree opened its preview. Both are somebody
  asking to read one entity, so both now open the same thing. A verb that
  changed something still leaves you in the panel, which is where the claim it
  took and the buttons for what comes next are.
- **Every command can be pointed at an `ank:` uri**, not just `ank.open`. What
  a command was pointed at is decided in one place now, for a tree row, a
  context menu, the panel and a uri alike.
- **Choosing a log entry opens it.** Every entry in a work trace is a `LOG-*`
  entity, and the picker over them offered rows that stood for nothing: the
  chosen one was read and dropped. A row now carries its id and choosing it
  opens the entry's preview. An entry migrated from a previous layout has no
  entity of its own, so its row reads and does not move rather than opening a
  neighbour's.
- **A context menu acts on the row it was opened on.** Right-clicking a task
  and choosing Read Log, Claim, Log, Done, Release, Close, Amend or Attest ran
  the picker and asked which entity, which the click had already said. A menu
  hands over the node and not the ref hanging off it, and the shape check
  stopped one field short.
- **A tree row opens the rendered preview**, not the entity's source. Clicking
  a task, a decision or a specification runs the built-in markdown preview
  against the `ank:` uri — the preview ADR-6b71ec0890de says a virtual scheme
  buys for no code. The source is still one click away, on the row's inline
  action and on the panel's button, and the detail panel is where a verb leaves
  you once it has changed something.

## [0.1.0] — 2026-09-03

First release. Written against ank 0.7.0 and document contract 1.

### Added

- **Four views** in an activity bar container: tasks grouped by what a reader
  can do about them and ordered ready-first, what binds the active file,
  decisions split on whether they bind anybody yet, and the `blocked_by` DAG.
- **Entities served on a read-only `ank:` scheme**, carrying what `ank show`
  returns byte for byte, with a detail panel beside it for what the file cannot
  say: the claim, the edges, the proofs, and the log split from the machinery.
- **A status bar line** showing the claim you hold and when it lapses, or what
  is takeable.
- **A command for every verb** the binary reports, generated from
  `ank help --json` so a command against a verb an older binary lacks is
  disabled rather than failing when clicked.
- **Findings in the Problems panel** from `ank check`, with faults as errors
  and signals as information.
- **Six read-only language model tools** — `ank_context`, `ank_find`,
  `ank_show`, `ank_scope`, `ank_status`, `ank_graph` — described in the verb
  table's own words.
- **`ank mcp` served natively**, one server per open corpus, with no
  configuration file to write.
- Settings: `ank.path`, `ank.agent`, `ank.check.onSave`.

### Notes

- `ank accept` is never executed. The command composes the line into a terminal
  and leaves it unsent: ratifying a decision is a signed commit on the default
  branch, and it is a human act.
- Nothing reads `.ank/` directly. A task's state is the file plus the claim ref
  plus the proof ref plus the log entities naming it, and a reader that walks
  the directory reports a held task as free.
- There is no timer anywhere. Change arrives from `ank watch`'s event stream,
  from a file watcher where no watcher runs, and from the refresh command.

[Unreleased]: https://github.com/haksolot/vscode-ank/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/haksolot/vscode-ank/releases/tag/v0.1.0
