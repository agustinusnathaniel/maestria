## OMP Integration

OMP discovers four root task profiles, three root commands, one always-apply root rule, and six skills (the `handoff` and `iteration-limits` utilities and the bundled `create-pull-request`, `diagnose`, `docs-update`, and `plan` methodology skills). The empty `package.json#omp` registers this data-only package. The complete router and global policy in `rules/global.md` guide the main session through the host's native rule discovery.

Dispatch specialists using OMP's native `task(agent, task)` tool with the root names `adventurer`, `architect`, `builder`, and `reviewer`. Each embeds complete role and global policy, so utility skill loading in the parent is not a child-context dependency. Root modes are native `/fein`, `/sonar`, and `/blitz` commands with full context.

No executable extension, lifecycle hook, persistent mode mechanism, review interception, goal wrapper, or MCP server ships here. OMP owns runtime tools and enforcement. Remove the retired `@maestria/omp` package before installing this replacement so old executable hooks do not shadow native resources.

See [OMP plugins](https://omp.sh/docs/plugins).
