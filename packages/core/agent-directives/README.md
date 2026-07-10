# Agent Directives

Canonical source of truth for agent directives across all plugins.

## Purpose

This directory holds the shared methodology, rules, and skill prescriptions that define how pipeline agents operate. Every plugin-specific agent file (`@adventurer`, `@architect`, etc.) is derived from these canonical sources.

**Do not edit plugin-specific agent files directly.** Edit here, then run the sync tool to propagate changes to all plugins.

## Directory Structure

```
agent-directives/
  README.md          - This file
  specialists/       - Role definitions for the 7 pipeline agents
    adventurer.md    - Codebase reconnaissance
    architect.md     - Architecture decisions and ADRs
    builder.md       - Focused implementation
    diagnose.md      - Systematic bug tracing
    planner.md       - Implementation plans
    reviewer.md      - Code review with quality gates
    writer.md        - Documentation writing
  rules.md           - Shared rules used across all agents
```

## How to Add a New Specialist

1. Create a new file in `specialists/<name>.md`
2. Follow the same structure: role description, methodology sections, iteration limits, handoff format, skill prescription, related agents, and rules
3. Add the specialist to the delegation table in the orchestrator prompt
4. Register the agent in each plugin's agent loader
5. Run the sync tool to generate plugin-specific agent files
