---
'@maestria/core': minor
'@maestria/opencode': patch
'@maestria/pi': patch
'@maestria/kimi-code': patch
'@maestria/hermes': patch
'@maestria/omp': patch
---

Rule-override conditions and communication conventions for agent directives.

**When to Break the Rules** - Added 6 explicit override conditions to the
orchestrator prompt (user skip request, safety, mode override, frustration
escalation, rule conflicts, explanation requests). This prevents rule
rigidity by documenting when and how to deviate from defaults.

**Communication conventions** - Two new shared rules: report errors
matter-of-factly (state problem, cause, and fix without hedging or drama)
and lead with the action (first line actionable, context follows).

**How this affects you:** Agents now have clearer guidance on when to
flex the rules and how to communicate. Error messages are more direct.
Responses lead with something actionable rather than preamble. No action
required on your end - your agents handle the new conventions automatically.
