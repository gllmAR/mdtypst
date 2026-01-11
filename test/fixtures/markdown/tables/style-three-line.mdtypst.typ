// Three-line (booktabs-ish) table styling playground.

#set page(margin: 2cm)
#set text(size: 10.5pt)
#set par(leading: 1.15em)

// Remove per-cell borders; we will create horizontal rules via per-row bottom strokes.
#set table(
  gutter: 0pt,
  inset: (x: 7pt, y: 4pt),
  stroke: (x, y) => (
    left: none,
    right: none,
    top: if y == 0 { 0.7pt + luma(55%) } else { none },
    bottom: if y == 0 { 0.5pt + luma(60%) } else { none },
  ),
)

// Make header bold.
#show table.cell.where(y: 0): strong

// Add a bottom rule for the last row by adding a subtle bottom stroke on each cell.
// We can’t detect the last row directly here, so instead we give every body row a very
// light separator and let the top+header strokes do most of the structure.
#show table.cell.where(y: y => y > 0): it => {
  table.cell(stroke: (bottom: 0.25pt + luma(85%)))[#it.body]
}
