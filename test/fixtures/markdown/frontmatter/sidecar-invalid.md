# sidecar invalid

Auto-discovered `.mdtypst.typ` sidecar exists but has an invalid `// mdtypst: {...}` JSON header.
The header must be ignored (no crash), but the template should still be loaded.
