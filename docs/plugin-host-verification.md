# Plugin Host Verification

## Purpose

Verify that host loaders actually discover the consolidated plugin and reach shared methodology. Package tests check the archive and manifests; these optional probes exercise installed host code without adding host runtimes to the workspace dependencies.

## Claude Code native child

With Claude Code installed, run from the repository root:

```sh
node --experimental-strip-types scripts/e2e/claude-skill-preload.ts --out artifacts/claude-skill-preload-evidence.json
```

The probe launches the real CLI with a temporary config and working directory, disables session persistence and nonessential traffic, and supplies a local Anthropic-compatible fixture with a dummy credential. The fixture requests the plugin's reviewer agent and observes its child request and return. It records checks and content digests rather than prompts, credentials, or headers. No paid inference is involved.

On Claude Code 2.1.217, all ten checks passed: the native dispatch tool was exposed, the reviewer wrapper loaded, both reviewer and global-rules skills reached the child context, the child had tools but no Write/Edit, and its result returned to the parent. This establishes native loading and tool-schema restrictions for this role. The deterministic fixture does not evaluate model judgment, shell-mediated editing, every specialist, or other CLI versions. The plugin loads from the generated `packages/agent-plugins/plugin/` installation directory; the separate packed-artifact test covers archive inclusion.

## OMP packed discovery

With Bun and the OMP 18.4.8 package source installed, run:

```sh
pnpm exec bun scripts/e2e/omp-plugin-discovery.ts --host-root /absolute/path/to/@oh-my-pi/pi-coding-agent --out artifacts/omp-plugin-discovery.json
```

The probe packs the plugin, extracts it into temporary directories, and invokes the actual OMP capability providers and installed-plugin loader. It constructs the expected npm installation layout and package manifest directly; it does not run `PluginManager.install` or `omp plugin install`. It uses temporary host paths without installing into the user's configuration. The artifact records the host version, discovered paths, checks, and reproduction command.

OMP 18.4.8 discovered 14 shared skills, seven root agents, zero commands, and zero rules from the archive. Its installed-plugin loader registered the package fixture with `omp: {}` and ignored an otherwise identical fixture without that metadata. This verifies loader registration and discovery, not the npm installation transaction, model behavior, task execution, permissions, session hooks, or other OMP versions.

## Preservation and remaining limits

- Shared skill bodies remain generated from core. Host-specific model and tool metadata remain in isolated native profiles.
- Claude preloads shared skills through its native `skills` field. Cursor and generic profiles retain generated role bodies because equivalent child skill preloading has not been established.
- Kimi selects the shared skill corpus, suppresses generic custom-agent discovery, and requires the parent to load and inline the complete role and global contract before dispatching a built-in child. Newer manifest fields and end-to-end child loading remain unverified.
- Mode aliases select the shared orchestrator and mode skills, carrying the user's goal, constraints, and arguments. Duplicate Claude mode commands and Kimi role-skill copies are retired; unused directory scaffolding is removed.

These probes supplement `pnpm check`, `vp check`, and sync verification. Their generated JSON artifacts live under ignored `artifacts/`; regenerate them when the relevant loader contract changes. Other clients retain the documented support boundaries until equivalent evidence exists.
