---
'@maestria/omp': minor
'@maestria/shared-pi': minor
'@maestria/pi': patch
---

Mirror OMP's native goal state into Maestria session state.

When OMP's native goal mode is active, the goal objective and status are now
reflected in Maestria state and shown in `/maestria-status` output and
compaction summaries. The mirror clears when the native goal is cleared or the
session switches, and it survives compaction through the existing state
mechanism.

Observation only: Maestria never activates goal mode and never invokes native
goal commands; activation stays OMP-owned. During Maestria workflow-mode
enforcement, OMP's native `goal` tool remains allowed while goal mode is
active, and disappears from active tools when goal mode is off.

The `@maestria/pi` patch ships the same shared state-core change in its
published bundle: `@maestria/shared-pi` is compiled into `dist/extension.mjs`
at build time and never published to npm, so Pi's state shape and summary
rendering now include the native goal mirror.
