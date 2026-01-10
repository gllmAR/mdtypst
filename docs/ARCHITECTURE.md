# mdtypst architecture

This document describes how mdtypst turns Markdown into a PDF in a fully static, browser-based pipeline.

## Entry points

- `render.html`
  - UI shell (status banner + PDF iframe + download button).
  - Bootstraps Typst runtime loading:
    - prefers `./vendor/typst/index.js`
    - falls back to the CDN bundle for `@myriaddreamin/typst-all-in-one.ts`
  - Loads `render.js` as an ES module.

- `render.js`
  - Stable entry module.
  - Imports the implementation from `src/render-main.js`.

- `src/render-main.js`
  - Orchestrates the full rendering pipeline.
  - Exposes the test/debug API on `globalThis.__mdtypst`.

## Rendering pipeline

Given `render.html?src=...`, the pipeline is:

1. Fetch Markdown (`src/cache.js`)
2. Parse YAML frontmatter (`src/frontmatter.js`)
3. Rewrite Mermaid fences → SVG assets (`src/mermaid.js`)
4. Reset Typst shadow FS and mount assets (Typst runtime)
5. Fetch/mount images and rewrite Markdown to `/assets/...` (`src/assets.js`)
6. Produce a Typst document (`src/typst-doc.js`)
   - Prefer `@preview/cmarker` when available
   - Fall back to the built-in Markdown→Typst converter when needed
7. Compile PDF via Typst WASM (`$typst.pdf({ mainContent })`)
8. Display PDF and enable download

## Runtime dependencies

- Typst runtime: `@myriaddreamin/typst-all-in-one.ts` (WASM + JS glue)
- Mermaid: `mermaid` ESM bundle (optional; only used when Mermaid fences exist)

Offline support is handled by vendoring these runtimes into `vendor/`.

## Query parameters

- `src` (required): Markdown URL or local served path
- `renderer`: `auto` (default), `cmarker`, `fallback`
- `tables`: `1` or `tablem` enables table rewriting via `@preview/tablem`
- `debug`: `0` disables debug logging
- `noFallback`: `1` disables retrying compilation with the fallback renderer

## Sidecar document description

To maximize interoperability with existing Typst styling workflows while keeping Markdown files clean, mdtypst supports an optional sidecar file next to the Markdown:

- `foo.md` → tries `foo.mdtypst.json` then `foo.mdtypst.yaml`

The sidecar can:

- Provide metadata (same keys as frontmatter) to control built-in prelude generation.
- Provide Typst-native styling via `typst.template` and/or `typst.preamble`.

When `typst.template` is provided:

- mdtypst fetches the template, mounts it into the Typst shadow FS at `/mdtypst/template.typ`, and injects `#include "/mdtypst/template.typ"` before content.

## Notes / constraints

- Frontmatter parsing is intentionally minimal: only flat `key: value` scalars are supported.
- Cross-origin documents often cannot reliably use Typst package imports; `renderer=auto` may choose the fallback renderer in that case.
