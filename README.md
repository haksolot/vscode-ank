<h1 align="center">vscode-ank</h1>

<p align="center"><strong>Tasks and architecture decisions from your repository, in the editor.</strong><br>
A client for the <a href="https://github.com/haksolot/ank">ank</a> CLI.</p>

---

An agent that spawns on your codebase can read every line of it. It cannot read
your tracker, your wiki, or the thread where you decided six months ago that
sessions must never be self-contained JWTs. [ank][ank] puts that layer in the
repository, attached to the code it constrains, and serves it through one
command surface.

This extension is a reader and a driver for that surface. It shows what binds
the file you have open, what work is takeable, who holds what, and what the
last holder learned — and it runs the verbs from the palette, from a tree, or
from a panel beside the entity.

## Requirements

The `ank` executable, and git 2.34 or newer.

```sh
npm install -g @haksolot/ank
```

Other routes — a `curl | sh` line, a PowerShell one-liner, `cargo install` —
are in [handing ank to an agent][agents]. Point `ank.path` at the executable if
it is somewhere the `PATH` does not reach.

The extension activates only in a window whose workspace carries a `.ank/`
corpus, so a window without one pays nothing for having it installed.

## What it gives you

**Four views**, in an activity bar container of their own.

- **Tasks**, grouped by what you can do about them — in progress, ready,
  blocked, finished — and ordered the way ank orders them: ready first, then by
  how many other tasks each would unblock. That ordering is the answer to
  "what should I take next", so it is taken from the corpus rather than
  re-sorted for display.
- **Binds This File**, which answers `ank scope` on whatever editor is active:
  the constraints that bind this path, the specifications that govern it, and
  the tasks that touch it. Attaching decisions to globs instead of to labels is
  what makes that question have a mechanical answer.
- **Decisions**, split on whether they bind anybody yet. A proposed ADR binds
  nobody until a human ratifies it, and that is not a detail to bury in a
  tooltip.
- **Graph**, the `blocked_by` DAG indented under what blocks it.

**An entity, opened.** Clicking a row opens the file itself on a read-only
`ank:` scheme — byte for byte what `ank show` returns, rendered as markdown,
searchable and diffable — with a panel beside it carrying what the file cannot
say: who holds it, what it waits on, what it unblocks, and its log split from
the machinery the verbs wrote.

**A status bar line.** The claim you hold and when it lapses, or what is
takeable. Click it for the branch, the drift from the default branch, and who
holds what elsewhere.

**Every verb, as a command.** `ank: Claim Task`, `ank: Log Against Task`,
`ank: Finish Task`, `ank: New Decision`, and the rest. A refusal is reported as
what it is — a fact about the corpus — with the exact next command the CLI
named, ready to copy.

**Findings in the Problems panel.** `ank: Check` puts faults in as errors and
signals in as information. Signals are deliberately not warnings: a signal
alone leaves the exit code 0, and reddening a build over an observation teaches
a team to stop reading `check`.

**Two surfaces for an agent.** Six read-only language model tools — context,
find, show, scope, status, graph — so Copilot can read the corpus without a
second server. And `ank mcp` served to the editor natively, one server per open
corpus, with no `mcp.json` to write and no binary path to keep in step.

## What it will not do

**It never runs `ank accept`.** Ratifying a decision is a signed commit on the
default branch, and it is a human act. The command composes the line into a
terminal and leaves it unsent.

**It never reads `.ank/` directly.** A task's state is not in its file: it is
the file, plus the claim ref, plus the proof ref, plus the log entities that
name it. A reader that walks the directory reports a held task as free, with no
error and no way for you to tell. Everything here goes through the CLI.

**It holds no timer.** Change arrives from `ank watch`'s event stream where one
is running, from a file watcher where none is, and from the refresh command
always. `ank check` is never on a timer either — it prunes the stale claim refs
it finds, so it writes, and it walks git history.

## Settings

| Setting | Default | What it does |
|---|---|---|
| `ank.path` | `""` | Path to the executable. Empty means the one on your `PATH`. |
| `ank.agent` | `""` | The identity this window writes claims under, as `$ANK_AGENT`. Empty derives one from the editor. |
| `ank.check.onSave` | `false` | Run `ank check` when a file in a corpus is saved. Worth leaving off. |

**On `ank.agent`.** Two windows on one working tree with no distinct identities
are **one agent** as far as the claim refs are concerned: they share a claim
instead of arbitrating over it, and the second is quietly refused work it
should have been given. The extension derives a per-installation identity by
default, which is right for one window per tree. Set this where you run
several.

## Several corpora

A multi-root window shows each corpus side by side, and never as one. Claims
are per repository, and `refs/ank/*` cannot carry an arbitration between
clones, so nothing here ranks a task from one against a task from another or
counts what is ready across them. Every entity is addressed as a pair — the
corpus and the id.

## Contributing

The decisions this extension is held to live in its own `.ank/`, which is the
point: `ank find --type adr` lists them and `ank show <id>` prints one whole.

```sh
npm install
npm run compile        # typecheck and bundle
npm run lint
npm test               # unit tests, no editor needed
npm run test:integration   # in a real editor, against this repository
```

Press <kbd>F5</kbd> for an Extension Development Host opened on this
repository, which carries a corpus to look at.

Behind a proxy that blocks `update.code.visualstudio.com`, point
`ANK_TEST_VSCODE` at an installed `Code.exe` and the integration tests will use
it instead of downloading one.

## Licence

Apache-2.0, matching the CLI it integrates. See [LICENSE](LICENSE).

[ank]: https://github.com/haksolot/ank
[agents]: https://github.com/haksolot/ank/blob/main/docs/agents.md
