---
'@maestria/omp': minor
'@maestria/shared-pi': minor
'@maestria/pi': patch
---

Mirror OMP's native goal state into Maestria session state.

When OMP's native goal mode is active, paused, and budget-limited goal
objective/status are reflected in Maestria state and shown in `/maestria-status`
output and compaction summaries. Non-null complete and dropped terminal events
clear the current-goal mirror after persisting the transition.

Session start, switch, fork, branch, handoff, and tree-navigation transitions
restore the complete target-session Maestria state. A valid public `mode_change`
goal entry restores the native mirror; otherwise it resets to unknown (`null`)
until a future public `goal_updated` event. This prevents stale state from
surviving navigation when OMP provides no transition follow-up goal event.

Observation only: Maestria never activates goal mode or invokes native goal
commands. User-issued OMP `/goal` commands for pause, resume, and drop remain
OMP-owned and available. The public OMP extension API does not expose native
tool provenance, so Maestria does not make a name-only `goal` exemption during
pure-dispatcher enforcement; model `goal` calls remain blocked when provenance
cannot be established.

The OMP peer range is `>=17.0.5 <18.0.0`, matching the verified public event and
extension APIs used by this release.

The `@maestria/pi` patch ships the same shared state-core change in its
published bundle: `@maestria/shared-pi` is compiled into `dist/extension.mjs`
at build time and never published to npm, so Pi's state shape and summary
rendering now include the native goal mirror.
