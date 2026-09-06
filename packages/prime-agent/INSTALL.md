# Installing @maestria/prime-agent

> Status: `Native candidate`. Skills and the executable extension were verified against Prime's documented contracts on 2026-08-13, using upstream commit `7787f07415d843b9a800f6a4720e0c739bd608e5`. Live-session behavior is **not yet tested end to end**. Native recursive-subagent (`rlm`) dispatch and JSON/RPC headless-mode integration are deferred.

## Prerequisites

- **Prime Agent** installed (see Prime's [getting started](https://github.com/PrimeIntellect-ai/prime-agent)).
- Node.js and pnpm only if contributing to this repository (to regenerate files from the canonical core directives). Prime installs registered packages itself via npm; pnpm is not required to consume this package.

## Install

Choose a setup based on what you want to load:

| Setup | Skills | Workflow-command extension |
| --- | --- | --- |
| [Register the package](#option-a-register-the-package-with-prime-preferred) | Yes | Automatic for the published npm package |
| [Add a settings entry](#option-b-explicit-skills-entry-in-settings-skills-only) | Yes | Requires a separate `extensions` entry |
| [Copy or symlink skills](#option-c-copy-or-symlink-into-a-skill-directory-skills-only) | Yes | Requires a separate `extensions` entry |

Prime discovers skills through project/global skill directories, registered package `skills/` directories or `pi.skills` entries, and the `skills` settings array. A dependency install (`pnpm add @maestria/prime-agent` or `npm install`) alone does not activate the package: Prime does not scan arbitrary packages in `node_modules`.

### Option A: register the package with Prime (preferred)

Register the published package to load both skills and the extension:

```bash
prime-agent package install npm:@maestria/prime-agent
```

Prime installs it via npm and records it in global settings (`~/.prime/agent/settings.json`). Add `--local` to use project settings (`.prime/agent/settings.json`), which Prime installs automatically at startup.

The published package includes the compiled `dist/extension.mjs` and its sourcemap. Prime discovers both resources through the package's `pi.skills` and `pi.extensions` entries.

#### Installing from source

Git and local installs are skills-only until the package is built. Prime's git installer runs `npm install`, often without dev dependencies, but does not build the extension. Build from the repository root, then register the built package:

```bash
pnpm --filter @maestria/prime-agent build   # creates packages/prime-agent/dist/extension.mjs
prime-agent package install local:/path/to/maestria/packages/prime-agent
```

Do not install the monorepo root Git URL (`https://github.com/agustinusnathaniel/maestria.git`): its `package.json` has no `pi` manifest, so Prime discovers neither skills nor the extension. Use the npm release or a built local package directory. See Prime's [packages documentation](https://github.com/PrimeIntellect-ai/prime-agent/blob/7787f07415d843b9a800f6a4720e0c739bd608e5/packages/coding-agent/docs/packages.md) for source syntax.

### Option B: explicit `skills` entry in settings (skills only)

Add the package's skills directory to Prime's settings (`~/.prime/agent/settings.json` for your user, or `.prime/agent/settings.json` in the project):

```json
{
  "skills": ["/path/to/node_modules/@maestria/prime-agent/skills"]
}
```

The same [settings mechanism](https://github.com/PrimeIntellect-ai/prime-agent/blob/7787f07415d843b9a800f6a4720e0c739bd608e5/packages/coding-agent/docs/skills.md) works with a local clone:

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

The configured file must exist. The npm release includes it; for a checkout, [build the package first](#installing-from-source). Prime silently skips a missing extension, leaving workflow commands and mode prompt injection unavailable. The `extensions` array is Prime's per-user extension setting; package registration configures this automatically.

## Verification

1. Start Prime Agent from the repository or project you want it to work in.
2. Run `/reload` to rediscover new or edited skill metadata and extension registration.
3. Confirm the skills appear (for example, run `/skill:orchestrator` or ask the agent to load the `global-rules` skill).
4. Confirm the extension loaded: run `/maestria-status` - it should report the current mode (`none` initially) and the verified/deferred subset. Try `/fein`, `/sonar`, `/blitz` and `/mode-clear`; while a mode is active, the mode prompt is appended to the system prompt on each agent turn, and `/maestria-status` shows the active mode.

> Steps 3-4 remain **unverified in a live Prime session**. Package-level validation does not establish runtime support; see the contributor checks below.

## Security

Prime Agent is **not a sandbox**: it executes model-generated Python and project commands with your user permissions. Review skill and extension content before use and restrict usage to trusted repositories, skills, and instructions. The extension performs **no tool interception** and writes no files (no `~/.pi`, no `.prime/agent` writes); mode state is stored in host session entries.

## Package contents and contributor checks

The `pi` key in `package.json` declares:

- `pi.skills: ["./skills"]`: 14 Agent Skills at `skills/<name>/SKILL.md`.
- `pi.extensions: ["./dist/extension.mjs"]`: workflow commands (`/fein`, `/sonar`, `/blitz`, `/mode-clear`, `/maestria-status`) and active-mode prompt injection on each agent turn.

The extension has no runtime dependencies. It uses the `pi` object supplied by Prime, with local type-only declarations in `src/pi-api.ts` matching the pinned fork. Prime bundles the Pi packages into its runtime, so no extra Pi package is installed.

Run these checks from `packages/prime-agent/`:

| Command | Checks |
| --- | --- |
| `pnpm build` | Compiles the declared `dist/extension.mjs` |
| `pnpm validate` | Skill frontmatter and layout |
| `pnpm test` | Generated skills, extension, manifest, and `npm pack --dry-run` tarball contents |

### Updating generated content

Do not edit `skills/` by hand - it is generated from `packages/core/agent-directives/`. After changing canonical content, run these commands from the repository root:

```bash
scripts/sync-all          # regenerate all platform packages
scripts/check-sync        # verify everything is in sync
```

The root pipeline auto-discovers this package via its `sync.config.ts`; there is no package-local `sync` script.

## Uninstall / removal

Remove the registration, settings entry, symlink, or installed package. If you used Option A, unregister it with `prime-agent package remove npm:@maestria/prime-agent`; otherwise removal is simply dropping the settings `skills`/`extensions` entries or symlink that points Prime at the package.
