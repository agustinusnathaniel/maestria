---
"@maestria/core": minor
"@maestria/opencode": minor
"@maestria/kimi-code": minor
"@maestria/pi": minor
---

Add multi-lens review swarm, observation-first principle, and triage pipeline

Three review methodology patterns adopted from PostHog's code review research:

- **Multi-lens review swarm** - orchestrator can dispatch parallel reviewers with different focus areas (Security, Architecture, Performance, UX, General) for non-trivial changes, with exclusive lenses and cross-referenced etiquette rules
- **Observation over reasoning** - reviewer principle shifted from "verify without running" to "what command produces visible proof?", prioritizing observable behavior over logical argument
- **Review triage pipeline** - issues categorized [fix]/[dismiss]/[escalate] by reviewer, then validated by orchestrator with conflict resolution (conservative wins); iteration terminates when no actionable threads remain

Rule #9 (single @reviewer after @builder) remains the default; multi-lens is an enhancement for changes touching multiple concerns.
