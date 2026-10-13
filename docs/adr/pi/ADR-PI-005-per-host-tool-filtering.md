# ADR-PI-005: Per-Host Tool Filtering

## Status

Accepted (2026-10-02), Confidence: High. Amended 2026-10-04: narrowed the title to per-host filtering alone and moved the two peer-line decisions to the runtime support matrix. Condensed 2026-10-12 after the native OMP package was retired; the original decision date is unchanged.

## Context

Generated Pi agent files carry a YAML `tools:` allowlist in frontmatter, and nothing between disk and a running session checks the names in it. Pi registers its builtin tools from a single `allToolNames` constant, and `glob` is not in it, so a `glob` entry parses and then names no registered tool when the host narrows the session's active set: it denies nothing and grants nothing, so the capability is lost with no error anywhere `[verified]`, the frontmatter loader doing no membership check and the host silently skipping an active-set name it cannot resolve.

The shared projection pipeline once also served a native Oh My Pi package, where `glob` is a real essential builtin, so a filter applied across the Pi family would have stripped a working tool there. That package was retired on 2026-10-12 (OMP now consumes the declarative bundle under [CORE-034](../core/ADR-CORE-034-consolidated-declarative-plugin.md)); the per-host design remains because any later Pi-family consumer would again register a different builtin set.

## Decision

1. **Intersect declared tool names with each host's registrations when the frontmatter is built.** The shared sync table declares what each specialist needs once, as inline data with no canonical `tools:` frontmatter upstream of it, and an optional `hostTools` list is intersected with it to produce the emitted `tools:` line. The intersection is computed while the prepend string is constructed rather than through a `replace` operation, because the pipeline applies `replace` before `prepend` and a `replace` cannot parameterize a value it does not itself construct.
2. **A host passes the set it registers; omitting the list passes every declared name through.** Pi declares its registered set. A host that registers every declared name declares no list and its projection stays unchanged.
3. **Drop an unknown name; never substitute it.** A name the host does not register is removed rather than mapped onto a similar name, because that would advertise a capability the host does not provide under a label the reader trusts. Mapping `glob` onto `find` is the case to refuse: `find` is already granted, so the mapping would only change which tool runs under a name the operator did not grant.
4. **Guard each shipped list against the host that projection targets.** The assertion reads each host's builtin names from that host's own shipped constant, not from any declaration here, so it is not tautological and host drift fails loudly. Deriving both sides from the sync table's own declaration was rejected because it can only ever agree with itself.

## Consequences

Every name in a shipped list is one the target host registers, so a stale declared name can no longer cost a capability silently on Pi. Host-specific output may differ from the shared declaration; that asymmetry is intended and unexplained in the generated files.

Tool-set knowledge is duplicated by design: the sync table declares what a specialist needs, and each host config declares what that host registers. The Pi host list is transcribed by hand and must be re-checked against the host whenever the host pin moves; a host that adds a builtin otherwise changes nothing until a specialist declares that name.

Review mode's separate read-only allowlist also names `glob` and was left unchanged: an unknown entry there is inert, the opposite semantic from the exhaustive frontmatter allowlist corrected here.

Retired consumer (retired 2026-10-10 by [CORE-034](../core/ADR-CORE-034-consolidated-declarative-plugin.md)): the native OMP package passed the declared names through unfiltered and is no longer built here. Its `ls` entry named no builtin on that host (`[verified]` when recorded); that finding no longer constrains any shipped artifact.

## Security Boundaries

The emitted `tools:` frontmatter is the enforcement point for per-specialist tool isolation, so its accuracy is a trust boundary, not a cosmetic detail. A silent no-op entry weakens it in one direction, a capability the operator believes is restricted, and a substituted name would weaken it in the other. Intersecting with the host's real registrations keeps the list exhaustive, and for the read-only roles the drop removes a search tool and nothing else, so their read-only intent is unchanged.

## Alternatives Considered

- **Remove `glob` from the shared declared table.** Rejected: it strips a tool that another host in the family registers and requires.
- **Validate tool names in the host.** Rejected: the host is third-party.

## What Would Change These Verdicts

- **Construction-time intersection:** a pipeline that applies `prepend` before `replace`, which would let the filtering move into a `replace` operation.
- **Per-host rather than family-wide filtering:** every Pi-family consumer registering the same builtin set, which would make one shared filter safe.
- **Drop rather than substitute:** a host that documents an alias rule making a dropped name resolve to a real tool, which would turn the drop into a silent substitution.
- **Host-read guard:** a host that stops shipping its builtin names as a readable constant, which leaves the guard unable to read the host rather than reporting drift.

## Date

2026-10-02
