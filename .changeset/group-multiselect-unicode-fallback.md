---
'maestria': patch
---

Respect terminal unicode support in CLI group-multiselect fallback prompt (ASCII glyphs on non-unicode terminals).

Custom toggle-all renderer and instructions are retained, unicode terminals are unchanged, and the fallback now matches native @clack/prompts ASCII glyphs.
