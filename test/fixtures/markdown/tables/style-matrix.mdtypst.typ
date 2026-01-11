// Matrix/grid table styling playground.

#set page(margin: 2cm)
#set text(size: 10pt)
#set par(leading: 1.1em)

// Light grid lines everywhere, but not as heavy as Typst defaults.
#set table(
  gutter: 0pt,
  inset: (x: 6pt, y: 3pt),
  stroke: 0.25pt + luma(75%),
)

// Header row style
#show table.cell.where(y: 0): it => {
  set text(weight: "semibold")
  table.cell(fill: luma(94%))[#it.body]
}

// Optional zebra for readability in larger grids.
#show table.cell.where(y: y => y > 0): it => {
  if calc.odd(it.y) {
    table.cell(fill: luma(98%))[#it.body]
  } else {
    it
  }
}
