# CI quality gates

> For maintainers. Using T3 Code? See [docs/user](../user/).

[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) runs four jobs on pull requests and
pushes to `main`:

- **Check**: `vp check` (format and lint; this repo sets `typeCheck: false` in its lint options),
  then `vpr typecheck` for the workspace type check. The same job
  builds the desktop pipeline (`vp run build:desktop`) and verifies the preload bundle exists and
  still exports its expected symbols.
- **Test**: `vp run test` across the workspace.
- **Mobile Native Static Analysis**: `vp run lint:mobile` on macOS, wrapping
  `scripts/mobile-native-static-check.ts`.
- **Release Smoke**: exercises release-only workflow steps through `scripts/release-smoke.ts`, so
  release breakage surfaces on PRs rather than at tag time.

`.github/workflows/release.yml` is the pingdotgg production pipeline. It builds macOS (`arm64` and
`x64`), Linux (`x64`), and Windows (`x64`) desktop artifacts from a single `v*.*.*` tag and
publishes one GitHub release, plus the CLI, hosted web app, and AUR package. It auto-enables
signing only when platform credentials are present. macOS passkey builds additionally require
`APPLE_TEAM_ID` and the `MACOS_PROVISIONING_PROFILE` secret; Windows uses Azure Trusted Signing.
Without the core signing credentials, it still releases unsigned artifacts.

Forks without Blacksmith runners or those production secrets use
[`.github/workflows/desktop-release.yml`](../../.github/workflows/desktop-release.yml) instead. That
workflow runs on GitHub-hosted runners, builds macOS (`arm64` and `x64`) DMGs and a Linux `x64`
AppImage, and publishes a GitHub Release:

- push to `main` → nightly prerelease (`vX.Y.Z-nightly.YYYYMMDD.<run_number>`)
- tag `v*.*.*` (except `v*-nightly.*`) → versioned release
- `workflow_dispatch` → either channel

Signing is still optional when Apple credentials are present. Download the `arm64` DMG on Apple
Silicon Macs or the `x64` DMG on Intel Macs from the repository's Releases page.

See [Release Checklist](../operations/release.md) for the full release/signing setup checklist.
