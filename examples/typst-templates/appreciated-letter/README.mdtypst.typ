// Letter-like layout (inspired by typst/templates appreciated-letter)
#set page(paper: "us-letter", margin: 1in)
#set text(size: 11pt)
#set par(leading: 1.25em, justify: true)

// Make the first heading act as a letterhead.
#show heading.where(level: 1): it => [
  #block(above: 0em, below: 0.7em)[
    #text(size: 18pt, weight: "bold")[#it.body]
  ]
]

// Use level-2 heading as a subject line.
#show heading.where(level: 2): it => [
  #block(above: 0.8em, below: 0.4em)[
    #text(weight: "bold")[#it.body]
  ]
]
