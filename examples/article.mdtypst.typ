#set page(paper: "a4", margin: 2cm)

#set par(justify: true, leading: 1.2em)
#set text(size: 11pt)

#show heading.where(level: 1): it => [
  #block(above: 1.0em, below: 0.4em)[
    #text(size: 15pt, weight: "bold")[#it.body]
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
