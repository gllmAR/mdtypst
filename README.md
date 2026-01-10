# mdtypst
Statically hosted, URL-driven Markdown→PDF renderer (client-side Typst WASM).

mdtypst fetches a Markdown document, parses a small YAML frontmatter block, converts the content to Typst, and compiles a PDF fully in the browser.

The main entrypoint is:

- `render.html?src=URL_OR_PATH`


Markdown is rendered inside Typst via `@preview/cmarker` when Typst package imports are available; otherwise a minimal built-in Markdown→Typst fallback renderer is used. Mermaid code fences are rendered client-side to SVG and embedded into the Typst document. A minimal JS loader orchestrates fetch, WASM init, and output delivery.

## Quick start

```bash
npm install
npm run serve
```

Open:

- `http://localhost:8000/render.html?src=sample.md`

## URL parameters

- `src` (required): Markdown URL or a path served by your static host.
	- Example (local file served by `npm run serve`): `render.html?src=sample.md`
	- Example (remote URL): `render.html?src=https://example.com/doc.md`
- `renderer` (optional): `auto` (default), `cmarker`, `fallback`
	- `auto` uses a heuristic to prefer the fallback renderer for cross-origin documents.
	- `cmarker` forces the Typst `@preview/cmarker` path.
	- `fallback` forces the built-in Markdown→Typst converter.
- `tables` (optional): `1` or `tablem` enables pipe-table rewriting using `@preview/tablem`.
- `debug` (optional): `0` disables debug logging (default is enabled).
- `noFallback` (optional): `1` disables retrying with the fallback renderer if Typst compilation fails.

### Sidecar document description (styling)

To customize styling without putting YAML into the Markdown file, mdtypst can load a native Typst sidecar template next to the Markdown.

Auto-discovery (when `src=...` is provided):

- For `foo.md`, mdtypst tries:
	- `foo.mdtypst.typ`

You can also provide an explicit URL:

- `sidecar=<url>`

The sidecar is mounted into Typst at `/mdtypst/template.typ` and injected via:

- `#include "/mdtypst/template.typ"`

When a `.mdtypst.typ` sidecar is present, mdtypst runs in “native template mode”: it still converts the Markdown to Typst content, but it does not inject the built-in page/title/TOC prelude. Your template owns layout.

Use the injected `mdtypst` dictionary (from Markdown frontmatter) inside your template if you want to set page/title/TOC based on metadata.

Minimal example (`foo.mdtypst.typ`):

```typst
#set page(
	paper: if mdtypst.paper != none { mdtypst.paper } else { "a4" },
	margin: if mdtypst.margin != none { mdtypst.margin } else { 2cm },
)

#if mdtypst.title != none {
	#set document(title: mdtypst.title)
	= #mdtypst.title
}

#if mdtypst.toc == true {
	#outline()
}
```

## Architecture

- `render.html` loads the Typst runtime (vendored first, CDN fallback) and then loads `render.js`.
- `render.js` is a stable entrypoint that imports the modular implementation in `src/render-main.js`.

More detail: see `docs/ARCHITECTURE.md`.

## Local development

- `npm install`
- `npm run serve`
- Open `http://localhost:8000/render.html?src=sample.md`

## Offline

By default the renderer loads Typst + Mermaid from a CDN. To run without network access, vendor those browser bundles locally.

- Prepare vendored runtime assets: `npm run offline:prepare`
- Start your static server as usual and open `http://localhost:8000/render.html?src=sample.md`

The app will prefer `./vendor/typst/` and `./vendor/mermaid/` first, and only fall back to CDN if the local files are missing.

## GitHub Pages

`npm run build:pages` writes a static site into `dist/` (including `vendor/` and `src/`).

Typical workflow:

```bash
npm install
npm run offline:prepare
npm run build:pages
```

## Notes

- PDF compilation runs fully client-side in the browser via Typst WASM (loaded from CDN).
- Mermaid code fences are rendered client-side to SVG and embedded into the Typst document.

## Frontmatter

mdtypst supports a small, flat YAML frontmatter surface that maps to safe Typst setup commands.

Limitations:

- Only flat `key: value` scalars are supported (no nesting/arrays/multiline YAML).

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
	- Note: if a `.mdtypst.typ` sidecar is present (native template mode), the template should insert `#outline()` instead.


## Tests

```bash
npm run test:clean && npm test -- --concurrency 4
```

## Debugging

The renderer exposes a minimal test/debug API on `globalThis.__mdtypst` (used by the fixture runner), including:

- `getPdfBlob()`
- `getTypstSource()`
- `getTimings()`

See `docs/TEST_API.md`.