# maestria

> AI engineering praxis, encoded as an OpenCode plugin.

This monorepo contains `@maestria/opencode` — an npm plugin that bundles specialized subagents and global rules for OpenCode, transforming it into a disciplined AI engineering workstation.

## Packages

| Package                                   | Description                              |
| ----------------------------------------- | ---------------------------------------- |
| [`@maestria/opencode`](packages/opencode) | OpenCode plugin: 7 agents + global rules |

## Development

```bash
vp install          # install dependencies
vp check            # format, lint, type-check everything
vp run test           # run all tests
vp run build          # build all packages
```

## Release

```bash
pnpm changeset          # create a changeset
pnpm version-packages   # version bump
pnpm release            # publish to npm
```
