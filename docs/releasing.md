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
Microsoft account before it needs anything about the extension.

1. Create the publisher `haksolot` at
   <https://marketplace.visualstudio.com/manage>. The id must match
   `publisher` in `package.json`. This asks for the Microsoft account and
   nothing else.

Then the workflow needs something to authenticate as, and the two answers have
very different lifetimes. `AZURE_CLIENT_ID` is the switch: set, a release takes
the first route; unset, it takes the second.

#### Entra ID, which stores no secret

The identity here is an **app registration**, where Microsoft's own
instructions use a user-assigned managed identity. A managed identity lives
inside a subscription and dies with it, and the subscription below exists only
because creating an organisation demanded one — an app registration lives in
the tenant and outlives all of that.

1. **Register the identity.** Entra ID → **App registrations** → **New
   registration**. Any name; none of it is public. Record the **Application
   (client) ID** and the **Directory (tenant) ID**.
2. **Let GitHub speak for it.** The registration → **Certificates & secrets**
   → **Federated credentials** → **Add credential** → *GitHub Actions
   deploying Azure resources*. Organisation `haksolot`, repository
   `vscode-ank`, entity type **Environment**, name `release`. The subject it
   writes is `repo:haksolot/vscode-ank:environment:release`, which is why both
   workflows put their job in that environment: a tag cannot be a subject,
   because the subject would have to name a tag that does not exist yet.
3. **Make the environment**, if the first run has not already: **Settings →
   Environments → New environment**, named `release`, **with no reviewers**. A
   reviewer here makes every release wait for a human who was not told to
   expect it.
4. **Find out what the Marketplace will call it.** Run the **Marketplace
   identity** workflow by hand, passing the client and tenant ids as its two
   inputs. It signs in as the identity and asks `app.vssps.visualstudio.com`
   who that is; the `id` in the answer is the identity's Visual Studio profile
   id, and it is the only handle the Marketplace accepts. That id is readable
   only by the identity itself, which is why the asking happens in a workflow
   rather than here — the alternative is a client secret on a laptop, which is
   the thing this route exists to remove.
5. **Authorise it.** <https://marketplace.visualstudio.com/manage/publishers/haksolot>
   → **Members** → add that id with the **Contributor** role.
6. **Throw the switch, last.** **Settings → Secrets and variables → Actions →
   Variables**: `AZURE_CLIENT_ID` and `AZURE_TENANT_ID`. Variables rather than
   secrets, because neither value is one. Last, because `AZURE_CLIENT_ID` is
   what moves the release off the PAT: set it before step 5 and a release
   landing in between would authenticate as an identity the publisher has
   never heard of, with no fallback. That is also why step 4 takes inputs
   instead of reading these.

Nothing in this route expires, there is no token to rotate, and the repository
holds no secret for it: each run mints a token from GitHub's own OIDC assertion
and it dies with the job.

#### A personal access token, until December 1 2026

On **December 1 2026** Azure DevOps retires global PATs, and *All accessible
organizations* — the only scope the Marketplace accepts — is exactly what makes
a PAT global. Every Marketplace PAT stops working on that date. This route is
written down because it is what shipped 0.1.0, not because it has a future.

1. Create an Azure DevOps organisation at <https://dev.azure.com>. This is the
   step that bites: an organisation now has to be linked to an Azure
   subscription you hold Owner or Contributor on, and with no subscription the
   picker comes up empty and the signup dead-ends. Until one exists,
   <https://dev.azure.com/_usersSettings/tokens> answers 404 — the tokens page
   is scoped to an organisation, which is the whole reason a token cannot be
   minted without one.

   The organisation is free and stays free. The free tier is five Basic users,
   one hosted CI/CD job and unlimited private repos, and we use none of it:
   the organisation exists so that the token page exists.

   Benefit-based subscriptions count — Visual Studio, student, trial,
   sponsorship — and *Azure for Students* asks for an institutional address
   rather than a card, which is the only card-free route. Otherwise an Azure
   free account wants a phone number and a card for identity verification.
2. Mint a personal access token: the avatar menu in Azure DevOps → **Personal
   access tokens** → **New Token**. Set **Organization** to *All accessible
   organizations* — a token scoped to one organisation is rejected by the
   Marketplace — and give it the **Marketplace → Manage** scope and nothing
   else. Ninety days is the longest preset, and it already outlives the
   retirement date. Copy it; it is shown once.

A publish that fails on an expired token costs a re-run, not a rebuild: the
GitHub release is created before either registry is touched, and creating it is
idempotent, so the re-run gets past it.

#### By hand

Worth knowing for the day both routes are broken and the release matters: the
publisher page takes a `.vsix` directly, under **⋯ → New extension → Visual
Studio Code**. It wants no token, no identity and no organisation. It also
leaves the workflow's Marketplace step with nothing to do, so a release
published that way is a release the pipeline did not make.

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

| Secret | From | Wanted by |
| --- | --- | --- |
| `VSCE_PAT` | the Azure DevOps token, Marketplace → Manage | the Marketplace, PAT route only |
| `OVSX_PAT` | the Open VSX access token | Open VSX |

And two **variables**, in the tab beside it, which are what select the Entra
route:

| Variable | From |
| --- | --- |
| `AZURE_CLIENT_ID` | the app registration's Application (client) ID |
| `AZURE_TENANT_ID` | the Directory (tenant) ID |

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
