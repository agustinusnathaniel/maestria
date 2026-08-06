---
'@maestria/omp': minor
---

Mirror OMP's native goal state into Maestria session state by observing the
public goal events. Goal lifecycle transitions are handled safely across
session switches, branches, tree navigation, and restoration, using valid
public mode data or resetting to unknown when no trustworthy event exists.

Model goal-tool behavior remains fail-closed when native tool provenance cannot
be established. Maestria does not activate native goal mode or invoke OMP goal
commands.
