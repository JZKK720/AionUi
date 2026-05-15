---
name: 'Branding Asset Rules'
description: 'Use when wiring cubecloud or 智方云 logos, icons, wordmarks, README banners, desktop app icons, PWA icons, or other rebranding artwork into the repo.'
applyTo:
  [
    'electron-builder.yml',
    'package.json',
    'public/manifest.webmanifest',
    'public/pwa/**',
    'readme.md',
    'docs/readme/*.md',
    'resources/branding/cubecloud/**',
    'resources/*.png',
    'resources/*.svg',
    'resources/*.ico',
    'resources/*.icns',
  ]
---

# Branding Asset Rules

Use this instruction when the staged cubecloud assets under [resources/branding/cubecloud/](../../resources/branding/cubecloud/) need to be wired into the app, docs, or release surfaces.

## Current Asset Surfaces

- Desktop packaging currently expects [resources/app.ico](../../resources/app.ico), [resources/app.icns](../../resources/app.icns), and [resources/app.png](../../resources/app.png) via [electron-builder.yml](../../electron-builder.yml).
- The web manifest currently points to [public/pwa/icon-192.png](../../public/pwa/icon-192.png) and [public/pwa/icon-512.png](../../public/pwa/icon-512.png) via [public/manifest.webmanifest](../../public/manifest.webmanifest).
- The English README currently uses [resources/aionui-banner-1.png](../../resources/aionui-banner-1.png) and [resources/offica-ai%20BANNER-function.png](../../resources/offica-ai%20BANNER-function.png).
- Staged cubecloud artwork currently lives under [resources/branding/cubecloud/](../../resources/branding/cubecloud/), which is an intake area, not yet the production path used by packaging.

## Wiring Rules

- Treat `resources/branding/cubecloud/` as the source-of-truth staging folder for incoming fork branding assets.
- Do not repoint the whole app to the staging folder in one broad change. Prefer deriving or copying the finalized production assets into the filenames the app already consumes.
- Keep desktop packaging, PWA icons, and README or doc banners as separate surfaces. They often need different aspect ratios, padding, background treatment, and file formats.
- Before replacing a root-level asset, verify which runtime or packaging surface uses it.
- If an asset is only for documentation, keep it out of installer and runtime paths.

## Common Mapping

- Desktop app icon set: export the chosen cubecloud icon to the production filenames used by packaging: `resources/app.ico`, `resources/app.icns`, and `resources/app.png`.
- Web or PWA icon set: export resized web icons to `public/pwa/icon-192.png` and `public/pwa/icon-512.png` and keep [public/manifest.webmanifest](../../public/manifest.webmanifest) aligned.
- README hero or banner: replace the image file referenced by the README, or update the README reference deliberately if the new asset name is clearer and stable.
- Product naming: if artwork changes imply a visible product rename, review [package.json](../../package.json), [electron-builder.yml](../../electron-builder.yml), release-channel rules, and upstream attribution together.

## Safety Rules

- Preserve Apache-2.0 licensing and attribution while rebranding visuals.
- Avoid deleting upstream artwork until the fork has a confirmed replacement for every live surface that still references it.
- Do not assume a logo file is ready for app-icon use. Check square-crop behavior, transparency, and legibility at small sizes.
- If the staging folder contains nested directories or mixed source formats, normalize the selected deliverables first and then wire only the finalized outputs.

## Coordination

- Load [cubecloud fork maintenance](./cubecloud-fork.instructions.md) for overall rebrand constraints.
- Load [release channel rules](./release-channel.instructions.md) if branding changes also affect release badges, download endpoints, installer identity, or update channels.
