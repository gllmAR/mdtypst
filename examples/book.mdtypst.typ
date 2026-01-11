#set page(
  paper: "a5",
  margin: 1.6cm,
  footer: context [
    #align(center)[#counter(page).display("1")]
  ],
)

#set par(justify: true)

// Book-ish chapter styling
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
