# Releasing

A release is a tag. `.github/workflows/release.yml` builds the extension once
and sends that one `.vsix` to three places: the GitHub release, the VS Code
Marketplace, and Open VSX.

Everything below the first section is a one-time setup that has to be done by a
person, because it involves accounts and tokens.

## Cutting a release

1. Move the entries under `## [Unreleased]` in `CHANGELOG.md` into a new
   version heading, with the date, and add the two link definitions at the
   bottom.
2. Set the version: `npm version <major|minor|patch> --no-git-tag-version`.
3. Commit both, then tag and push:

   ```sh
   git tag v0.1.0
   git push origin main --tags
   ```

The workflow refuses a tag that disagrees with `package.json`, and refuses an
icon that is not what `npm run icon` draws. It runs lint, compile and the unit
suite before it packages anything.

## Accounts

### VS Code Marketplace

The Marketplace identifies a publisher through Azure DevOps, so it needs a
Microsoft account and an Azure DevOps organisation before it needs anything
about the extension.

1. Create an Azure DevOps organisation at <https://dev.azure.com>.
2. Create the publisher `haksolot` at
   <https://marketplace.visualstudio.com/manage>. The id must match
   `publisher` in `package.json`.
3. Mint a personal access token: the avatar menu in Azure DevOps → **Personal
   access tokens** → **New Token**. Set **Organization** to *All accessible
   organizations* — a token scoped to one organisation is rejected by the
   Marketplace — and give it the **Marketplace → Manage** scope and nothing
   else. Copy it; it is shown once.

The maximum lifetime is one year, so this is a recurring errand. A publish that
fails on an expired token costs a re-run, not a rebuild: the GitHub release is
created before either registry is touched.

### Open VSX

1. Sign in at <https://open-vsx.org> with GitHub and sign the publisher
   agreement, which the Eclipse Foundation requires before a first publish.
2. Create an access token from the profile page.
3. Claim the namespace once, from any machine:

   ```sh
   npx ovsx create-namespace haksolot -p <token>
   ```

   This is deliberately not in the workflow. It is a one-time act, and it fails
   on a namespace that already exists.

## Secrets

Both go in **Settings → Secrets and variables → Actions** on the repository:

| Secret | From |
| --- | --- |
| `VSCE_PAT` | the Azure DevOps token, Marketplace → Manage |
| `OVSX_PAT` | the Open VSX access token |

`GITHUB_TOKEN` is provided by Actions and needs nothing.

The workflow names a missing secret and stops, rather than letting the registry
answer with an authentication error several steps later.

## The lockfile

`package-lock.json` pins every dependency to `registry.npmjs.org`, which is the
only host a runner can reach. Any `npm install` run behind a registry mirror
rewrites those URLs to the mirror, and `npm ci` on a runner then hangs and dies
with `Exit handler never called!`.

After adding or updating a dependency:

```sh
npm run lockfile
```

It rewrites the host back and leaves the integrity hashes alone, which is
correct as long as the mirror proxies npm rather than repackaging.
