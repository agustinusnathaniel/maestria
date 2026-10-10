# maestria

> Structured AI engineering workflows for your coding agent.

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->

[![All Contributors](https://img.shields.io/badge/all_contributors-2-orange.svg?style=flat-square)](#contributors-)

<!-- ALL-CONTRIBUTORS-BADGE:END -->

Plugins that bring disciplined AI engineering workflows to your coding agent.

📖 **Full documentation:** [maestria.sznm.dev](https://maestria.sznm.dev)

## Start Here

- **Use maestria:** choose your coding agent in the package table below, then follow its installation guide.
- **Choose a workflow:** read [when to use maestria](https://maestria.sznm.dev/core/when-to-use/).
- **Contribute:** start with [CONTRIBUTING.md](CONTRIBUTING.md) and the [engineering documentation index](docs/README.md).
- **Understand the design:** read the [vision](VISION.md) and [workflow patterns](PATTERNS.md).

## Packages

| Package | Description | README |
| --- | --- | --- |
| [@maestria/opencode](packages/opencode/) | maestria methodology plugin for OpenCode | [README](packages/opencode/README.md) |
| [@maestria/agent-plugins](packages/agent-plugins/) | Shared plugin for Codex, Claude Code, Cursor, Kimi Code, Devin, ZCode, Hermes, OMP, and Agent Plugins clients | [README](packages/agent-plugins/README.md) |
| [@maestria/pi](packages/pi/) | maestria methodology plugin for Pi | [README](packages/pi/README.md) |

Canonical agent directives and the sync pipeline live in the private `@maestria/core` package (`packages/core/agent-directives/`); `packages/shared/*` holds private host-neutral utilities. Neither is published to npm.

## Project Structure

```
maestria/
├── apps/
│   ├── docs/            - Documentation site (Astro + Starlight)
│   └── maestria-cli/    - CLI for managing maestria plugins
├── docs/
│   ├── adr/             - Architecture Decision Records
│   │   ├── core/        - Cross-cutting decisions (ADR-CORE-*)
│   │   ├── opencode/    - @maestria/opencode decisions (ADR-OC-*)
│   │   ├── cursor/      - Cursor host boundaries (ADR-CR-*)
│   │   ├── kimi-code/   - Kimi host boundaries (ADR-KC-*)
│   │   └── pi/          - @maestria/pi decisions (ADR-PI-*)
│   ├── guides/          - Development guides and conventions
│   └── plans/           - Historical implementation plans
├── packages/
│   ├── core/            - Canonical agent directives + sync pipeline (private)
│   ├── agent-plugins/   - Shared declarative plugin and native host resources
│   ├── opencode/        - @maestria/opencode plugin
│   ├── pi/              - @maestria/pi plugin
│   └── shared/
│       ├── mode/        - Shared neutral mode mechanics (private, pure-TS, no host SDK)
│       └── pi/          - Shared pure-TS utilities for pi (private)
├── scripts/             - Sync and CI verification scripts
├── VISION.md            - Project vision and principles
├── PATTERNS.md          - Reusable workflow patterns
└── README.md            - This file
```

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

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://agustinusnathaniel.com/"><img src="https://avatars.githubusercontent.com/u/17046154?v=4?s=100" width="100px;" alt="Agustinus Nathaniel"/><br /><sub><b>Agustinus Nathaniel</b></sub></a><br /><a href="https://github.com/agustinusnathaniel/maestria/commits?author=agustinusnathaniel" title="Code">💻</a> <a href="https://github.com/agustinusnathaniel/maestria/commits?author=agustinusnathaniel" title="Documentation">📖</a> <a href="#design-agustinusnathaniel" title="Design">🎨</a> <a href="#infra-agustinusnathaniel" title="Infrastructure (Hosting, Build-Tools, etc)">🚇</a> <a href="#ideas-agustinusnathaniel" title="Ideas, Planning, & Feedback">🤔</a> <a href="https://github.com/agustinusnathaniel/maestria/commits?author=agustinusnathaniel" title="Tests">⚠️</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://links.iyansr.id"><img src="https://avatars.githubusercontent.com/u/42711013?v=4?s=100" width="100px;" alt="I Putu Saputrayana"/><br /><sub><b>I Putu Saputrayana</b></sub></a><br /><a href="https://github.com/agustinusnathaniel/maestria/commits?author=iyansr" title="Code">💻</a> <a href="https://github.com/agustinusnathaniel/maestria/commits?author=iyansr" title="Documentation">📖</a></td>
    </tr>
  </tbody>
  <tfoot>
    <tr>
      <td align="center" size="13px" colspan="7">
        <img src="https://raw.githubusercontent.com/all-contributors/all-contributors-cli/1b8533af435da9854653492b1327a23a4dbd0a10/assets/logo-small.svg">
          <a href="https://all-contributors.js.org/docs/en/bot/usage">Add your contributions</a>
        </img>
      </td>
    </tr>
  </tfoot>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!

## Uninstalling

For per-package uninstall instructions, see:

- [@maestria/opencode uninstall](apps/docs/src/content/docs/opencode/getting-started/installation.mdx)
- [@maestria/agent-plugins uninstall](apps/docs/src/content/docs/agent-plugins/kimi-code/getting-started/installation.mdx)
- [@maestria/pi uninstall](apps/docs/src/content/docs/pi/getting-started/installation.mdx)
- [Oh My Pi via Agent Plugins uninstall](apps/docs/src/content/docs/agent-plugins/omp/getting-started/installation.mdx)
- [@maestria/agent-plugins uninstall](apps/docs/src/content/docs/agent-plugins/cursor/getting-started/installation.mdx)
- [@maestria/agent-plugins uninstall](apps/docs/src/content/docs/agent-plugins/claude-code/getting-started/installation.mdx)
- [@maestria/agent-plugins uninstall](apps/docs/src/content/docs/agent-plugins/codex/getting-started/installation.mdx)
- [Hermes plugin uninstall](apps/docs/src/content/docs/agent-plugins/hermes/getting-started/installation.mdx)
