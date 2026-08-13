---
---

Release tooling: the plugin version sync script is rewritten from Python to TypeScript (scripts/sync-plugin-versions.ts, run via pnpm exec tsx) with an equivalent contract - after 'changeset version', package.json versions propagate into the manifests shipped with each plugin (plugin.json, plugin.yaml, _version.py), and '--check' still fails the build on drift. The Python implementation and its test are replaced by a Vitest suite, and vitest is now a root devDependency so the sync tests run in clean CI. No published runtime API changes.
