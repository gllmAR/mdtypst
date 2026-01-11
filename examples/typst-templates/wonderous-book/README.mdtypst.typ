// Small book layout (inspired by typst/templates wonderous-book)
#let title = if mdtypst.title != none { mdtypst.title } else { "Book" }

#set page(
  paper: if mdtypst.paper != none { mdtypst.paper } else { "a5" },
  margin: if mdtypst.margin != none { mdtypst.margin } else { 1.6cm },
  header: context [#align(center)[#text(size: 9pt)[#title]]],
  footer: context [#align(center)[#counter(page).display("1")]],
)

#set par(justify: true, leading: 1.2em)
#set text(size: 10pt)

#show heading.where(level: 1): it => [
  #block(above: 1.2em, below: 0.6em)[
    #text(size: 18pt, weight: "bold")[#it.body]
  ]
]
#show heading.where(level: 2): it => [
  #block(above: 0.7em, below: 0.2em)[
    #text(size: 12pt, weight: "bold")[#it.body]
  ]
]
#show heading.where(level: 3): it => [
  #block(above: 0.4em, below: 0.1em)[
    #text(weight: "bold")[#it.body]
  ]
]
