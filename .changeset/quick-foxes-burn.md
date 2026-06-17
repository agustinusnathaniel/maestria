---
"@maestria/kimi-code": minor
---

Add a release pipeline for the kimi-code plugin: pushing a `@maestria/kimi-code-v<version>` tag now triggers a GitHub Action that uses `git subtree split` to hoist `packages/kimi-code/*` into a `release/kimi-code` branch where the manifest sits at the root. The install path in INSTALL.md and the docs site is updated to use the branch URL, giving users auto-update on re-install. See [ADR-008](docs/adr/ADR-008-kimi-code-distribution.md) for the rationale.
