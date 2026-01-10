# mdtypst
mdtypst - markdown renderer

mdtypst-link is a statically hosted, URL-driven Markdown→PDF renderer. 

A link like render.html?src=URL fetches a Markdown document, parses YAML frontmatter, and compiles it client-side using Typst in WASM. 


Markdown is rendered inside Typst via cmarker when Typst package imports are available; otherwise a minimal built-in Markdown→Typst fallback renderer is used. Mermaid code fences are rendered client-side to SVG and embedded into the Typst document. A minimal JS loader only orchestrates fetch, WASM init, and output delivery. PDF is displayed natively or downloaded. Deterministic, no server compute.

## Local development

- `npm install`
- `npm run serve`
- Open `http://localhost:8000/render.html?src=sample.md`

## Offline

By default the renderer loads Typst + Mermaid from a CDN. To run without network access, vendor those browser bundles locally.

- Prepare vendored runtime assets: `npm run offline:prepare`
- Start your static server as usual and open `http://localhost:8000/render.html?src=sample.md`

The app will prefer `./vendor/typst/` and `./vendor/mermaid/` first, and only fall back to CDN if the local files are missing.

## Notes

- PDF compilation runs fully client-side in the browser via Typst WASM (loaded from CDN).
- Mermaid code fences are rendered client-side to SVG and embedded into the Typst document.

## Frontmatter

mdtypst supports a small, flat YAML frontmatter surface that maps to safe Typst setup commands.

Supported keys:

- `title` (string): used for the rendered title header and `document(title: ...)`
- `author` (string): used for the rendered author header and `document(author: ...)`
- `date` (string): rendered as plain text on the title header
- `paper` (string): one of `a3`, `a4`, `a5`, `us-letter`, `us-legal`, `us-tabloid` (also accepts aliases `letter`, `legal`, `tabloid`) → `#set page(paper: ...)`
- `margin` (string): length like `2.5cm`, `1in` → sets both X/Y margins
- `margin_x` / `margin_y` (string): length like `2cm` → overrides X/Y margins
- `font` (string): → `#set text(font: ...)`
- `fontSize` / `font_size` (string): length like `11pt` → `#set text(size: ...)`
- `justify` (boolean): → `#set par(justify: ...)`
- `toc` (boolean): when `true`, inserts `#outline()` after the title header


## Tests

```bash
npm run test:clean && npm test -- --concurrency 4
```