# ADR-PI-005: Per-Host Tool Filtering

## Status

Accepted (2026-10-02), Confidence: High. Amended 2026-10-04: narrowed the title to per-host filtering alone, moved the two peer-line decisions to the runtime support matrix, and restored the verified inert-name consequence on the OMP projection. The original decision date is unchanged.

## Context

Generated Pi and OMP agent files carry a YAML `tools:` allowlist in frontmatter, and nothing between disk and a running session checks the names in it. Pi registers its builtin tools from a single `allToolNames` constant, and `glob` is not in it, so a `glob` entry parses and then names no registered tool when the host narrows the session's active set: it denies nothing and grants nothing, so the capability is lost with no error anywhere `[verified]`, the frontmatter loader doing no membership check and the host silently skipping an active-set name it cannot resolve.

The same frontmatter reaches Oh My Pi, where `glob` is a real builtin classed essential `[verified]` in the host's shipped tool sources. The hosts share one projection pipeline but not one builtin set, so a filter applied across the Pi family would strip a working essential tool from OMP.

## Decision

1. **Intersect declared tool names with each host's registrations when the frontmatter is built.** The shared sync table declares what each specialist needs once, as inline data with no canonical `tools:` frontmatter upstream of it, and an optional `hostTools` list is intersected with it to produce the emitted `tools:` line. The intersection is computed while the prepend string is constructed rather than through a `replace` operation, because the pipeline applies `replace` before `prepend` and a `replace` cannot parameterize a value it does not itself construct.
2. **Pi passes the set its host registers; OMP passes none.** Omitting `hostTools` passes every declared name through unchanged, so OMP declares no list, its projection stays byte-identical, and its working `glob` survives.
3. **Drop an unknown name; never substitute it.** A name the host does not register is removed rather than mapped onto a similar name, because that would advertise a capability the host does not provide under a label the reader trusts. Mapping `glob` onto `find` is the case to refuse: `find` is already granted, so the mapping would only change which tool runs under a name the operator did not grant.
4. **Guard each shipped list against the host that projection targets.** The assertion reads each host's builtin names from that host's own shipped constant, not from any declaration here, so it is not tautological and host drift fails loudly. Deriving both sides from the sync table's own declaration was rejected because it can only ever agree with itself.

## Consequences

Every name in a shipped list is one the target host registers, so a stale declared name can no longer cost a capability silently on Pi, and the platforms' generated files now differ where they previously matched. That asymmetry is intended and unexplained in the generated files.

Tool-set knowledge is duplicated by design: the sync table declares what a specialist needs, and each host config declares what that host registers. The Pi host list is transcribed by hand and must be re-checked against the host whenever the host pin moves; a host that adds a builtin otherwise changes nothing until a specialist declares that name.

Review mode's separate read-only allowlist also names `glob` and was left unchanged: an unknown entry there is inert, the opposite semantic from the exhaustive frontmatter allowlist corrected here.

The OMP pass-through carries the same defect class on the half of the family this record otherwise does not touch. `ls` appears in the emitted OMP `tools:` lines, and OMP registers no builtin by that name and has no alias that maps it onto one, so each occurrence names nothing the host can activate and denies nothing while granting nothing. `find` is unregistered by name too but is not inert: OMP's `normalizeToolName` maps it as a legacy alias onto `glob`, and the host applies that normalization to agent frontmatter `tools:` lists, so it resolves to a real tool. Whether any other emitted name resolves is the host's own list to answer, read OMP's `BUILTIN_TOOL_NAMES` rather than trusting a name recorded here. Correcting `ls` would mean giving OMP a list of its own, reopening the pass-through as a separate decision `[verified]`.

## Security Boundaries

The emitted `tools:` frontmatter is the enforcement point for per-specialist tool isolation, so its accuracy is a trust boundary, not a cosmetic detail. A silent no-op entry weakens it in one direction, a capability the operator believes is restricted, and a substituted name would weaken it in the other. Intersecting with the host's real registrations keeps the list exhaustive, and for the read-only roles the drop removes a search tool and nothing else, so their read-only intent is unchanged.

## Alternatives Considered

- **Remove `glob` from the shared declared table.** Rejected: it strips a working, essential tool from OMP.
- **Validate tool names in the host.** Rejected: the host is third-party.

## What Would Change These Verdicts

- **Construction-time intersection:** a pipeline that applies `prepend` before `replace`, which would let the filtering move into a `replace` operation.
- **Pi filters, OMP passes through:** an OMP release that stops registering `glob`, which would make a family-wide filter safe and let OMP declare its own list.
- **Drop rather than substitute:** a host that documents an alias rule making a dropped name resolve to a real tool, which would turn the drop into a silent substitution.
- **Host-read guard:** a host that stops shipping its builtin names as a readable constant, which leaves the guard unable to read the host rather than reporting drift.

## Date

2026-10-02
