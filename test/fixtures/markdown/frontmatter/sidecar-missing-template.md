# sidecar missing sidecar

This test passes an explicit `sidecar=` parameter pointing at a missing `.typ` sidecar.
The document should still compile, and it must not inject `#include "/mdtypst/template.typ"`.
