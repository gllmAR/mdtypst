// Multi-page table fixture: shrink the page height so the table must span pages.

#set page(
  width: 14cm,
  height: 9cm,
  margin: (x: 1cm, y: 0.8cm),
)

#set text(size: 10pt)
#set par(leading: 1.1em)

// Make header visually obvious when it repeats.
#set table(
  inset: (x: 6pt, y: 3pt),
  gutter: 0pt,
  fill: (x, y) => if y == 0 { luma(92%) } else { none },
  stroke: (x, y) => (
    left: none,
    right: none,
    top: if y == 0 { 0.6pt + luma(65%) } else { none },
    bottom: if y == 0 { 0.6pt + luma(65%) } else { 0.25pt + luma(85%) },
  ),
)

#show table.cell.where(y: 0): strong
