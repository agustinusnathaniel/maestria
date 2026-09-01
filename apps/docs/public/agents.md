# Maestria agent instructions

Maestria is portable AI engineering praxis: installable plugins that wire a dispatcher-plus-specialist methodology (adventurer, architect, builder, diagnose, planner, reviewer, writer around a dispatch-only orchestrator) into coding agents.

## When to use Maestria

Use Maestria when you need to:

- Install or wire structured agent-methodology plugins into a supported coding platform: OpenCode, Kimi Code, Pi, Hermes, Claude Code, Codex CLI, Cursor, prime-agent, or OMP.
- Install the portable Agent Plugins v1 package when your client supports the standard `plugin.json` and `skills/` layout: https://maestria.sznm.dev/agent-plugin/
- Check live smoke results and client-specific activation steps: https://maestria.sznm.dev/agent-plugin/compatibility/
- Decide how to route a task: direct execution vs specialist dispatch vs the full staged pipeline (thinker, worker, verifier).
- Enforce maker/checker review: the builder never approves its own work; an independent reviewer signs off.

## How to call Maestria

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
