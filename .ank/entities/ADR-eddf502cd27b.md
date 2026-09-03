---
id: ADR-eddf502cd27b
type: adr
slug: a-repaint-calls-status-and-find-and-nothing-else
title: A repaint calls status and find, and nothing else
created: 2026-09-03T11:35:28Z
author: claude-opus-5@vscode-ank
status: proposed
scope:
  - src/corpus/**
  - src/ui/**
constraint: |
  No refresh the user did not ask for may run a verb that renews a lease or writes: context, show, read, amend, attest, edit, check and review are reached from an explicit user action and from no timer. A corpus repaint runs status, find and graph. A view answering the user's own navigation may additionally run scope. None of those four renews a lease or writes.
schema: 4
version: 3
---

Two separate hazards make this one rule.

**Some read verbs renew a lease.** `show`, `read`, `amend`, `attest` and `edit`
renew the task their id names when the caller holds it; `context` in execution
mode renews the task the caller holds. A view that polled `show` on the user's
claimed task would keep that claim alive all night in front of an empty chair,
and no other agent could take the work. Upstream asserts the same rule for its
own reader in `an_event_repaints_the_list_and_renews_no_claim`.

**`check` writes.** It prunes the claim refs it finds stale, and it walks git
history to say where a dead scope went. `review` shares that walk. Losing a
coordination ref loses a fact nothing else carries. A dashboard refreshing
every thirty seconds must not call either.

`status` and `find` are what a poll uses. They are also enough: `status` gives
the claim, the drift, the queue and the counts; `find` gives the entities.

There is no timer anywhere in this extension. Change arrives from
`events.jsonl` when a watcher is running, from a `FileSystemWatcher` on `.ank/`
when one is not, and from the refresh command always.
