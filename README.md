# mdtypst
mdtypst - markdown renderer

mdtypst-link is a statically hosted, URL-driven Markdown→PDF renderer. 

A link like render.html?src=URL fetches a Markdown document, parses YAML frontmatter, and compiles it client-side using Typst in WASM. 


Markdown is rendered inside Typst via cmarker, Mermaid diagrams via oxdraw. A minimal JS loader only orchestrates fetch, WASM init, and output delivery. PDF is displayed natively or downloaded. Deterministic, no server compute.
