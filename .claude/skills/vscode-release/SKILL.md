---
name: vscode-release
description: Cut a Prezl VS Code extension release — bump the manifest, tag with the `vscode-v*` prefix, push, and shepherd the GitHub Actions build into a published GitHub Release (and optionally the VS Code Marketplace). Use this whenever the user wants to release, tag, ship, or publish the Prezl VS Code extension. Distinct from the app release skill, which targets the Tauri desktop app via `v*` tags.
argument-hint: "[version, e.g. 0.1.0]"
---

# Releasing the Prezl VS Code extension

The extension lives at `vscode-extension/` inside the main repo but ships independently of the Tauri app. Tagging `vscode-v*` triggers `.github/workflows/vscode-extension.yml`, which builds the VSIX, attaches it to a GitHub Release, and (only on `workflow_dispatch` with explicit opt-in) publishes to the VS Code Marketplace.

The two release pipelines never collide: the Tauri release skill owns `v*` tags, this one owns `vscode-v*`.

## Why two skills

- **Marketplace versioning is stricter.** Only `MAJOR.MINOR.PATCH` — no `-beta.N` suffixes. Pre-releases use the `--pre-release` flag with a clean version, not a semver pre-release tag.
- **Marketplace publishes are irreversible.** A version, once published, can never be republished or unpublished — so the workflow attaches the VSIX to GitHub by default and only pushes to the Marketplace when explicitly requested.
- **Cadence is different.** A snippet typo fix shouldn't trigger 3-OS Tauri matrix builds; a Tauri runtime fix shouldn't bump the Marketplace listing.

## When the user asks for a VS Code extension release

Walk this loop. It mirrors the app release skill but is single-platform and single-file.

### 1. Confirm the version

Ask if it wasn't given. Marketplace versions are MAJOR.MINOR.PATCH only:

