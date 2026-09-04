This repo uses Ank: tasks and decisions live in `.ank/`.

Work through the loop. `ank context` before deciding anything, `ank claim`
before writing, `ank done` to finish — the verifiers are declared in
`.ank/config.yml` and run themselves. `.ank/` is opaque: read it with the verbs,
never by opening the files.

Two things about this repository in particular:

- After any `npm install`, run `npm run lockfile`. npm writes whichever
  registry it resolved through into `package-lock.json`, and a mirror's host
  does not resolve on a GitHub runner — `npm ci` there hangs and then dies with
  `Exit handler never called!`.
- Releasing is a tag, and the runbook is [docs/releasing.md](docs/releasing.md).
