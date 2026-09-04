/**
 * Points `package-lock.json` back at the registry everyone can reach.
 *
 * npm writes the registry it resolved through into every `resolved` URL. Run
 * `npm install` behind a corporate mirror and the lockfile ends up naming a
 * host that exists only inside that network; `npm ci` on a runner then hangs
 * on it until npm gives up with `Exit handler never called!`, which says
 * nothing about the cause.
 *
 * Only the host changes. A mirror that proxies npm serves the same tarballs,
 * so the integrity hashes stay correct, and npm swaps the registry host in a
 * `resolved` URL for the configured one -- so one lockfile installs through
 * the mirror here and through npmjs.org on a runner.
 *
 * Run it after adding or updating a dependency: `npm run lockfile`.
 */

import { readFileSync, writeFileSync } from 'node:fs';

const PUBLIC = 'https://registry.npmjs.org/';

/** Any registry host in a `resolved` URL, up to the package path. */
const RESOLVED = /"resolved":\s*"https?:\/\/[^"]*?\/(?=(?:@[^/"]+\/)?[^@/"]+\/-\/)/g;

const path = process.argv[2] ?? 'package-lock.json';
const before = readFileSync(path, 'utf8');
const after = before.replace(RESOLVED, `"resolved": "${PUBLIC}`);

// Parsing before writing: a lockfile that no longer loads is worse than one
// naming the wrong host, because the second at least fails where you can see
// it.
JSON.parse(after);

const elsewhere = [...after.matchAll(/"resolved":\s*"([^"]*)"/g)]
  .map(([, url]) => url)
  .filter((url) => !url.startsWith(PUBLIC));

if (elsewhere.length > 0) {
  console.error(`${String(elsewhere.length)} resolved urls are not on npmjs:`);
  for (const url of new Set(elsewhere.slice(0, 5))) {
    console.error(`  ${url}`);
  }
  process.exit(1);
}

if (after === before) {
  console.log(`${path} already points at ${PUBLIC}`);
} else {
  writeFileSync(path, after);
  console.log(`rewrote ${path} to ${PUBLIC}`);
}
