// Table styling playground: zebra + padding + subtle grid.

#set page(margin: 2cm)
#set text(size: 10.5pt)
#set par(leading: 1.15em)

#set table(
  // Avoid the default heavy grid look.
  gutter: 0pt,
  inset: (x: 7pt, y: 4pt),
  fill: (x, y) => {
    if y == 0 { luma(92%) }
    else if calc.odd(y) { luma(98%) }
    else { none }
  },
  // Only horizontal rules; thicker under header.
  stroke: (x, y) => (
    left: none,
    right: none,
    top: if y == 0 { 0.6pt + luma(65%) } else { none },
    bottom: if y == 0 { 0.6pt + luma(65%) } else { 0.25pt + luma(85%) },
  ),
)

#show table.cell.where(y: 0): strong
