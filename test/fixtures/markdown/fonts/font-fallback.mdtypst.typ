// Approach 3: Font fallback chain
// First entry is intentionally missing to demonstrate fallback.

#set text(font: ("Definitely-Not-A-Font", "Libertinus Serif"), size: 11pt)

// Still keep code readable.
#show raw: set text(font: "DejaVu Sans Mono")
