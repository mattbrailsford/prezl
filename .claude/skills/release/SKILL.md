---
name: release
description: Cut a Prezl release — bump versions, tag, push, and shepherd the GitHub Actions build into a published GitHub Release. Use this whenever the user wants to release, tag, ship, cut, or publish a Prezl version (stable or beta/pre-release), bump the app version, or prep a build for users. Also use it if they ask to retry a failed release run or recover from a partially-built tag.
argument-hint: "[version, e.g. 0.1.0-beta.1]"
---

# Releasing Prezl

Prezl ships per-platform installers (`.msi`/`.exe`, `.dmg`, `.AppImage`/`.deb`/`.rpm`) as GitHub Release assets. Tagging `v*` runs `.github/workflows/release.yml`, which uses `tauri-apps/tauri-action` to build on each platform's native runner and attach binaries to a **draft** GitHub Release. The full process doc is `docs/internal/releasing.md` — read it if anything below seems incomplete.

The whole release is one atomic act from the presenter's point of view, but mechanically it has three independent moving parts that all have to agree on the same version string:

- `package.json` → `version`
- `src-tauri/tauri.conf.json` → `version`
- `src-tauri/Cargo.toml` → `[package].version`

If these drift, the bundle metadata, the npm scripts, and the Rust crate disagree about what's being shipped, and `pnpm-lock.yaml` ends up referencing a stale `prezl@<old>` entry. The bundled `scripts/bump-version.mjs` keeps the trio in sync — prefer it over hand-editing.

## When the user asks for a release

Walk this loop. Don't skip steps — each one catches a class of mistake.

### 1. Confirm the version

If the user said a version (e.g. "tag 0.1.0-beta.1"), use it. Otherwise ask. Versions follow semver:

- Pre-release: `0.1.0-beta.1`, `0.1.0-beta.2`, `0.1.0-rc.1`, …
- Stable: `0.1.0`, `0.2.0`, …

The leading `v` belongs only on the **git tag**, never inside the version files. So the file value is `0.1.0-beta.1` and the tag is `v0.1.0-beta.1`.

The release workflow auto-marks any tag containing `-` as a GitHub pre-release. You don't need to do anything extra for betas.

### 2. Pre-flight checks

Before bumping anything, verify the working tree is in a state worth releasing:

```bash
git status              # working tree clean?
git branch --show-current   # on the right branch? (usually dev or main)
git pull --ff-only      # up to date with origin?
```

If the tree is dirty, ask the user what to do — don't auto-stash or auto-commit unrelated work into a release.

Read `package.json` to confirm the current version, so the user can see the bump being proposed (e.g. `0.1.0 → 0.1.0-beta.1`).

### 3. Bump all three files + lockfile

Run the bundled script:

```bash
node .claude/skills/release/scripts/bump-version.mjs 0.1.0-beta.1
```

It edits `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` to the same string and prints a summary. Then refresh the lockfile so `prezl@<new>` is resolved:

```bash
pnpm install
```

### 4. Verify locally

```bash
pnpm typecheck
pnpm test
```

Both must pass. The build runs in CI too, but catching a typecheck/test failure here is much cheaper than a 5-minute matrix failure on three OSes. If either fails, fix the cause before tagging — never tag-and-pray.

(Optional but recommended for the first beta: also run `pnpm tauri build` locally on the dev machine — slow, but proves the bundler works end-to-end with the new version metadata.)

### 5. Commit the bump

Match the repo's commit style — sentence-case imperative, concise. Examples from `git log`: "Update X", "Polish Y", "Refresh Z". A bump commit reads:

```
Bump to 0.1.0-beta.1
```

Do NOT pile unrelated changes into the bump commit — keep it surgical so the tag points at a clean, isolated version change.

```bash
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml pnpm-lock.yaml
git commit -m "Bump to 0.1.0-beta.1"
git push
```

### 6. Tag and push the tag

```bash
git tag v0.1.0-beta.1
git push origin v0.1.0-beta.1
```

Pushing the tag is what triggers `.github/workflows/release.yml`. From this point the user can watch progress at `https://github.com/mattbrailsford/prezl/actions`.

### 7. Watch the build

If `gh` is available, surface the run for the user:

```bash
gh run list --workflow=release.yml --limit 3
gh run watch        # then pick the latest run, or pass its id
```

The matrix has three jobs (windows-latest, macos-latest, ubuntu-22.04). All three must succeed for a complete release.

### 8. Edit and publish the draft

When the workflow finishes green, a **draft** release exists at `https://github.com/mattbrailsford/prezl/releases`. The user needs to:

1. Open the draft.
2. Replace the placeholder body with real release notes.
3. Click **Publish release**.

Offer to draft notes for them — pull recent commits since the previous tag (or since project start for the first release) and group them under headings like `## Highlights`, `## Fixes`, `## Internal`. Keep it user-facing, not a changelog dump.

```bash
# Commits since previous tag (or all commits if first release)
git log --oneline $(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")..HEAD
```

## Recovery scenarios

### One platform failed, others succeeded

The draft release already has assets from the green platforms. Use **workflow_dispatch** to retry just the failed run — the `tag` input lets you target the existing tag without re-tagging:

1. GitHub Actions → Release workflow → **Run workflow** button.
2. Enter the tag (e.g. `v0.1.0-beta.1`).
3. tauri-action updates the existing draft in place.

### The whole tag is bad (wrong version, wrong commit, etc.)

Delete the tag locally and remotely, delete the partial draft release on GitHub, then retag from the right commit:

```bash
git tag -d v0.1.0-beta.1
git push --delete origin v0.1.0-beta.1
# then on github.com: delete the draft release manually
```

This is destructive — confirm with the user before running `--delete` operations on shared state.

### "I tagged but the workflow didn't fire"

Common causes: tag pushed without `git push origin <tag>` (just `git push` doesn't push tags), or the tag doesn't match the `v*` glob. Check:

```bash
git ls-remote --tags origin    # is the tag on the remote?
```

If missing, push it explicitly: `git push origin v0.1.0-beta.1`.

## Things to push back on

- **Tagging without bumping the version files.** The build will succeed but the installer's "About" / metadata will say the wrong version. Always bump first.
- **Tagging from `main` without merging `dev`** (or vice versa). Confirm the user knows which branch they want the release commit on.
- **Skipping `pnpm install` after the bump.** The lockfile keeps an entry for `prezl@<self>`; if it's stale, CI's `pnpm install --frozen-lockfile` fails.
- **Force-pushing or amending after pushing the tag.** Once a tag is on origin and the workflow has started, treat it as immutable. If something's wrong, delete-and-retag rather than amend-and-force-push.

## Code signing status

Builds are **unsigned** today. macOS users see Gatekeeper warnings; Windows users see SmartScreen. This is fine for beta but should be flagged in release notes. When signing is wired up, the workflow secrets and `tauri-action` inputs change — see `docs/internal/releasing.md` "Code signing (deferred)" for the canonical setup.
