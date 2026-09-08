# Changelog

All notable changes to this extension are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the versioning is
[semantic](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — 2026-09-08

First release. Written against ank 0.7.0 and document contract 1.

### Added

- **Four views** in an activity bar container: tasks grouped by what a reader
  can do about them and ordered ready-first, what binds the active file,
  decisions split on whether they bind anybody yet, and the `blocked_by` DAG.
- **Entities served on a read-only `ank:` scheme**, carrying what `ank show`
  returns byte for byte. Clicking a row renders it in the built-in markdown
  preview — the preview ADR-6b71ec0890de says a virtual scheme buys for no
  code. The source is one click away, on the row's inline action.
- **A detail panel** for what the file cannot say: the claim, the edges, the
  proofs, and the log split from the machinery, with the buttons that act on
  it. It is where a verb leaves you once it has changed something, and reading
  is not a verb.
- **A picker over a work trace that is a way in.** Every entry is a `LOG-*`
  entity, and choosing one opens it. An entry migrated from a previous layout
  is not an entity, so its row reads and does not move.
- **A status bar line** showing the claim you hold and when it lapses, or what
  is takeable.
- **A command for every verb** the binary reports, generated from
  `ank help --json` so a command against a verb an older binary lacks is
  disabled rather than failing when clicked. Each one acts on whatever pointed
  it — a tree row, its context menu, the panel or an `ank:` uri — and asks
  which entity only when nothing did.
- **Findings in the Problems panel** from `ank check`, with faults as errors
  and signals as information.
- **Six read-only language model tools** — `ank_context`, `ank_find`,
  `ank_show`, `ank_scope`, `ank_status`, `ank_graph` — described in the verb
  table's own words.
- **`ank mcp` served natively**, one server per open corpus, with no
  configuration file to write.
- Settings: `ank.path`, `ank.agent`, `ank.check.onSave`.

### Notes

- Reading opens the rendered document, wherever the reading started: a clicked
  row, a chosen search result, a chosen log entry. Writing leaves you in the
  panel. Those are the two routes, and they are named.
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
