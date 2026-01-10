---
# This document is itself a fixture: it should render and compile.
# It also serves as the canonical list of supported frontmatter keys.

title: Frontmatter (Typst) – Supported Keys
author: mdtypst test suite
paper: a4
---

# Supported frontmatter keys

These are the **only** YAML frontmatter keys that mdtypst currently interprets and turns into Typst setup commands.

## Document metadata

- `title` (string)
- `author` (string)
- `date` (string)

## Page

- `paper` (string)
  - Allowed: `a3`, `a4`, `a5`, `us-letter`, `us-legal`, `us-tabloid`
  - Aliases accepted: `letter`, `legal`, `tabloid`
- `margin` (string length: `pt|mm|cm|in`) sets both X/Y
- `margin_x` (string length)
- `margin_y` (string length)

## Text

- `font` (string)
- `fontSize` (string length)
- `font_size` (string length) alias for `fontSize`
- `justify` (boolean)

## Outline / TOC

- `toc` (boolean)
  - When `true`, mdtypst inserts `#outline()` after the title header.

## Fixture layout

This folder hierarchy splits the tests by Typst command group:

- `typst/document-metadata.md`
- `typst/page/*.md`
- `typst/text/*.md`
- `typst/toc/*.md`
