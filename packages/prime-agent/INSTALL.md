# Installing @maestria/prime-agent

> Status: `Native candidate` - Skills-first delivery. The generated skills match the documented Prime Agent Agent Skills contract (verified 2026-08-13 against upstream commit `7787f07415d843b9a800f6a4720e0c739bd608e5`), but runtime behavior is **not yet tested end to end**. The executable extension (JSON/RPC headless modes, recursive-subagent dispatch) is deferred and is not part of this package.

## Prerequisites

- **Prime Agent** installed (see Prime's [getting started](https://github.com/PrimeIntellect-ai/prime-agent)).
- Node.js and pnpm (to regenerate files from the canonical core directives, or to install the package).

## Install

Prime Agent loads skills from project/global skill directories, package `skills/` directories or `pi.skills` entries, and the `skills` array in settings. Any of these paths can point at this package's `skills/` directory.

### Option A: npm package (documented package discovery)

```bash
pnpm add @maestria/prime-agent
```

The package ships a `skills/` directory and a `pi.skills` entry in `package.json`, which are the Prime-documented package discovery mechanisms. If Prime does not auto-discover the installed package (package scanning is not yet verified end to end), use Option B to add the path explicitly.

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

Or, for this package only:

```bash
cd packages/prime-agent && pnpm sync
```

## Uninstall / removal

Remove the settings entry, symlink, or installed package. No installation steps were performed, so removal is simply dropping the path that points Prime at `skills/`.
