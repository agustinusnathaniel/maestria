## OMP Integration

OMP 18.4.8 discovers eight root task profiles, three root commands, one always-apply root rule, and two portable utility skills. The empty `package.json#omp` registers this data-only package. Root `agents/orchestrator.md` is a task dispatcher profile; it does not replace the main agent. The complete router and global policy in `rules/global.md` guide the main session through the host's native rule discovery.

Dispatch specialists using OMP's native `task(agent, task)` tool with the root names `adventurer`, `architect`, `builder`, `diagnose`, `planner`, `reviewer`, and `writer`. Each embeds complete role and global policy, so utility skill loading in the parent is not a child-context dependency. Root modes are native `/fein`, `/sonar`, and `/blitz` commands with full context.

No executable extension, lifecycle hook, persistent mode mechanism, review interception, goal wrapper, or MCP server ships here. OMP owns runtime tools and enforcement. Remove the retired `@maestria/omp` package before installing this replacement so old executable hooks do not shadow native resources.

See [OMP plugins](https://omp.sh/docs/plugins).
