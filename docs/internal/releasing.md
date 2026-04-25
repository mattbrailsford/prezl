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
| `windows-latest` | `.msi`, `.exe` (NSIS) |
| `macos-latest` | `.dmg`, `.app.tar.gz` (universal: arm64 + x86_64) |
| `ubuntu-22.04` | `.AppImage`, `.deb`, `.rpm` |

Ubuntu 22.04 is intentional — it links against an older glibc than
24.04, so the AppImage runs on a wider range of user systems.

## Cutting a release

1. Pick the new version. Pre-releases use semver pre-release suffixes
   (`0.1.0-beta.1`, `0.1.0-beta.2`, …).
2. Bump the version in **all three** files — they must agree:
   - `package.json` → `version`
   - `src-tauri/tauri.conf.json` → `version`
   - `src-tauri/Cargo.toml` → `[package].version`
3. Run `pnpm install` so `pnpm-lock.yaml` picks up the new
   `prezl@<version>` entry, then `pnpm typecheck` and `pnpm test`.
4. Commit (e.g. `Bump to 0.1.0-beta.1`) and push to `dev` (or `main`).
5. Tag and push:
   ```bash
   git tag v0.1.0-beta.1
   git push origin v0.1.0-beta.1
   ```
6. Watch the workflow on GitHub Actions. On success, a draft release
   appears under
   <https://github.com/mattbrailsford/prezl/releases>.
7. Edit the draft: write release notes, then **Publish**.

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
