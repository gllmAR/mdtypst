// Demonstration: serif vs sans vs monospace in one PDF.
// Uses fonts that are bundled by the Typst browser runtime.

// Make the intent explicit in the rendered PDF.
#set page(
	header: align(right)[
		#text(size: 8pt)[
			Body: New Computer Modern · Headings: Inter (fallback Roboto/DejaVu Sans Mono) · Code: DejaVu Sans Mono
		]
	]
)

// Body: serif (pick something visually distinct from Typst's common default).
#set text(font: "New Computer Modern", size: 11pt)

// Headings: sans-serif.
// Use an explicit font wrapper so the result is visible even if Roboto is
// unavailable (then it will fall back to DejaVu Sans Mono instead of serif).
#show heading: it => {
	set text(font: ("Inter", "Roboto", "DejaVu Sans Mono"), weight: "bold")
	it
}

// Code (inline + blocks): monospace.
#show raw: set text(font: "DejaVu Sans Mono")
