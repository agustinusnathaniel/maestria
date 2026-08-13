# Installing @maestria/prime-agent

> Status: `Native candidate` - Skills-first delivery. The generated skills match the documented Prime Agent Agent Skills contract (verified 2026-08-13 against upstream commit `7787f07415d843b9a800f6a4720e0c739bd608e5`), but runtime behavior is **not yet tested end to end**. The executable extension (JSON/RPC headless modes, recursive-subagent dispatch) is deferred and is not part of this package.

## Prerequisites

- **Prime Agent** installed (see Prime's [getting started](https://github.com/PrimeIntellect-ai/prime-agent)).
- Node.js and pnpm only if contributing to this repository (to regenerate files from the canonical core directives). Prime installs registered packages itself via npm; pnpm is not required to consume this package.

## Install

Prime Agent loads skills from project/global skill directories, package `skills/` directories or `pi.skills` entries, and the `skills` array in settings. It does **not** auto-discover arbitrary installed npm packages from `node_modules`. To make Prime load this package's skills, register the package with Prime (Option A) or point Prime at the package's `skills/` directory explicitly (Options B and C).

### Option A: register the package with Prime (preferred)

Register the published package with Prime's package mechanism. This records the package in Prime's settings and installs it via npm:

```bash
prime-agent package install npm:@maestria/prime-agent
```

- By default the package is recorded in global settings (`~/.prime/agent/settings.json`); add `--local` to record it in project settings (`.prime/agent/settings.json`), which Prime installs automatically at startup.
- Prime then reads the package's `pi.skills` manifest entry and its `skills/` directory to discover the skills.
- `prime-agent package install` also accepts git sources and local paths (for example a maestria checkout), so you can consume this package before it is published. See Prime's [packages documentation](https://github.com/PrimeIntellect-ai/prime-agent/blob/7787f07415d843b9a800f6a4720e0c739bd608e5/packages/coding-agent/docs/packages.md) for the full source syntax.

### Option B: explicit `skills` entry in settings

Add the package's skills directory to Prime's settings (`~/.prime/agent/settings.json` for your user, or `.prime/agent/settings.json` in the project):

```json
{
  "skills": ["/path/to/node_modules/@maestria/prime-agent/skills"]
}
```

This is the explicitly documented settings mechanism ([skills docs](https://github.com/PrimeIntellect-ai/prime-agent/blob/7787f07415d843b9a800f6a4720e0c739bd608e5/packages/coding-agent/docs/skills.md)) and works with a local clone too:

```json
{
  "skills": ["/path/to/maestria/packages/prime-agent/skills"]
}
```

### Option C: copy or symlink into a skill directory

Copy or symlink the skill directories into a project or global skill location, for example:

```bash
ln -s /path/to/maestria/packages/prime-agent/skills/* ~/.prime/agent/skills/
```

### Dependency installs are setup only

`pnpm add @maestria/prime-agent` (or `npm install`) makes the package available to your own tooling, but Prime does not scan `node_modules`; a dependency install alone does not make Prime discover the package. Use Option A to register the package, or Option B/C to point Prime at its `skills/` directory.

## Verification

1. Start Prime Agent from the repository or project you want it to work in.
2. Run `/reload` to rediscover new or edited skill metadata.
3. Confirm the skills appear (for example, run `/skill:orchestrator` or ask the agent to load the `global-rules` skill).

> Step 3 is a runtime check that is **not yet verified** in this batch; the package-level gates are `pnpm validate` (frontmatter/layout) and `pnpm test` (generated-skill assertions).

## Security

Prime Agent is **not a sandbox**: it executes model-generated Python and project commands with your user permissions. Review skill content before use and restrict usage to trusted repositories, skills, and instructions. This package ships no executable code; it is prompt methodology only.

## Updating generated content

Do not edit `skills/` by hand - it is generated from `packages/core/agent-directives/`. After changing canonical content:

```bash
scripts/sync-all          # regenerate all platform packages
scripts/check-sync        # verify everything is in sync
```

The root pipeline auto-discovers this package via its `sync.config.ts`; there is no package-local `sync` script.

## Uninstall / removal

Remove the registration, settings entry, symlink, or installed package. If you used Option A, unregister it with `prime-agent package remove npm:@maestria/prime-agent`; otherwise removal is simply dropping the settings `skills` entry or symlink that points Prime at `skills/`.
