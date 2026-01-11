// Newsletter layout (inspired by typst/templates dashing-dept-news)

#let title = if mdtypst.title != none { mdtypst.title } else { "Newsletter" }
#let author = if mdtypst.author != none { mdtypst.author } else { "" }
#let date = if mdtypst.date != none { mdtypst.date } else { "" }

#set page(
  paper: if mdtypst.paper != none { mdtypst.paper } else { "us-letter" },
  margin: if mdtypst.margin != none { mdtypst.margin } else { 0.8in },
)
#set text(size: 10pt)
#set par(leading: 1.2em)

// Masthead spanning full width.
#block(above: 0em, below: 0.4em)[
  #align(center)[
    #text(size: 24pt, weight: "bold")[#title]
    #linebreak()
    #text(size: 10pt)[#author]
    #if date != "" { [\ #text(size: 10pt)[#date]] }
  ]
  #line(length: 100%)
]

// Two-column body after the masthead.
#set columns(2, gutter: 0.25in)

#show heading.where(level: 2): it => [
  #block(above: 0.8em, below: 0.2em)[
    #text(size: 12pt, weight: "bold")[#it.body]
  ]
]

#show heading.where(level: 3): it => [
  #block(above: 0.4em, below: 0.1em)[
    #text(weight: "bold")[#it.body]
  ]
]
