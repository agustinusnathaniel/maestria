// packages/pi/sync.config.ts
// Unified sync config: generates both pi-subagents agent files AND Pi skill files
// from canonical core directives in a single pass.
//
// - agents/*.md (7 specialists): deployed to ~/.pi/agent/agents/ for pi-subagents
// - skills/orchestrator/SKILL.md: Pi skill auto-injected into every session
// - skills/global-rules/SKILL.md: Pi skill auto-injected into every session

import { agentDirectiveSync } from '../core/scripts/lib/agent-directive-sync.js';

export default agentDirectiveSync({
  agentFamily: 'Pi',
  commandPrefix: '/',
});
