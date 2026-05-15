---
description: 'Use when working on cubecloud or 智方云 fork maintenance, rebranding, Apache-2.0 licensing preservation, upstream merges from iOfficeAI/AionUi, release endpoint overrides, or GHCR sync/publish flows.'
---

# cubecloud fork maintenance

This workspace can be used both as the upstream AionUi codebase and as the base for a cubecloud / 智方云 distribution.

- Preserve the current legal surface unless the user explicitly asks otherwise. The repo currently declares Apache-2.0 in [LICENSE](../../LICENSE) and [package.json](../../package.json), and many source files carry `SPDX-License-Identifier: Apache-2.0` headers.
- There is no `NOTICE` file in the repo today. If imported upstream or third-party code requires notice retention, add or update a notice file instead of dropping attribution.
- Keep upstream mergeability high. Prefer a fork overlay approach for product naming, repository owner, download URLs, package endpoints, and image registries instead of broad search-and-replace edits.
- When you need fork-specific distribution behavior, centralize it in a small number of obvious surfaces such as [package.json](../../package.json), [electron-builder.yml](../../electron-builder.yml), [Dockerfile](../../Dockerfile), [.github/workflows/build-and-release.yml](../workflows/build-and-release.yml), [.github/workflows/release-distribute.yml](../workflows/release-distribute.yml), [scripts/install-ubuntu.sh](../../scripts/install-ubuntu.sh), or [homebrew/aionui.rb.example](../../homebrew/aionui.rb.example).
- Keep three concerns separate in automation and docs: upstream code sync from `iOfficeAI/AionUi`, upstream artifact or image ingestion, and cubecloud-owned publishing.
- Do not silently replace upstream release channels with cubecloud ones. When both matter, document the upstream source of truth and the cubecloud distribution channel explicitly.
- For GHCR or container work, prefer parameters, environment variables, or clearly isolated workflow inputs for image namespace, registry host, and tags. Avoid hardcoding cubecloud endpoints across unrelated files.
- For rebranding requests, confirm the exact surface before making broad edits: package identity, installer identity, update endpoints, docs copy, GitHub owner links, or container image namespace are separate decisions.
- For logo, icon, banner, and wordmark wiring, also load [branding asset rules](./branding-assets.instructions.md) so staged assets under `resources/branding/cubecloud/` are mapped onto the existing packaging and documentation surfaces deliberately.
- Before changing release or distribution behavior, review the existing operational docs in [AGENTS.md](../../AGENTS.md), [docs/contributing/development.md](../../docs/contributing/development.md), and [docs/contributing/pr-automation.md](../../docs/contributing/pr-automation.md).
- If git remotes are configured for fork maintenance, prefer `origin` for the cubecloud fork and `upstream` for `iOfficeAI/AionUi`, but verify the actual remotes before scripting sync steps.
