// packages/pi/sync.config.ts
// Unified sync config: generates both pi-subagents agent files AND Pi skill files
// from canonical core directives in a single pass.
//
// - agents/*.md (7 specialists): deployed to ~/.pi/agent/agents/ for pi-subagents
// - skills/orchestrator/SKILL.md: Pi skill auto-injected into every session
// - skills/global-rules/SKILL.md: Pi skill auto-injected into every session

import { agentDirectiveSync } from '../core/scripts/lib/agent-directive-sync.js';

/**
 * Builtin tool names Pi registers, from `allToolNames` in the host's
 * `dist/core/tools/index.js`. Names outside this set pass the host frontmatter
 * parser unvalidated and become inert filter entries, so they are dropped from
 * the generated lists instead. The 1.0 line adds `powershell` to this set; it
 * stays listed so a future declaration of it is not silently dropped, and no
 * specialist declares it today.
 */
const PI_BUILTIN_TOOLS = ['read', 'bash', 'powershell', 'edit', 'write', 'grep', 'find', 'ls'];

export default agentDirectiveSync({
  agentFamily: 'Pi',
  commandPrefix: '/',
  hostTools: PI_BUILTIN_TOOLS,
});
