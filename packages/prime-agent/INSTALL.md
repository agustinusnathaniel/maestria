# Installing @maestria/prime-agent

> Status: `Native candidate` - Skills-first delivery plus a verified executable extension subset. The generated skills match the documented Prime Agent Agent Skills contract and the extension (`dist/extension.mjs`) is verified against the pinned Prime fork's public extension API (verified 2026-08-13 against upstream commit `7787f07415d843b9a800f6a4720e0c739bd608e5`), but runtime behavior is **not yet tested end to end** in a live Prime session. Native recursive-subagent (`rlm`) dispatch and JSON/RPC headless-mode integration are deferred and are not part of this package.

## Prerequisites

- **Prime Agent** installed (see Prime's [getting started](https://github.com/PrimeIntellect-ai/prime-agent)).
- Node.js and pnpm only if contributing to this repository (to regenerate files from the canonical core directives). Prime installs registered packages itself via npm; pnpm is not required to consume this package.

## What gets installed

When Prime loads this package it discovers two resource types from the `pi` manifest key in `package.json`:

- **Skills** (`pi.skills: ["./skills"]`): the 14 Agent Skills (`skills/<name>/SKILL.md`).
- **Extension** (`pi.extensions: ["./dist/extension.mjs"]`): a compiled Prime/Pi extension that registers the workflow-mode slash commands (`/fein`, `/sonar`, `/blitz`, `/mode-clear`, `/maestria-status`) and injects the active mode's prompt on every agent turn. It covers only this verified subset - there is no recursive-subagent (`rlm`) dispatch and no JSON/RPC headless mode.

The extension has **no runtime dependencies**: it consumes the Prime/Pi extension API exclusively through the `pi` object Prime passes to the extension factory, with type-only local declarations (`src/pi-api.ts` mirroring the pinned fork). Prime bundles the pi packages into its runtime (see Prime's `docs/packages.md`), so nothing extra is installed.

## Install

Prime Agent loads skills from project/global skill directories, package `skills/` directories or `pi.skills` entries, and the `skills` array in settings. It does **not** auto-discover arbitrary installed npm packages from `node_modules`. To make Prime load this package's skills **and extension**, register the package with Prime (Option A) or point Prime at the package's `skills/` directory explicitly (Options B and C - extension requires Option A or a manual `extensions` setting entry, see below).

### Option A: register the package with Prime (preferred, required for the extension)

Register the published package with Prime's package mechanism. This records the package in Prime's settings and installs it via npm:

```bash
prime-agent package install npm:@maestria/prime-agent
```

- By default the package is recorded in global settings (`~/.prime/agent/settings.json`); add `--local` to record it in project settings (`.prime/agent/settings.json`), which Prime installs automatically at startup.
- Prime then reads the package's `pi.extensions` and `pi.skills` manifest entries to discover the extension and the skills. Option A is the only documented install path that enables the extension automatically.
- `prime-agent package install` also accepts git sources and local paths (for example a maestria checkout), so you can consume this package before it is published. See Prime's [packages documentation](https://github.com/PrimeIntellect-ai/prime-agent/blob/7787f07415d843b9a800f6a4720e0c739bd608e5/packages/coding-agent/docs/packages.md) for the full source syntax.

### Option B: explicit `skills` entry in settings (skills only)

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

### Option C: copy or symlink into a skill directory (skills only)

Copy or symlink the skill directories into a project or global skill location, for example:

```bash
ln -s /path/to/maestria/packages/prime-agent/skills/* ~/.prime/agent/skills/
```

### Enabling the extension manually (Option B/C users)

If you installed via Option B or C and want the extension too, point the `extensions` setting at the compiled file:

```json
{
  "extensions": ["/path/to/node_modules/@maestria/prime-agent/dist/extension.mjs"],
  "skills": ["/path/to/node_modules/@maestria/prime-agent/skills"]
}
```

(Equivalent to what Option A's package registration configures automatically; the settings `extensions` array is Prime's documented per-user extension list.)

### Dependency installs are setup only

`pnpm add @maestria/prime-agent` (or `npm install`) makes the package available to your own tooling, but Prime does not scan `node_modules`; a dependency install alone does not make Prime discover the package. Use Option A to register the package, or Option B/C to point Prime at its `skills/` directory.

## Verification

1. Start Prime Agent from the repository or project you want it to work in.
2. Run `/reload` to rediscover new or edited skill metadata and extension registration.
3. Confirm the skills appear (for example, run `/skill:orchestrator` or ask the agent to load the `global-rules` skill).
4. Confirm the extension loaded: run `/maestria-status` - it should report the current mode (`none` initially) and the verified/deferred subset. Try `/fein`, `/sonar`, `/blitz` and `/mode-clear`; while a mode is active, the mode prompt is appended to the system prompt on each agent turn, and `/maestria-status` shows the active mode.

> Steps 3-4 are runtime checks that are **not yet verified** in this batch; the package-level gates are `pnpm build` (the extension compiles to the declared `dist/extension.mjs`), `pnpm validate` (frontmatter/layout), and `pnpm test` (generated-skill, extension, and package-manifest tests).

## Security

Prime Agent is **not a sandbox**: it executes model-generated Python and project commands with your user permissions. Review skill and extension content before use and restrict usage to trusted repositories, skills, and instructions. The extension performs **no tool interception** and writes no files (no `~/.pi`, no `.prime/agent` writes); mode state rides on host session entries. It does not provide and does not claim recursive-subagent (`rlm`) dispatch or JSON/RPC headless mode.

## Updating generated content

Do not edit `skills/` by hand - it is generated from `packages/core/agent-directives/`. After changing canonical content:

```bash
scripts/sync-all          # regenerate all platform packages
scripts/check-sync        # verify everything is in sync
```

The root pipeline auto-discovers this package via its `sync.config.ts`; there is no package-local `sync` script.

## Uninstall / removal

Remove the registration, settings entry, symlink, or installed package. If you used Option A, unregister it with `prime-agent package remove npm:@maestria/prime-agent`; otherwise removal is simply dropping the settings `skills`/`extensions` entries or symlink that points Prime at the package.
