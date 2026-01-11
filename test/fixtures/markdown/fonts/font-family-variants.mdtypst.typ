// Approach 4: Variants (bold/italic) + element-specific font families

#set text(font: "Inria Serif", size: 11pt)

// Ensure emphasis/strong use the font's variants.
#show strong: set text(weight: "bold")
#show emph: set text(style: "italic")

// Code uses a mono family.
#show raw: set text(font: "DejaVu Sans Mono")
