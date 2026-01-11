// Compact technical article layout (inspired by typst/templates charged-ieee)

#let paper_title = if mdtypst.title != none { mdtypst.title } else { "Article" }
#let paper_author = if mdtypst.author != none { mdtypst.author } else { "" }
#let paper_date = if mdtypst.date != none { mdtypst.date } else { "" }

#set text(size: 9.5pt, spacing: 0.35em)

#set columns(gutter: 12pt)
#set page(
  columns: 2,
  paper: if mdtypst.paper != none { mdtypst.paper } else { "us-letter" },
  margin: if mdtypst.margin != none { mdtypst.margin } else { 0.85in },
)

// Full-width title block spanning both columns.
#place(
  top,
  float: true,
  scope: "parent",
  clearance: 24pt,
  {
    align(center, {
      text(size: 20pt, weight: "bold")[paper_title]
      linebreak()
      text(size: 10.5pt)[paper_author]
      if paper_date != "" {
        linebreak()
        text(size: 9pt)[paper_date]
      }
    })
  }
)

// Dense paragraph style.
#set par(
  justify: true,
  first-line-indent: (amount: 1em, all: true),
  spacing: 0.5em,
  leading: 0.5em,
)

// Section heading styling (Markdown H2 -> Typst heading level 2).
#show heading.where(level: 2): it => [
  #block(above: 0.9em, below: 0.2em, sticky: true)[
    #text(weight: "bold")[#it.body]
  ]
]

// Subsection heading styling (Markdown H3 -> level 3).
#show heading.where(level: 3): it => [
  #block(above: 0.5em, below: 0.1em, sticky: true)[
    #text(style: "italic")[#it.body]
  ]
]
