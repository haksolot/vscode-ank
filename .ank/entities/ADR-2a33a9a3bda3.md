---
id: ADR-2a33a9a3bda3
type: adr
slug: status-styling-reimplements-ank-s-role-table-and
title: Status styling reimplements ank's role table, and invents nothing
created: 2026-09-03T11:36:01Z
author: claude-opus-5@vscode-ank
status: proposed
scope:
  - src/ui/**
constraint: |
  Colour and icon for a status, kind or severity are derived from ank's published role table and its two lookup rules. No second vocabulary of statuses is defined anywhere in the UI.
schema: 4
version: 1
---

Upstream publishes meanings, not colours: a name maps to a role, and the client
picks how a role looks. The table is closed and small.

    open                            Available
    in_progress, claimed            Underway
    done, finished, accepted        Accomplished
    closed, superseded              Retired
    proposed                        Awaiting
    expired                         Attention
    task, adr, spec, log            Identifier
    fault                           Fault
    signal                          Attention

Two lookup rules, and both matter:

1. If the state string **contains** `expired`, the role is Attention whatever
   it expired from. Markers arrive as `open expired:who@host` and
   `done expired:who@host`.
2. Otherwise take everything **before the first colon**. What follows a colon
   is addressing, not state: `claimed:who@host`, `finished:abc1234 on main`.

`blocked` is deliberately absent from the table. It is derived from
`blocked_by` at read time and no entity is stored carrying it, so the UI
derives it too and never looks it up.

A name the table does not carry returns no role, and no role means leave it
alone — the default foreground, not a colour we chose for the unknown.
