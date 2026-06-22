# maestria

> AI engineering praxis, encoded as plugins.

Plugins that bring disciplined AI engineering workflows — precise rules, explicit boundaries,
and clear delegation chains — to AI coding assistants. Each plugin ships specialized agents or
skills tailored to its platform's plugin model.

## Packages

- [`@maestria/opencode`](packages/opencode) — [README](packages/opencode/README.md)
- [`@maestria/kimi-code`](packages/kimi-code) — [README](packages/kimi-code/README.md)

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
