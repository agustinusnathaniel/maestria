# maestria

> AI engineering praxis, encoded as plugins.

Plugins that bring disciplined AI engineering workflows to your coding agent.

📖 **Full documentation:** [maestria.sznm.dev](https://maestria.sznm.dev)

## Project Structure

```
maestria/
├── apps/
│   └── docs/            - Documentation site (Astro + Starlight)
├── docs/
│   ├── adr/             - Architecture Decision Records
│   │   ├── core/        - Cross-cutting decisions (ADR-CORE-*)
│   │   ├── opencode/    - @maestria/opencode decisions (ADR-OC-*)
│   │   ├── kimi-code/   - @maestria/kimi-code decisions (ADR-KC-*)
│   │   └── pi/          - @maestria/pi decisions (ADR-PI-*)
│   └── guides/          - Development guides and conventions
├── packages/
│   ├── opencode/        - @maestria/opencode plugin
│   ├── kimi-code/       - @maestria/kimi-code plugin
│   └── pi/              - @maestria/pi plugin
├── VISION.md            - Project vision and principles
├── PATTERNS.md          - Reusable workflow patterns
└── README.md            - This file
```

## Vision

See [VISION.md](VISION.md) for the project's guiding philosophy and long-term goals.

## Packages

| Package | Description | README |
| --- | --- | --- |
| [@maestria/opencode](packages/opencode/) | Maestria methodology plugin for OpenCode | [README](packages/opencode/README.md) |
| [@maestria/kimi-code](packages/kimi-code/) | Maestria methodology plugin for Kimi Code | [README](packages/kimi-code/README.md) |
| [@maestria/hermes](packages/hermes/) | Maestria methodology plugin for Hermes | [README](packages/hermes/README.md) |
| [@maestria/pi](packages/pi/) | Maestria methodology plugin for Pi | [README](packages/pi/README.md) |

## Development

This monorepo uses [Vite+](https://viteplus.dev) as its unified toolchain.

```bash
# Install dependencies
vp install

# Format, lint, and type-check
vp check

# Run tests
vp run test

# Build all packages
vp run build

# Run the docs site locally
vp run dev
```

## Release

This project uses [Changesets](https://github.com/changesets/changesets) for versioning and publishing.

```bash
pnpm changeset        # Create a changeset
pnpm version-packages # Apply changesets and bump versions
pnpm release          # Publish to npm
```

## Uninstalling

For per-package uninstall instructions, see:

- [@maestria/opencode uninstall](apps/docs/src/content/docs/opencode/getting-started/installation.mdx)
- [@maestria/kimi-code uninstall](apps/docs/src/content/docs/kimi-code/getting-started/installation.mdx)
- [@maestria/pi uninstall](apps/docs/src/content/docs/pi/getting-started/installation.mdx)
