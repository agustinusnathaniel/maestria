---
"@maestria/opencode": patch
---

refactor: strip orchestrator read-side tools and add missing global directives

The orchestrator is restructured into a strict dispatcher. Its `read`, `glob`, `grep`, `lsp`, and `webfetch` permissions are removed, and the opening prompt is rewritten as a dispatcher mandate stating that `task()` and `question()` are the only tools for making progress. CRITICAL RULES are consolidated from 10 to 8 — the redundant "Shell is not a workaround" and "Prefer local tools over webfetch; webfetch may hang" directives are deleted and the rest are renumbered. The 7 specialists retain full read-side tool access for the work they pick up.

Three directives are also added to the global rules (`packages/opencode/rules/AGENTS.md`): "Webfetch may hang — don't block on it", "CLI references — use local tools first", and "Local files — read directly". Because global rules are injected into every specialist's prompt at runtime, this closes 21 directive-coverage gaps (3 directives × 7 specialists) and the guidance now applies uniformly.
