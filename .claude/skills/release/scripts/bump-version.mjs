#!/usr/bin/env node
// Bump the Prezl version string in lockstep across:
//   - package.json
//   - src-tauri/tauri.conf.json
//   - src-tauri/Cargo.toml
//
// Usage: node .claude/skills/release/scripts/bump-version.mjs <version>
//   <version> follows semver (e.g. 0.1.0, 0.1.0-beta.1, 0.2.0-rc.2).
//   Do NOT include the leading "v" — that belongs only on the git tag.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const version = process.argv[2];
if (!version) {
  console.error('Usage: bump-version.mjs <version>');
  console.error('Example: bump-version.mjs 0.1.0-beta.1');
  process.exit(1);
}
if (version.startsWith('v')) {
  console.error(`Drop the leading "v" — pass the bare semver (got "${version}").`);
  process.exit(1);
}
if (!SEMVER.test(version)) {
  console.error(`"${version}" is not a valid semver string.`);
  process.exit(1);
}

// Repo root is two levels up from .claude/skills/release/scripts/
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..', '..');

// Replace only the top-level "version": "..." string in a JSON file via
// regex, so we preserve every other byte of formatting (inline arrays,
// trailing whitespace, key ordering). JSON.parse/stringify would round-trip
// these files into a single canonical style and produce noisy diffs.
function updateJsonVersion(raw, version) {
  const re = /^(\s*"version"\s*:\s*")([^"]+)(")/m;
  const m = raw.match(re);
  if (!m) {
    throw new Error('Could not find a top-level "version" key');
  }
  const before = m[2];
  return { text: raw.replace(re, `$1${version}$3`), before };
}

const targets = [
  {
    label: 'package.json',
    path: resolve(repoRoot, 'package.json'),
    update: (raw) => updateJsonVersion(raw, version),
  },
  {
    label: 'src-tauri/tauri.conf.json',
    path: resolve(repoRoot, 'src-tauri', 'tauri.conf.json'),
    update: (raw) => updateJsonVersion(raw, version),
  },
  {
    label: 'src-tauri/Cargo.toml',
    path: resolve(repoRoot, 'src-tauri', 'Cargo.toml'),
    update: (raw) => {
      // Anchor on the [package] header, then non-greedily skip ahead to the
      // first `version = "..."` line. Operating on the whole string (rather
      // than splitting on \n) sidesteps CRLF-vs-LF pitfalls — the file's
      // existing line endings round-trip untouched.
      const re = /(\[package\][\s\S]*?\n\s*version\s*=\s*")([^"]+)(")/;
      const m = raw.match(re);
      if (!m) {
        throw new Error('Could not find [package].version in Cargo.toml');
      }
      return { text: raw.replace(re, `$1${version}$3`), before: m[2] };
    },
  },
];

const summary = [];
for (const target of targets) {
  const raw = readFileSync(target.path, 'utf8');
  const { text, before } = target.update(raw);
  writeFileSync(target.path, text);
  summary.push({ label: target.label, before, after: version });
}

const colW = Math.max(...summary.map((s) => s.label.length));
console.log(`Bumped to ${version}:`);
for (const s of summary) {
  console.log(`  ${s.label.padEnd(colW)}  ${s.before} → ${s.after}`);
}
console.log('\nNext: pnpm install   (refresh pnpm-lock.yaml)');
