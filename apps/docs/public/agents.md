# maestria agent instructions

maestria provides installable plugins for structured AI engineering work. The main loop investigates, designs, implements, and delivers each outcome itself, loading method skills when a task needs them, and sends meaningful changes to one independent reviewer. Permissions depend on the platform.

## When to use maestria

Use maestria when you need to:

- Install or wire structured agent-methodology plugins into a supported coding platform: OpenCode, Pi, Claude Code, Codex CLI, Cursor, Kimi Code, Devin, ZCode, OMP, or Hermes.
- Install the seven portable skills (handoff, iteration-limits, create-pull-request, docs-update, diagnose, recon, architecture-plan) when your client supports Agent Plugins v1. Full methodology requires the selected host integration: https://maestria.sznm.dev/agent-plugins/
- Install on Claude Code, Codex, Cursor, Kimi Code, Devin, ZCode, OMP, or Hermes (one section per host): https://maestria.sznm.dev/agent-plugins/installation/
- Run workflow modes and request independent review on each host: https://maestria.sznm.dev/agent-plugins/usage/
- Check live smoke results and client-specific activation steps: https://maestria.sznm.dev/agent-plugins/compatibility/
- Decide how to work: directly in the main loop, with method skills for recon, design, or diagnosis, and independent review for meaningful changes.
- Enforce maker/checker review: the implementer never approves its own work; an independent reviewer signs off.

## How to call maestria

Install into a supported coding platform:

```sh
npx maestria install <platform>
```

For example: `npx maestria install opencode`.

How to consume these docs:

Header-based Markdown negotiation (`Accept: text/markdown`) is available on Cloudflare Pages. On other static hosts, fetch the `.md` twin directly.

- Complete documentation: https://maestria.sznm.dev/llms-full.txt
- Condensed index: https://maestria.sznm.dev/llms-small.txt
- Per-page markdown twins at `<page>.md`, e.g. https://maestria.sznm.dev/core/when-to-use.md.
- Sitemap: https://maestria.sznm.dev/sitemap-index.xml
- Robots policy: https://maestria.sznm.dev/robots.txt
- Documentation site: https://maestria.sznm.dev/
- npm package: https://www.npmjs.com/package/maestria
- Source repository: https://github.com/agustinusnathaniel/maestria
- Issue tracker: https://github.com/agustinusnathaniel/maestria/issues
