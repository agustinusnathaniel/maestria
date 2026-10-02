# ADR-PI-005: Pi Subagents 21.x Peer Line and Pi-Only Host Tool Filtering

## Status

Accepted (2026-10-02), Confidence: High.

## Context

Two independent Pi projection problems surfaced while aligning `@maestria/pi` with the current Pi host line. They share no code and are recorded together only because both concern the Pi projection's fidelity to its host.

**The peer range contradicted our own install instructions.** `@maestria/pi` declared a peer of `@gotgenes/pi-subagents@^18.0.0`, while both documented install paths installed the unpinned latest release: the maestria CLI prerequisite ran `pi install npm:@gotgenes/pi-subagents` with no version, and the package README told users the same. Anyone following our instructions therefore received the current 21.x line against a peer that rejects it, a self-inflicted peer conflict.

Moving to the 21.x line is safe for the contract maestria consumes. Reading the published type declarations for both lines, `getSubagentsService`, `spawn(type, prompt, options?)`, `getRecord(id)`, and `abort(id)` keep their signatures and `SpawnOptions` keeps its seven keys. `SUBAGENT_EVENTS` retains the four names maestria subscribes to as a subset of the 21.x constant, which adds more. `SubagentRecord` only gains fields. The agent frontmatter loader reads the same ten keys, including `tools:`, in both lines. The `permission:` frontmatter key belongs to a separate optional package and is not required: with that package absent, the lifecycle events maestria listens for have no subscriber, which is a harmless no-op. The 21.x peer on the Pi host is a lower bound with no ceiling, so it admits Pi 1.0, and its one new required peer is already declared by `@maestria/pi`.

Two upstream semantic deltas are worth naming because neither is observable at our call sites. Omitting `foreground` means different things across the two lines; every maestria spawn site passes `foreground: true` explicitly, so the delta cannot bite. From 21.0.0 a caller-supplied `model`, `thinking`, `max_turns`, `inherit_context`, or `run_in_background` wins over agent frontmatter unless the frontmatter sets `locked:`; every maestria agent sets `inherit_context: true` and every spawn site passes `inheritContext: true`, so the two agree and nothing changes.

**A declared tool name was inert on Pi.** Generated Pi agent files carry a YAML `tools:` allowlist in frontmatter, and the frontmatter parser does not validate tool names. Pi registers its builtin tools from a single `allToolNames` constant, and `glob` is not in it on either the current line or the 1.0 line. An unregistered name passes through as a silent no-op filter entry: it denies nothing and grants nothing, so the capability is simply lost with no error anywhere. This is pre-existing on the 0.84 line and is not a regression from 1.0. Read-only intent is not compromised, because every remaining valid name already excludes all mutating tools.

The same `tools:` frontmatter reaches Oh My Pi, where `glob` is a real registered builtin and is classed essential. A Pi-family-wide fix that removed the name would strip a working tool from OMP, which is a regression on another platform.

There is no canonical `tools:` frontmatter in `packages/core/agent-directives/`; the lists are inline data in the shared Pi and OMP sync table, so a shared fix would edit the one table both platforms read.

## Decision

1. **Adopt the 21.x line for the pi-subagents peer.** `@maestria/pi` declares `@gotgenes/pi-subagents` through the workspace catalog rather than an inline literal, matching how the OMP host peer is wired, so the range has a single home that install, typecheck, and peer validation all read. The installer and every user-facing instruction name the supported range instead of bare latest.
2. **Filter declared tool names per host at construction time.** The shared sync table declares the tool names each specialist needs once, and an optional `hostTools` list is intersected with it to produce the emitted `tools:` line. Omitting `hostTools` passes every declared name through unchanged, so OMP declares no list and its projection is byte-identical to before. Pi passes the set its host registers. The intersection happens when the prepend string is built rather than through a `replace` operation, because the transform pipeline applies `replace` before `prepend` and a `replace` cannot parameterize a value it does not itself construct.
3. **Drop unknown names; never substitute.** A name the host does not register is removed from the emitted list. It is not mapped onto a similar name, because that would advertise a capability the host does not provide under a label the reader trusts.

## Consequences

Positive:

- The peer range, the workspace catalog, and the documented install command agree, so the documented path no longer produces a peer conflict.
- The prerequisite stops tracking the registry's latest line, so a new upstream major cannot silently change what a fresh `maestria install pi` puts on a user's machine.
- A declared tool name the host does not implement can no longer ship silently on Pi; the intersection is mechanical and the emitted list is checked by a test.
- OMP's projection is untouched, so its working `glob` builtin survives.

Negative:

- The Pi projection drops a name that OMP keeps, so the two platforms' generated files now differ where they previously matched. That divergence is the point, but it means a reader comparing the two directories sees an intentional asymmetry with no comment in the generated files explaining it.
- The tool set is duplicated knowledge: the sync table declares what a specialist needs, and `packages/pi/sync.config.ts` declares what the host registers. A host that adds a builtin does not require a sync change unless a specialist starts declaring it.
- `PI_SUBAGENTS_RANGE` in the CLI is a second copy of the catalog range, because a published CLI cannot read `pnpm-workspace.yaml` at runtime. The two can drift; only the CLI copy is reachable by a user's install.
- The Pi host's builtin list is transcribed into `packages/pi/sync.config.ts` by hand, so a host release that adds or removes a builtin leaves the transcription stale until someone re-reads the host.

