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

const targets = [
  {
    label: 'package.json',
    path: resolve(repoRoot, 'package.json'),
    update: (raw) => {
      const json = JSON.parse(raw);
      const before = json.version;
      json.version = version;
      // Preserve trailing newline + 2-space indent to match repo style.
      return { text: JSON.stringify(json, null, 2) + '\n', before };
    },
  },
  {
    label: 'src-tauri/tauri.conf.json',
    path: resolve(repoRoot, 'src-tauri', 'tauri.conf.json'),
    update: (raw) => {
      const json = JSON.parse(raw);
      const before = json.version;
      json.version = version;
      return { text: JSON.stringify(json, null, 2) + '\n', before };
    },
  },
  {
    label: 'src-tauri/Cargo.toml',
    path: resolve(repoRoot, 'src-tauri', 'Cargo.toml'),
    update: (raw) => {
      // Only touch the [package].version field, not any [dependencies] entries
      // that might happen to be on the line "version = ...".
      const lines = raw.split('\n');
      let inPackage = false;
      let before = null;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const sectionMatch = line.match(/^\s*\[([^\]]+)\]\s*$/);
        if (sectionMatch) {
          inPackage = sectionMatch[1] === 'package';
          continue;
        }
        if (inPackage) {
          const m = line.match(/^(\s*version\s*=\s*")([^"]+)(".*)$/);
          if (m) {
            before = m[2];
            lines[i] = `${m[1]}${version}${m[3]}`;
            break;
          }
        }
      }
      if (before === null) {
        throw new Error('Could not find [package].version in Cargo.toml');
      }
      return { text: lines.join('\n'), before };
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
