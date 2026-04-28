#!/usr/bin/env node
// Bump the Prezl VS Code extension version in vscode-extension/package.json.
//
// Usage: node .claude/skills/vscode-release/scripts/bump-vscode-version.mjs <version>
//   <version> follows semver, but Marketplace requires MAJOR.MINOR.PATCH only —
//   no `-beta.N` or other pre-release suffixes. Use a clean version and pass
//   --pre-release to vsce at publish time instead.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const STRICT_SEMVER = /^\d+\.\d+\.\d+$/;

const version = process.argv[2];
if (!version) {
  console.error('Usage: bump-vscode-version.mjs <version>');
  console.error('Example: bump-vscode-version.mjs 0.1.0');
  process.exit(1);
}
if (version.startsWith('v')) {
  console.error(`Drop the leading "v" — pass the bare version (got "${version}").`);
  process.exit(1);
}
if (!STRICT_SEMVER.test(version)) {
  console.error(
    `"${version}" is not a valid Marketplace version. Use MAJOR.MINOR.PATCH only — ` +
      `no pre-release suffixes. Pass --pre-release to vsce instead.`,
  );
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..', '..');
const manifest = resolve(repoRoot, 'vscode-extension', 'package.json');

const raw = readFileSync(manifest, 'utf8');
const re = /^(\s*"version"\s*:\s*")([^"]+)(")/m;
const m = raw.match(re);
if (!m) {
  console.error('Could not find a top-level "version" key in vscode-extension/package.json');
  process.exit(1);
}
const before = m[2];
writeFileSync(manifest, raw.replace(re, `$1${version}$3`));

console.log(`Bumped vscode-extension/package.json: ${before} → ${version}`);
console.log('\nNext: pnpm install   (refresh pnpm-lock.yaml)');
