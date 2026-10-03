// packages/omp/sync.config.ts
// Unified sync config: generates both omp agent files AND omp skill files
// from canonical core directives in a single pass.
//
// - agents/*.md (7 specialists): deployed for omp subagent dispatch
// - skills/orchestrator/SKILL.md: omp orchestrator skill
// - skills/global-rules/SKILL.md: omp global-rules skill
//
// OMP is a Pi fork on an independent version line: never derive its peer range from Pi.

import { agentDirectiveSync } from '../core/scripts/lib/agent-directive-sync.js';

// omp has a built-in task tool, so task( stays as task( - no rewrite needed
export default agentDirectiveSync({
  agentFamily: 'Oh My Pi',
  commandPrefix: '',
});
