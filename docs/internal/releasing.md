# Releasing

Prezl ships per-platform installers as GitHub Release assets, built
by `.github/workflows/release.yml` using
[`tauri-apps/tauri-action`](https://github.com/tauri-apps/tauri-action).

## What the workflow does

Triggered by pushing a tag matching `v*` (or via workflow_dispatch
against an existing tag). For each platform it:

1. Checks out the tagged commit.
2. Installs pnpm 10 + Node 24, restores the Rust cache.
3. Runs `pnpm tauri build` via tauri-action.
4. Creates (or updates) a **draft** GitHub Release named `Prezl <tag>`
   and attaches the platform's installers.

Tags containing `-` (e.g. `v0.1.0-beta.1`) are marked as pre-releases.

| Runner | Artifacts |
| --- | --- |
| `windows-latest` | `.exe` (NSIS installer) and a `*-portable.exe` |
| `macos-latest` | `.dmg`, `.app.tar.gz` (universal: arm64 + x86_64) |
| `ubuntu-24.04` | `.AppImage`, `.deb`, `.rpm` |

MSI is intentionally skipped on Windows — Windows Installer's version
field can't carry semver pre-release identifiers like `-beta.1`. NSIS
handles them fine and is the format most end users want.

The portable Windows build is just the unbundled `prezl.exe` renamed
to `Prezl_<version>_x64-portable.exe`. At runtime, Prezl checks its
own filename: if it contains "portable" (case-insensitive), it stores
preferences/recents in `<exe-dir>/data/` instead of `appConfigDir`.
That way a single file is enough — drop it anywhere and run. Linux
already has portable distribution via the AppImage; macOS .app
bundles are inherently relocatable.

The Linux runner uses Tauri 2's canonical dependency set
(`libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, etc.) — see
the workflow file for the exact list.

## Dependency pinning (`src-tauri/Cargo.lock` is committed)

`src-tauri/Cargo.lock` is checked in — it is **not** gitignored, on
purpose. Prezl ships as an application, so the Rust dependency graph
must be pinned for reproducible CI builds. Without the committed lock,
each release runner re-resolves crates to the newest semver-compatible
versions at build time, so a release that worked last month can fail
today purely from upstream churn — nothing in the repo changed.

This bit us cutting `v0.1.0`: a fresh resolve pulled `tauri-utils
2.9.2` + `time 0.3.48`, which fail to compile together (`error[E0119]:
conflicting implementations` in `tauri-utils`), so all three platforms
failed identically. The earlier beta had built fine only because its
runner happened to resolve the older, compatible `time 0.3.47`.

Committing the lock fixes the class of problem: CI now builds the exact
versions verified locally. To update dependencies deliberately, run
`cargo update` (optionally `-p <crate>`) in `src-tauri/`, rebuild, and
commit the changed `Cargo.lock` like any other source change — don't
let it drift silently. When a release build fails on a dependency
compile error, suspect the lock is stale or absent before suspecting
the release content.

## Cutting a release

1. Pick the new version. Pre-releases use semver pre-release suffixes
   (`0.1.0-beta.1`, `0.1.0-beta.2`, …).
2. Write `RELEASE_NOTES.md` at the repo root summarising what's in this
   release. The workflow's "Prepare release body" step picks this file
   up and uses it as the GitHub Release body. If the file is missing,
   a generic placeholder is used and you'll have to edit the draft on
   GitHub before publishing.
3. Bump the version in **all three** files — they must agree:
   - `package.json` → `version`
   - `src-tauri/tauri.conf.json` → `version`
   - `src-tauri/Cargo.toml` → `[package].version`

   The bundled script keeps them in sync:
   ```bash
   node .claude/skills/release/scripts/bump-version.mjs 0.1.0-beta.1
   ```
4. Run `pnpm install` to refresh `pnpm-lock.yaml`. Then sync the Rust
   lockfile's own version entry — `cargo update -p prezl` in
   `src-tauri/` (any cargo build also does it) — so the committed
   `Cargo.lock` matches the bumped `Cargo.toml`. Finally `pnpm
   typecheck` and `pnpm test`.
5. Commit the release files together (e.g. `Bump to 0.1.0-beta.1`) —
   the version trio, `pnpm-lock.yaml`, `src-tauri/Cargo.lock`, and
   `RELEASE_NOTES.md` — and push to `dev` (or `main`).
6. Tag and push:
   ```bash
   git tag v0.1.0-beta.1
   git push origin v0.1.0-beta.1
   ```
7. Watch the workflow on GitHub Actions. On success, a draft release
   appears under <https://github.com/mattbrailsford/prezl/releases>
   with `RELEASE_NOTES.md` already populated as the body.
8. Spot-check the draft and click **Publish**.

If the workflow fails partway through, fix the cause, delete the
partial draft release on GitHub, delete the tag locally and remotely
(`git push --delete origin v…`), then retry.

## Re-running against an existing tag

Use the **Run workflow** button on the Release workflow page and enter
the tag name. tauri-action updates the existing draft in place, so
this is the way to retry one platform without re-tagging.

## Code signing (deferred)

Builds are currently unsigned:

- **Windows** — SmartScreen warns on first run.
- **macOS** — Gatekeeper blocks the .app; users right-click → Open the
  first time, or run `xattr -dr com.apple.quarantine /Applications/Prezl.app`.

When we want signed builds, we wire repo secrets and the matching
tauri-action inputs:

- macOS: `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`,
  `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`,
  `APPLE_TEAM_ID` (notarization).
- Windows: Azure Trusted Signing or a code-signing cert via
  `WINDOWS_CERTIFICATE` / `WINDOWS_CERTIFICATE_PASSWORD`.

See <https://tauri.app/distribute/sign> for the canonical setup.

## First beta checklist (0.1.0-beta.1)

- [ ] Bump version in the three files above.
- [ ] `pnpm typecheck && pnpm test` pass locally.
- [ ] `pnpm tauri build` produces a working installer locally on at
  least Windows (the dev platform).
- [ ] Commit + push to `dev`.
- [ ] Tag `v0.1.0-beta.1`, push tag.
- [ ] Workflow green on all three runners.
- [ ] Draft release notes mention: known limitations, unsigned-build
  caveat, link to docs site.
- [ ] Publish draft.
