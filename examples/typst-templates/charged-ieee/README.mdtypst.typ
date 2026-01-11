// Compact technical article layout (inspired by typst/templates charged-ieee)
#set page(paper: "us-letter", margin: 0.85in)
#set text(size: 9.5pt)
#set par(leading: 1.15em, justify: true)

// Two-column body with a full-width title block.
#show heading.where(level: 1): it => [
  #block(above: 0em, below: 0.6em)[
    #align(center)[#text(size: 18pt, weight: "bold")[#it.body]]
  ]
  #set columns(2, gutter: 0.25in)
]

#show heading.where(level: 2): it => [
  #block(above: 0.8em, below: 0.2em)[
    #text(weight: "bold")[#it.body]
  ]
]
