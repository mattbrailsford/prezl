# macOS code signing & notarization

A one-time setup to stop Gatekeeper warnings on macOS and make the
TCC permission grant (Documents folder, etc.) stick across launches.

Without this, the `.dmg` and `.app` produced by the release workflow
are ad-hoc-signed only. macOS prompts for "Allow Anyway" on first
launch and re-prompts for Documents-folder access on every relaunch
because TCC can't reliably persist grants for unsigned binaries.

## Prerequisites

- Apple Developer Program membership ($99/yr) — already have.
- Mac with Keychain Access.
- Admin access to this repo's GitHub Settings (to add secrets).

## Phase 1 — Get a Developer ID Application certificate

Distribution-outside-the-App-Store needs a **Developer ID Application**
cert, NOT "Mac App Distribution" (that's App Store only).

1. **Generate the CSR.** Keychain Access → Certificate Assistant
   → *Request a Certificate from a Certificate Authority*. Save to disk.
2. **Apple Developer portal** → Certificates, IDs & Profiles → **+** →
   **Developer ID Application**. Upload the CSR, download the `.cer`.
3. **Import** by double-clicking the `.cer` (lands in login keychain).
4. **Verify**:
   ```
   security find-identity -v -p codesigning
   ```
   You should see a line like:
   ```
   1) AAAA... "Developer ID Application: Matt Brailsford (XXXXXXXXXX)"
   ```
   The 10-char string in parens is the **Team ID** — note it.

The cert is valid for 5 years. Renewal = repeat steps 1–3.

## Phase 2 — Get a notarization credential

Notarization is a separate auth flow from signing. Pick one of two:

### Option A — App-specific password (simplest)

appleid.apple.com → Sign In & Security → *App-Specific Passwords* →
generate one labelled "Tauri notarization". Format `xxxx-xxxx-xxxx-xxxx`.
Save it somewhere durable — Apple won't show it again.

Downside: tied to the Apple ID account and revocable; one of these
recently bit teams when account-level changes invalidated existing
passwords. Fine for solo projects.

### Option B — App Store Connect API key (recommended long-term)

appstoreconnect.apple.com → Users & Access → Integrations → Keys →
**+** with role *Developer*. Download the `.p8` file (one-time —
cannot redownload). Note the **Key ID** (10 chars) and **Issuer ID**
(UUID on the same page).

No expiry, scoped to the API, easier to rotate independently of the
Apple ID.

## Phase 3 — Local signed builds

For a one-off signed build from your Mac, export the following
before `pnpm tauri build`:

```sh
export APPLE_SIGNING_IDENTITY="Developer ID Application: Matt Brailsford (XXXXXXXXXX)"
export APPLE_ID=me@mattbrailsford.com
export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"   # app-specific password
export APPLE_TEAM_ID=XXXXXXXXXX
```

Tauri 2 picks these up automatically and runs `codesign` +
`notarytool submit --wait` as part of `tauri bundle`. The bundler
also runs `xcrun stapler staple` against the produced `.dmg` so it
notarizes without needing online verification.

For the API-key flow instead, swap the bottom three for:

```sh
export APPLE_API_KEY=KEYID                    # 10-char Key ID
export APPLE_API_ISSUER=ISSUER-UUID
export APPLE_API_KEY_PATH=/abs/path/to/AuthKey_KEYID.p8
```

Confirm the result with:

```
codesign -dvv /Applications/Prezl.app
spctl -a -t exec -vv /Applications/Prezl.app
```

Both should report `Developer ID` and `accepted`.

## Phase 4 — Wire signing into GitHub Actions

`tauri-action@v0` already supports the certificate-import dance —
just needs the env vars set. Steps:

1. **Export the cert as .p12.** Keychain Access → *My Certificates*
   tab → right-click the Developer ID Application cert (NOT the
   private key alone) → Export → save as `cert.p12` → set a strong
   export password.
2. **Base64-encode** (copies to clipboard on macOS):
   ```
   base64 -i cert.p12 | pbcopy
   ```
3. **Add repo secrets** at Settings → Secrets and variables → Actions:

   | Secret | Value |
   | --- | --- |
   | `APPLE_CERTIFICATE` | The base64 blob |
   | `APPLE_CERTIFICATE_PASSWORD` | The .p12 export password |
   | `APPLE_SIGNING_IDENTITY` | `Developer ID Application: Matt Brailsford (XXXXXXXXXX)` |
   | `APPLE_ID` | `me@mattbrailsford.com` |
   | `APPLE_PASSWORD` | App-specific password (`xxxx-xxxx-xxxx-xxxx`) |
   | `APPLE_TEAM_ID` | 10-char team ID |
   | `KEYCHAIN_PASSWORD` | Any random string — used for the temp CI keychain |

   For API-key flow: replace `APPLE_PASSWORD` with `APPLE_API_KEY`,
   `APPLE_API_ISSUER`, and `APPLE_API_KEY_PATH`. The path needs to
   point at where you write the `.p8` in the workflow; easier to keep
   the app-specific-password flow for CI even if you use API keys
   locally.

4. **Patch `.github/workflows/release.yml`.** Pass the env vars to
   `tauri-apps/tauri-action@v0`:

   ```yaml
   - uses: tauri-apps/tauri-action@v0
     env:
       GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
       APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
       APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
       APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
       APPLE_ID: ${{ secrets.APPLE_ID }}
       APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
       APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
       KEYCHAIN_PASSWORD: ${{ secrets.KEYCHAIN_PASSWORD }}
     with:
       …existing args…
   ```

   Only the macOS runner uses them; Windows/Linux runners ignore them
   harmlessly.

5. **Drop the "currently unsigned" line** from the fallback release
   notes in the `Prepare release body` step — it'll be wrong once this
   lands.

## Verifying a CI build

Download the `.dmg` from the draft release, mount it, then run:

```
codesign -dvv /Volumes/Prezl*/Prezl.app
spctl -a -t exec -vv /Volumes/Prezl*/Prezl.app
xcrun stapler validate /Volumes/Prezl*/Prezl.app
```

All three should pass. Drag to Applications, double-click — should
launch with no Gatekeeper warning at all, and the first Documents
permission grant should persist across relaunches.

## Gotchas

- **Hardened runtime is implicit.** Tauri 2 enables it during
  notarization (notarytool requires it). If the app starts misbehaving
  after signing — DYLD complaints, dlopen failures — you may need to
  add entitlements via `tauri.conf.json` → `bundle.macOS.entitlements`.
- **First notarization can take 10–30 minutes.** Subsequent ones are
  usually under 5. The workflow will block on `--wait` until Apple
  responds.
- **Universal binary signing** — the existing workflow already targets
  `universal-apple-darwin`, which produces a single fat binary. `codesign`
  signs both slices in one pass; no extra work.
- **Cert + private key must both be in the .p12 export.** If you
  accidentally export just the cert, CI signing will fail with
  "no identity found". Exporting from the *My Certificates* tab (not
  *Certificates*) ensures both come along.
- **Team ID mismatch.** The Team ID in `APPLE_SIGNING_IDENTITY` and
  `APPLE_TEAM_ID` must match the team the notarization credential
  belongs to. Mostly only a problem if you're on multiple Apple Dev
  teams.
