// Approach 6: Unicode-heavy content with a robust default font

#set text(font: "Roboto", size: 11pt)

// Code points / symbols often benefit from a mono fallback in raw blocks.
#show raw: set text(font: "DejaVu Sans Mono")
