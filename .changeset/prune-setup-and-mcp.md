---
"maestria": minor
---

Remove `maestria setup`. It only checked whether codegraph, agent-browser, and opensrc were installed, ran xtarterize, and installed external skill repositories through the `skills` CLI; run those tools directly instead, for example `npx skills add agustinusnathaniel/skills -g` for the engineering skills maestria's specialists name. `maestria plugin validate` and `plugin install` no longer validate MCP configuration: maestria ships no MCP server, so a package that declares `mcp.json` is now rejected, and the JSON report's `validationScope` is `portable-manifest-skills`.
