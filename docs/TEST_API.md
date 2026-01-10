# mdtypst test / debug API

The browser renderer exposes a small API on `globalThis.__mdtypst`.

This API exists primarily for the Playwright fixture runner (`test/run-fixtures.mjs`) and the perf harness (`test/run-perf.mjs`). It is also useful when debugging in DevTools.

## Shape

`globalThis.__mdtypst` is an object with the following functions:

- `getStatusText(): string`
  - Returns the text content of the `#status` element.

- `getPdfBlob(): Blob | null`
  - Returns the last rendered PDF as a `Blob`, or `null` before a successful render.

- `getTypstSource(): string | null`
  - Returns the last generated Typst source used for compilation.
  - Useful for debugging compilation errors.

- `getTimings(): { marks: Record<string, number>, counters: Record<string, number> }`
  - Returns timestamps and counters captured during rendering.
  - The perf harness uses this to compute phase durations.

- `compileToPDF(markdown: string, documentUrl?: string): Promise<Uint8Array | ArrayBuffer | unknown>`
  - Compiles Markdown content to PDF bytes via Typst.
  - Used by tests; not intended as a stable public API.

- `displayPDF(pdfData: ArrayBuffer | Uint8Array): void`
  - Displays PDF bytes in the iframe and updates UI status.

## Conventions

- The `#status` element is considered the authoritative signal for completion.
  - `.success` means the PDF should be available.
  - `.error` means rendering failed.

- The fixture runner treats missing/too-small PDF output as a failure.

## Stability

This API is internal and can change. If you want to expose a public API, consider adding a separate `window.mdtypst` namespace with versioning.
