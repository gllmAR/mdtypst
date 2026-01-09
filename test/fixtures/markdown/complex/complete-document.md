---
mdpdf:
  render:
    title: Complete Document Example
    author: mdpdf-core
---

# Complete Document Example

This document demonstrates all supported features of mdpdf-core.

## Text Formatting

Regular text, **bold text**, *italic text*, and `inline code`.

You can also combine them: ***bold and italic***, or **bold with `code`**.

## Lists

### Unordered List

- Item one with some text
- Item two with **bold** formatting
- Item three with *italic* formatting

### Ordered List

1. First step - initialize the engine
2. Second step - parse the markdown
3. Third step - generate the PDF

### Nested List

- Parent item
  - Child item 1
  - Child item 2
    - Grandchild item
  - Child item 3
- Another parent

## Code

```javascript
// JavaScript example
const greeting = 'Hello, World!';
console.log(greeting);

function processData(data) {
  return data.map(item => item.value * 2);
}
```

## Table

| Feature | Status | Notes |
|---------|:------:|-------|
| Text | Yes | Full support |
| Lists | Yes | Nested supported |
| Code | Yes | Multiple languages |
| Tables | Yes | With alignment |

## Horizontal Rule

---

## Blockquote

> This is a blockquote.
> It can span multiple lines.
> And supports **formatting** too.

## Links

Check out [the documentation](https://example.com/docs) for more info.

## Conclusion

This concludes the comprehensive demonstration.
