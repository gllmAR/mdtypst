// Compact table styling playground.

#set page(margin: 2cm)
#set text(size: 10pt)
#set par(leading: 1.1em)

#set table(
  gutter: 0pt,
  inset: (x: 6pt, y: 3pt),
  fill: (x, y) => if y == 0 { luma(94%) } else { none },
  // Minimal lines: only header underline + row separators.
  stroke: (x, y) => (
    left: none,
    right: none,
    top: none,
    bottom: if y == 0 { 0.5pt + luma(70%) } else { 0.2pt + luma(88%) },
  ),
)

#show table.cell.where(y: 0): strong
