---
'@maestria/core': minor
'@maestria/cursor': patch
'@maestria/opencode': patch
'@maestria/pi': patch
'@maestria/kimi-code': patch
'@maestria/hermes': patch
'@maestria/omp': patch
---

Selective routing contract in the canonical orchestrator directives.

**Three routes** - `direct` (host executes, no Maestria specialist spawn),
`focused` (one targeted specialist, one reviewer for non-trivial
work), and `full` (bounded recon, design, implementation, and review). The
full pipeline is an explicit option for complex or high-risk work and for
explicit `fein` requests, not the universal default.

**Route guidance by task class** - explanation and discovery default to
direct, tiny edits to direct or native builder with no automatic recon or
review, ordinary code changes to focused, and complex or high-risk work to
full with independent review where the host supports it. Scaling guardrails
bound child spawns, parallel fan-out, architect/planner use, review lenses,
and context compaction per route; they are bounds, not measured savings.

**Explicit mode semantics** - `fein` selects the full route, `sonar` is
research-only and does not implement, and `blitz` is an explicit
low-risk/direct bypass that does not waive safety floors. An explicit user
mode is honored subject to safety constraints. No platform claims to enforce
modes identically or provide clean isolated contexts.

**Maker/checker preserved** - every routed `@builder` change is followed by
`@reviewer`; where the host cannot enforce separate sessions (e.g. Kimi, Pi,
OMP, Hermes), the split is advisory and stated as such.

**How this affects you:** Maestria no longer routes every turn through the
full pipeline. Small explanations and tiny edits run directly or through one
specialist; the full pipeline stays available for complex, high-risk, or
explicitly `fein` work. No action required on your end - your agents apply
the route contract automatically.
