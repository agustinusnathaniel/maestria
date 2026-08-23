---
'maestria': patch
---

fix(cli): never silently downgrade on implicit update

`maestria update` (no `-V`) short-circuited only on exact version equality, so an install NEWER than the registry's latest — a local dev build or an unpublished release — sailed past the guard and was silently downgraded by `platform.update()`. Meanwhile `maestria check` correctly reported that same install as current (exit 0), so the two commands disagreed on identical machine state.

Implicit updates now skip any install strictly ahead of latest with an explicit "newer than latest; skipping" message, and the interactive picker only offers platforms that are strictly behind latest. Explicit `--version` pins are honored verbatim — downgrades included. New `isVersionGt()` and `needsUpdateOf()` helpers keep check and update semantics in one place.
