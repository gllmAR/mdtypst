#set page(paper: "a4", margin: 1.6cm)

#set text(size: 10.5pt)
#set par(leading: 1.15em)

// CV-style heading tweaks
#show heading.where(level: 1): it => [
  #block(above: 0.8em, below: 0.4em)[
    #text(weight: "bold", size: 13pt)[#it.body]
    #line(length: 100%)
  ]
]
#show heading.where(level: 2): it => [
  #block(above: 0.6em, below: 0.2em)[
    #text(weight: "bold")[#it.body]
  ]
]
#show heading.where(level: 3): it => [
  #block(above: 0.3em, below: 0.1em)[
    #text(weight: "bold")[#it.body]
  ]
]
