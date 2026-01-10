# GFM table features

This document is written to stay GitHub-Flavored Markdown (GFM) compliant.
It exercises common GFM table features that should render correctly in GitHub,
and also render in Typst via `tablem`.

## Basic

| Column 1 | Column 2 |
| --- | --- |
| A | B |
| C | D |

## Alignment

| Left | Center | Right |
| :--- | :---: | ---: |
| a | b | c |
| 1 | 2 | 3 |

## No outer pipes (still valid GFM)

Name | Value
--- | ---
Foo | Bar
Baz | Qux

## Inline formatting

| Feature | Example |
| --- | --- |
| Bold | **bold** |
| Italic | *italic* |
| Strikethrough | ~~strike~~ |
| Link | [example](https://example.com) |
| Inline code | `code()` |

## Escaped pipes in cells

| Expression | Meaning |
| --- | --- |
| a \| b | literal pipe |
| `x | y` | pipe inside code span |

## Empty cells

| A | B | C |
| --- | --- | --- |
| 1 |  | 3 |
|  | 2 |  |

## Uneven row widths (still commonly accepted)

| A | B | C |
| --- | --- | --- |
| 1 | 2 |
| 3 | 4 | 5 | 6 |

## Leading/trailing whitespace in cells

| Key | Value |
| --- | --- |
|   padded left | padded right   |
|  multiple   spaces  | keep as text |

## Escaped characters

| Pattern | Notes |
| --- | --- |
| \\ backslash | should render a backslash |
| \*not italic\* | escaped emphasis |
| \`not code\` | escaped backticks |

## Inline HTML inside cells

| Item | Render |
| --- | --- |
| Line break | first<br>second |
| Subscript | H<sub>2</sub>O |
| Superscript | 10<sup>2</sup> |

## Images in cells

| Logo | Link |
| --- | --- |
| ![Small](../../images/small.png) | [Typst](https://typst.app) |

## Multiple tables back-to-back

| A | B |
| --- | --- |
| 1 | 2 |

| C | D |
| --- | --- |
| 3 | 4 |
