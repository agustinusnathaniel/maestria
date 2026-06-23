---
name: iteration-limits
description: The iteration-limit pattern with verifiable termination and escalation format.
  Load when defining termination conditions for a loop, or when a loop is at risk of
  running too long.
---

# Iteration Limits

When delegating work in a loop, always define:

1. **Verifiable Termination Condition** — A concrete, measurable state that stops the loop
2. **Max-N Hard Limit** — Usually 3-5 attempts before escalation
3. **Escalation Format** — Report: Tried X, Y, Z. Blocked by [cause]. Need [input] to proceed.
