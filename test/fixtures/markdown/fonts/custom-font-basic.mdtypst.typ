// Approach 2: Global sans + show-rule overrides

#set text(font: "Inter", size: 11pt)

// Headings default to bold; Roboto Bold isn't bundled, so avoid fallback.
#show heading: set text(weight: "regular")

// Force code to mono.
#show raw: set text(font: "DejaVu Sans Mono")
