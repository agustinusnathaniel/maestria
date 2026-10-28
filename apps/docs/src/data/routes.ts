/**
 * Example routes for the homepage pipeline score. Each route is work the main
 * loop does itself, plus reviewer when an independent check is needed,
 * mirroring the route guidance in /core/pipeline/ and /core/when-to-use/.
 *
 * `agent` keys into src/data/agents.ts; `artifact` is what that step hands
 * forward. Steps play in order, one column per step.
 */

export interface RouteStep {
  agent: string;
  artifact: string;
}

export interface Route {
  id: string;
  /** Tab label. */
  label: string;
  /** The example task shown above the score. */
  task: string;
  /** One-line rationale for why this route has these stages. */
  rationale: string;
  steps: RouteStep[];
}

export const routes: Route[] = [
  {
    id: 'feature',
    label: 'New feature',
    rationale:
      'Unfamiliar code with real trade-offs: method skills earn their place, then an independent check.',
    steps: [
      { agent: 'orchestrator', artifact: 'Investigate, plan, implement' },
      { agent: 'reviewer', artifact: 'Approved' },
    ],
    task: 'Add rate limiting to the upload API',
  },
  {
    id: 'bug',
    label: 'Bug fix',
    rationale:
      'Root cause first with diagnose, then the fix, then a review by someone who did not write it.',
    steps: [
      { agent: 'orchestrator', artifact: 'Root cause + fix' },
      { agent: 'reviewer', artifact: 'Approved' },
    ],
    task: 'Uploads over 10 MB fail without an error',
  },
  {
    id: 'docs',
    label: 'Docs change',
    rationale:
      'The main loop works from the source of truth; the reviewer checks it against the code.',
    steps: [
      { agent: 'orchestrator', artifact: 'Updated guide' },
      { agent: 'reviewer', artifact: 'Approved' },
    ],
    task: 'Document the new retry option',
  },
  {
    id: 'small',
    label: 'Small edit',
    rationale: 'Known, low-risk work: the main loop does it directly. No review needed.',
    steps: [{ agent: 'orchestrator', artifact: 'Done directly' }],
    task: 'Fix a typo in the README',
  },
];

/**
 * Lane order on the score. The main loop sits above the reviewer that checks
 * it.
 */
export const lanes: { stage: string; agents: string[] }[] = [
  { agents: ['orchestrator'], stage: 'Main loop' },
  { agents: ['reviewer'], stage: 'Check' },
];
