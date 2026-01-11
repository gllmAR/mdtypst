// Newsletter layout (inspired by typst/templates dashing-dept-news)
#set page(paper: "us-letter", margin: 0.8in)
#set text(size: 10pt)
#set par(leading: 1.2em)

#show heading.where(level: 1): it => [
  #block(above: 0em, below: 0.4em)[
    #align(center)[#text(size: 22pt, weight: "bold")[#it.body]]
    #line(length: 100%)
  ]
]

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

// Optional: two-column layout after the masthead
#set columns(2, gutter: 0.25in)
