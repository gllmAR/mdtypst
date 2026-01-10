---
title: Markdown Feature Showcase
author: mdpdf-core
---

# Markdown Feature Showcase

This document demonstrates all markdown features supported by mdpdf-core.

---

## 1. Typography

### Basic Text
Lorem ipsum dolor sit amet, consectetur adipiscing elit.

### Emphasis
- **Bold text** using double asterisks
- *Italic text* using single asterisks
- ***Bold and italic*** combined
- `Inline code` using backticks

---

## 2. Structural Elements

### Headings (H1-H6)
All six heading levels are supported as shown in this document.

### Paragraphs
Paragraphs are separated by blank lines.

This is a new paragraph.

### Horizontal Rules
Three or more dashes, asterisks, or underscores on a line.

---

## 3. Lists

### Unordered
- Item 1
- Item 2
  - Nested item
  - Another nested
- Item 3

### Ordered
1. First
2. Second
3. Third

---

## 4. Code

### Inline
Use `npm install` to install.

### Block
```javascript
const engine = createPdfEngine();
const pdf = await engine.render(markdown);
```

---

## 5. Tables

| Name | Type | Required |
|------|------|:--------:|
| id | string | Yes |
| name | string | No |
| age | number | No |

---

## 6. Blockquotes

> This is a blockquote.
> It can span multiple lines.

---

## 7. Links

Visit [our website](https://example.com) for more information.

---

*End of feature showcase*
