// Approach 1: Global font + element-specific overrides
// - Body text uses a serif family
// - Code uses a dedicated mono family

#set text(font: "New Computer Modern", size: 11pt)

// Keep headings consistent and slightly heavier.
#show heading: set text(weight: "bold")

// Code (inline + blocks)
#show raw: set text(font: "DejaVu Sans Mono")
