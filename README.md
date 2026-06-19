# maestria

> AI engineering praxis, encoded as plugins for OpenCode and Kimi Code.

This monorepo contains `@maestria/opencode` and `@maestria/kimi-code` — plugins that bring disciplined AI engineering workflows to OpenCode and Kimi Code.

## Packages

| Package                                     | Description                                                                                                                                                 |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@maestria/opencode`](packages/opencode)   | OpenCode plugin: 7 agents + global rules                                                                                                                    |
| [`@maestria/kimi-code`](packages/kimi-code) | Kimi Code plugin: 8 skills + swarm-aware orchestrator. Install via `/plugins install https://github.com/agustinusnathaniel/maestria/tree/release/kimi-code` |

> **Note:** `@maestria/opencode` is installed via npm (opencode.jsonc plugins).  
> `@maestria/kimi-code` is installed via Kimi Code's `/plugins install` command — no npm needed.

## Development

```bash
vp install          # install dependencies
vp check            # format, lint, type-check everything
vp run -r test      # run all tests
vp run -r build     # build all packages
```

## Release

```bash
pnpm changeset          # create a changeset
pnpm version-packages   # version bump
pnpm release            # publish to npm
```