- Stable: `0.1.0`, `0.2.0`, `1.0.0`, …
- Pre-release: same shape, just published with `--pre-release` (Marketplace's odd-minor convention is fine but optional).

The leading `v` and the `vscode-` prefix belong only on the **git tag**, never inside the manifest. So the manifest value is `0.1.0` and the tag is `vscode-v0.1.0`.

### 2. Pre-flight checks

```bash
git status                  # working tree clean?
git branch --show-current   # on the right branch?
git pull --ff-only
```

Read `vscode-extension/package.json` to confirm the current version so the user can see the bump being proposed (e.g. `0.1.0 → 0.1.1`).

Quick sanity sweep specific to the extension:

- `vscode-extension/LICENSE` exists (vsce warns otherwise).
- `vscode-extension/package.json` has `repository`, `publisher`, `displayName`, `description`, `engines.vscode`.
- Snippet / schema / grammar files referenced from `contributes` actually exist.

### 3. Draft release notes (optional)

The workflow's GitHub Release body is short by default ("VSIX attached. Install via …"). For a meaningful release, edit the draft after the workflow completes — there's no `RELEASE_NOTES.md` plumbing for the extension because it's usually a one-line "fixes selector completion in nested folds" type change. If notes are substantial, ask the user whether they want them in the GitHub Release, the Marketplace listing changelog (`CHANGELOG.md` is the convention), or both.

### 4. Bump the manifest + lockfile

```bash
node .claude/skills/vscode-release/scripts/bump-vscode-version.mjs 0.1.1
pnpm install
```

The script edits only `vscode-extension/package.json`. `pnpm install` refreshes the root lockfile entry for the workspace member.

### 5. Verify locally

```bash
pnpm --filter prezl-vscode typecheck
pnpm --filter prezl-vscode build
pnpm --filter prezl-vscode exec vsce package --no-dependencies
```

The `vsce package` step is the fastest reliable smoke test — it runs the same validation the workflow does (manifest fields, license file, repository field, broken activation events). If it produces a `.vsix`, CI almost certainly will too.

For a pre-publish manual check, install the VSIX locally:

```bash
code --install-extension vscode-extension/prezl-vscode-0.1.1.vsix
```

Open `examples/demo/` and confirm directives still highlight, snippets expand, and Stages tree populates.

### 6. Commit the bump

```
Bump VS Code extension to 0.1.1
```

```bash
git add vscode-extension/package.json pnpm-lock.yaml
git commit -m "Bump VS Code extension to 0.1.1"
git push
```

Don't pile unrelated changes into the bump commit.

### 7. Tag and push the tag

```bash
git tag vscode-v0.1.1
git push origin vscode-v0.1.1
```

Pushing the tag triggers the workflow.

### 8. Watch the build

```bash
gh run list --workflow=vscode-extension.yml --limit 3
gh run watch
```

The workflow runs on `ubuntu-latest` only — single job, much faster than the Tauri matrix.

### 9. Verify the GitHub Release

When the workflow finishes green, a Release exists at `https://github.com/mattbrailsford/prezl/releases/tag/vscode-v0.1.1` with the VSIX attached. Spot-check that the asset is there.

### 10. (Optional) Publish to the Marketplace

This step is **deliberately gated** because Marketplace publishes are irreversible. Confirm with the user before proceeding.

Prerequisites:

- `VSCE_PAT` secret set on the repo (Azure DevOps PAT scoped to Marketplace > Manage). The token belongs to the publisher account named in `package.json` (`mattbrailsford`).
- The version has never been published before. Marketplace rejects republishes.

Trigger via workflow_dispatch:

1. GitHub Actions → "Release VS Code Extension" → **Run workflow**.
2. `tag`: `vscode-v0.1.1`.
3. `publish_marketplace`: ✅
4. `prerelease`: ✅ if this is a pre-release version, ❌ otherwise.
5. Run.

The workflow re-builds the VSIX from the tag, re-attaches it to the same GitHub Release (`--clobber`), then runs `vsce publish` with the `--packagePath` of the freshly-built VSIX.

The extension is live on the Marketplace within a few minutes; the listing page caches for ~10 min.

## Recovery scenarios

### Workflow failed before attaching the VSIX

Re-run via workflow_dispatch with the same tag. The GitHub Release upload uses `--clobber`, so a second run replaces any partial asset cleanly.

### VSIX attached but Marketplace publish failed

Run workflow_dispatch again with `publish_marketplace: true`. The Marketplace step is idempotent for a given version up until it succeeds — once it succeeds, that version is locked and you must bump.

### Tag was wrong (typo, wrong commit)

Delete and retag. **Only safe if no Marketplace publish has happened for that version** — once it's on the Marketplace, you must bump to a fresh version.

```bash
git tag -d vscode-v0.1.1
git push --delete origin vscode-v0.1.1
# delete the GitHub Release manually if it was created
```

Confirm with the user before running `--delete`.

### Marketplace says "version already exists"

You can't republish. Bump the patch version (`0.1.1 → 0.1.2`) and re-run the loop from step 4.

## Things to push back on

- **Pre-release semver in the manifest** (`0.1.0-beta.1`). Marketplace rejects it. Use a clean version and the `--pre-release` flag.
- **Reusing a published version.** Once it's on the Marketplace, that version is permanently taken even if you "delete" it via the management UI. Always bump.
- **Bundling unrelated repo changes into the bump commit.** Keep the version commit surgical so the tag points at one self-contained release.
- **Tagging without smoke-testing the VSIX locally.** `vsce package` catches manifest bugs, but only a real install in a real VS Code window catches "the snippet trigger doesn't fire" or "the tree view crashes on this project."

## Coordinating with the app release

The extension's snippets, schema, and grammar track the directive grammar owned by the app. When the app adds a new directive attribute or selector form, both need updates — make those changes in the **same PR**, not in separate releases. The extension can ship its update independently after merge; it doesn't have to wait for an app release.
