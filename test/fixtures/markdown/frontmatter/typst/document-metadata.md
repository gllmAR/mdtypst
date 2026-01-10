---
# Tests document(title/author) + the rendered header.

title: Document Metadata (title/author/date)
author: mdtypst test suite
date: 2026-01-09
paper: a4
---

# Document metadata

## What is being tested

- `title` and `author` are applied as Typst document metadata (when supported by the renderer) and also rendered as a header section.
- `date` is rendered as plain text in the header.

## Body

A paragraph below the header.
