---
'@maestria/pi': patch
---

Restore session state from the current branch and rehydrate on session-tree navigation.

`/maestria-status`, compaction summaries, and mode enforcement previously restored
persisted state from `sessionManager.getEntries()`, which spans the entire session
tree — resuming a session could pull a sibling branch's `maestria_state` (wrong mode,
wrong active task). Restoration now reads only the current branch via `getBranch()`,
matching the omp extension's semantics, and a new `session_tree` handler rehydrates
state when navigating between branches so the UI never shows stale state.
