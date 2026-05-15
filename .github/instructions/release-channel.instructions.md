---
name: 'Release Channel Rules'
description: 'Use when editing release workflows, updater settings, installer download sources, cubecloud GHCR publishing, image namespace or tag policy, S3 distribution, or public artifact endpoints for the fork.'
applyTo:
  [
    '.github/workflows/build-and-release.yml',
    '.github/workflows/release-distribute.yml',
    '.github/workflows/bump-homebrew.yml',
    '.github/workflows/pr-checks.yml',
    'Dockerfile',
    'electron-builder.yml',
    'package.json',
    'scripts/install-ubuntu.sh',
    'homebrew/*.rb.example',
  ]
---

# Release Channel Rules

The repo currently uses multiple distribution surfaces. Keep them explicit and in sync.

- [electron-builder.yml](../../electron-builder.yml) currently publishes updater metadata to GitHub Releases for `iOfficeAI/AionUi`.
- [.github/workflows/build-and-release.yml](../workflows/build-and-release.yml) builds artifacts and creates draft GitHub releases.
- [.github/workflows/release-distribute.yml](../workflows/release-distribute.yml) mirrors published installers to S3 and refuses same-version overwrite.
- [scripts/install-ubuntu.sh](../../scripts/install-ubuntu.sh) currently downloads `.deb` packages from upstream GitHub releases.
- GHCR publishing is not configured in the current repo. Treat cubecloud GHCR work as a new channel, not as an implicit replacement.

## Channel Separation

- Keep upstream ingestion separate from cubecloud publishing.
- Keep container image distribution separate from desktop installer and updater distribution.
- If a file still points at upstream intentionally, say so in comments or PR notes instead of silently swapping it.

## Change Rules

- Parameterize owner, registry host, image namespace, bucket, and public download base URL where practical.
- Avoid hardcoding personal fork owners in shared workflows.
- Do not introduce same-version overwrites for published artifacts or container tags unless the policy is explicit.
- If you change public download endpoints, review all affected surfaces together: updater config, installer scripts, release workflows, Homebrew formulae, README badges or links, and any container pull examples.

## Tag and Version Policy

- Decide one tag policy before adding cubecloud publishing: mirror upstream semver exactly, add a fork suffix, or run an independent version stream.
- Do not mix policies across GitHub releases, S3 artifacts, GHCR tags, and installer filenames.
- If cubecloud mirrors upstream builds with modifications, make the fork provenance obvious in tags, release notes, or image labels.

## Safe Defaults

- Prefer additive fork channels over replacing the upstream path in one large edit.
- Preserve Apache-2.0 attribution and upstream references when they still describe the source of the code or artifact lineage.
- Load [cubecloud fork maintenance](./cubecloud-fork.instructions.md) for broader rebrand and licensing constraints.
