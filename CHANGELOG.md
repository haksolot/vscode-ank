# Changelog

All notable changes to this extension are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the versioning is
[semantic](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
