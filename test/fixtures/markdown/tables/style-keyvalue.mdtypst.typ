// Key/value table styling playground.
// Intent: subtle container-like feel using only grayscale.

#set page(margin: 2cm)
#set text(size: 10.5pt)
#set par(leading: 1.15em)

// Global table style: no heavy grid, gentle row separators.
#set table(
  gutter: 0pt,
  inset: (x: 8pt, y: 5pt),
  stroke: (x, y) => (
    left: none,
    right: none,
    top: if y == 0 { 0.6pt + luma(70%) } else { none },
    bottom: 0.25pt + luma(88%),
  ),
  fill: (x, y) => if y == 0 { luma(94%) } else { none },
)

// Header row
#show table.cell.where(y: 0): strong

// Key column: bold + slightly muted background for scanability.
#show table.cell.where(x: 0, y: y => y > 0): it => {
  set text(weight: "semibold")
  table.cell(fill: luma(98%))[#it.body]
}