Neutral:

- The catalog floor admits releases newer than the one a given install resolves, so the resolved version can move without a manifest change.
- Dropping `glob` costs no glob-shaped search on Pi: `find` matches glob patterns and `grep` takes an optional glob path filter, both of which the remaining lists already grant.
- `REVIEW_READ_ONLY_TOOLS` in the shared Pi tools module also lists `glob` and was left unchanged. That list is a defensive allowlist for review mode, where an unknown entry is inert and never denies a capability, which is the opposite semantic from the exhaustive frontmatter allowlist corrected here.

## Security Boundaries

The generated `tools:` frontmatter is the enforcement point for per-specialist tool isolation, so its accuracy is a trust boundary rather than a cosmetic detail. Silent no-op entries weaken it in one direction (a missing tool the operator believes is restricted) and a wrong name would weaken it in the other. The intersection keeps the emitted list exhaustive against the host's real registrations.

## Assumptions

- `[verified]` The dispatch contract is unchanged between the 18.x and 21.x lines for the four members maestria calls and for `SpawnOptions`, read from each published `dist/public.d.ts`.
- `[verified]` The Pi host resolves an `npm:<pkg>@<spec>` spec through semver range semantics: `parseNpmSpec` splits the trailing version text, the range is derived with semver `validRange`, an exact version is distinguished from a range, installed-version comparison uses `satisfies`, update reconciliation uses `maxSatisfying`, and the raw spec reaches `npm install` unchanged. Identical logic is present in the currently resolved host and in a 1.0.0 copy.
- `[verified]` `glob` is absent from the Pi host's `allToolNames` on the resolved host and on a 1.0.0 copy, and is present in the OMP host's `BUILTIN_TOOL_NAMES`.
- `[verified]` The host's agent frontmatter loader does not reject an unknown tool name.
- `[inferred]` Review mode's `glob` entry is currently unreachable in practice, so leaving it costs nothing today. It is a defensive allowlist, so a future Pi release adding a real `glob` would be permitted rather than blocked.

## Alternatives Considered

- **Keep the 18.x peer and pin the installer to 18.x.** Rejected: it keeps the declared range contradicting what users were already getting, and it forfeits the upstream host-admission fix the 21.x peer carries.
- **Widen the peer to any version and leave the installer unpinned.** Rejected: that leaves the fresh-install path unconstrained, which is the actual defect.
- **Pin the installer to one exact version instead of a range.** Rejected: the host source shows a range is a first-class spec that participates in installed-version comparison and update reconciliation, so an exact pin would add drift risk for no gain. This was the fallback had the range proved unverifiable.
- **Add the new peer as a runtime dependency.** Rejected: `@maestria/pi` is a Pi extension, and Pi provides its host peers; declaring it again would create a second copy.
- **Remove `glob` from the shared declared table.** Rejected: it strips a working, essential tool from OMP.
- **Filter tool names inside the transform pipeline with a `replace` operation.** Rejected: `replace` runs before `prepend`, so it cannot parameterize a value constructed in `prepend`.
- **Map `glob` onto `find`.** Rejected: it would advertise a differently-behaving tool under a name the operator did not grant, and `find` is already granted.
- **Validate tool names in the host instead.** Rejected: the host is third-party.
- **Add a second core assertion that every declared name is known to at least one host.** Considered and adopted, but only in a non-tautological form: both host lists are read from each installed host's own shipped constant, so the assertion can fail when a host changes. Deriving both sides from the sync table's own declaration was rejected because it can only ever agree with itself.

## What Would Change These Verdicts

- **pi-subagents peer:** a 21.x release that changes `spawn`, `getRecord`, `abort`, `getSubagentsService`, or the `SpawnOptions` keys maestria passes; a new required peer `@maestria/pi` does not declare; or a Pi host upper bound below the line maestria supports. Any of these makes the peer range wrong again rather than merely narrow.
- **Installer pin:** evidence that the host rejects a non-exact spec in `npm:<pkg>@<spec>`. The current verdict rests on reading the host's own resolution path, not on executing an install, so a contrary release note would reopen it and force the exact-version fallback.
- **Tool filtering:** a Pi release that registers a `glob` builtin, which would make the dropped name worth restoring; or an OMP release that stops registering `glob`, which would let the intersection replace the pass-through default and let OMP declare its list too.
- **Host tool transcription:** any Pi release whose `allToolNames` differs from the set in `packages/pi/sync.config.ts`. The guard test reads the host directly, so a change is reported as a failing assertion rather than silently ignored; the transcription itself still needs a human to update.

## Related Decisions

- [ADR-PI-001](ADR-PI-001-rules-injection.md) - the rules-injection decision that names a pi-subagents version line. This record extends it: its mechanism and rationale hold, and its Consequences line recording an 18.x requirement has since drifted from the shipped peer. The permitted correction is a dated divergent-claim annotation there naming this record and `packages/pi/package.json` as authoritative; it has not been applied here because that record is frozen.

## Date

2026-10-02
