// Inter Tight specimen (two pages)
// This sidecar owns layout; the Markdown body is intentionally empty.

#set page(
  paper: "a4",
  margin: 18mm,
)

#set text(
  font: "Inter Tight",
  fill: rgb("0a2a6b"),
)

#let topbar(lhs, rhs) = [
  #grid(
    columns: (1fr, 1fr),
    column-gutter: 6mm,
    align: (left, right),
  )[
    #text(size: 10pt, weight: 600)[#lhs]
  ][
    #text(size: 10pt, weight: 500)[#rhs]
  ]
]

#let page_title(title) = [
  #text(size: 34pt, weight: 800)[#title]
]

#let body_para(it) = [
  #text(size: 11pt, weight: 450)[#it]
]

#let specimen_line(name, w) = [
  #text(size: 30pt, weight: w)[#name]
]

#let specimen_sample(w) = [
  #text(size: 9pt, weight: w)[
    ABCDEFGHIJKLMNOPQRSTUVWXYZ
    #linebreak()
    abcdefghijklmnopqrstuvwxyz
    #linebreak()
    0123456789
  ]
]

// --- Page 1 (beige background) ---
#set page(fill: rgb("f3e7d9"))

#topbar("Typographie", "Polices de caractère principale")

#v(18mm)

#page_title("Titres et sous-titres")

#v(8mm)

#body_para([
  Inter Tight, sans-sérif moderne conçue par Rasmus Andersson  se distingue
  par sa clarté exceptionnelle et son excellente lisibilité à l’écran et sur papier.
])

#v(6mm)

#body_para([
  Elle est principalement employée pour les titres et sous-titres, assurant une lisibilité
  optimale et une identité visuelle forte. Accessible via Google Fonts, elle garantit
  une utilisation fluide et cohérente sur tous les supports de communication.
])

#v(6mm)

#body_para([
  Les titres et les sous-titres doivent toujours être en casse phrase.
])

#pagebreak()

// --- Page 2 (white background) ---
#set page(fill: white)

#topbar("Guide d’utilisation", "Version 1.1 2025")

#v(18mm)

#align(center)[#text(size: 12pt, weight: 600)[Inter Tight]]

#v(8mm)

#grid(
  columns: (1.2fr, 1fr),
  column-gutter: 14mm,
)[
  // Weight list
  #specimen_line("Black", 900)
  #specimen_line("ExtraBold", 800)
  #specimen_line("Bold", 700)
  #specimen_line("SemiBold", 600)
  #specimen_line("Medium", 500)
  #specimen_line("Regular", 400)
  #specimen_line("Light", 300)
  #specimen_line("ExtraLight", 200)
  #specimen_line("Thin", 100)
][
  // Samples matching the weights
  #specimen_sample(900)
  #v(5mm)
  #specimen_sample(800)
  #v(5mm)
  #specimen_sample(700)
  #v(5mm)
  #specimen_sample(600)
  #v(5mm)
  #specimen_sample(500)
  #v(5mm)
  #specimen_sample(400)
  #v(5mm)
  #specimen_sample(300)
  #v(5mm)
  #specimen_sample(200)
  #v(5mm)
  #specimen_sample(100)
]

#align(left)[#v(6mm) #text(size: 9pt, fill: rgb("0a2a6b"))[20]]
