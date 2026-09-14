# OMP Platform Detection Notes

**Status:** Informational and historical. Both issues below were fixed in CLI PRs #118 (detection path) and #120 (package specifier); the handler now lives in `apps/maestria-cli/src/lib/platforms.ts`, and user installation commands are in the [Pi/OMP installation guide](https://maestria.sznm.dev/pi-omp/getting-started/installation/). [verified] 2026-09-14: `platforms.ts` uses the `plugins/` path and an empty `referencePrefix` for OMP.

## Durable findings

- OMP v17 stores npm packages at `~/.omp/plugins/node_modules/@maestria/omp/package.json` (`plugins/`, not Pi's `agent/npm/`). Pi and OMP share one handler shape, with OMP supplying its own path and `plugin` command prefix.
- Do not use an `npm:` prefix in OMP package specifiers (`omp plugin install npm:@maestria/omp`). Bun records a self-alias (`"@maestria/omp": "npm:@maestria/omp"`) and fails with `Package "@maestria/omp@..." has a dependency loop`; the prefix is a parser compatibility shim, not a documented OMP CLI feature. Use the bare name: `omp plugin install @maestria/omp`.
- Remediation for an affected install: `cd ~/.omp/plugins && bun install @maestria/omp` replaces the stale alias with a normal semver range.

## Next step

None - informational. The CLI changelog and `platforms.ts` are authoritative.
