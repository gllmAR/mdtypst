---
# These keys are read by mdtypst and turned into Typst setup commands.
# The goal of this fixture is to ensure the frontmatter → Typst prelude path compiles.

title: Typst Frontmatter Options
author: Test Suite
paper: letter
margin: 1in
font: Libertinus Serif
fontSize: 10pt
justify: false
toc: true
---

# Typst Frontmatter Options

This document exists to test frontmatter fields that map to Typst setup commands.

## What is being tested

- `paper` → `#set page(paper: ...)`
- `margin` → `#set page(margin: ...)`
- `font` + `fontSize` → `#set text(font: ..., size: ...)`
- `justify` → `#set par(justify: ...)`
- `toc: true` → `#outline()`

## Content

A paragraph to ensure text rendering still works.

- A list item
- Another list item

---

End of fixture.
