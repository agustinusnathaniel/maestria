/**
 * Example routes for the homepage pipeline score. Each route is one task the
 * orchestrator sends through only the specialists it needs, mirroring the
 * route guidance in /core/pipeline/ and /core/when-to-use/.
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
    rationale: 'Unfamiliar code with real trade-offs: every stage earns its place.',
    steps: [
      { agent: 'orchestrator', artifact: 'Routes the task' },
      { agent: 'adventurer', artifact: 'Recon report' },
      { agent: 'architect', artifact: 'Decision + phased plan' },
      { agent: 'builder', artifact: 'Code + tests' },
      { agent: 'reviewer', artifact: 'Approved' },
    ],
    task: 'Add rate limiting to the upload API',
  },
  {
    id: 'bug',
    label: 'Bug fix',
    rationale: 'Root cause first, then the fix, then a review by someone who did not write it.',
    steps: [
      { agent: 'orchestrator', artifact: 'Routes the task' },
      { agent: 'adventurer', artifact: 'Root cause' },
      { agent: 'builder', artifact: 'Fix + regression test' },
      { agent: 'reviewer', artifact: 'Approved' },
    ],
    task: 'Uploads over 10 MB fail without an error',
  },
  {
    id: 'docs',
    label: 'Docs change',
    rationale:
      'The builder works from the source of truth; the reviewer checks it against the code.',
    steps: [
      { agent: 'orchestrator', artifact: 'Routes the task' },
      { agent: 'builder', artifact: 'Updated guide' },
      { agent: 'reviewer', artifact: 'Approved' },
    ],
    task: 'Document the new retry option',
  },
  {
    id: 'small',
    label: 'Small edit',
    rationale: 'Known, low-risk work: the orchestrator does it directly. No handoffs needed.',
    steps: [{ agent: 'orchestrator', artifact: 'Done directly' }],
    task: 'Fix a typo in the README',
  },
];

/**
 * Lane order on the score, grouped by pipeline stage. The orchestrator sits
 * above the three stages it routes between.
 */
export const lanes: { stage: string; agents: string[] }[] = [
  { agents: ['orchestrator'], stage: 'Routing' },
  { agents: ['adventurer', 'architect'], stage: 'Thinkers' },
  { agents: ['builder'], stage: 'Workers' },
  { agents: ['reviewer'], stage: 'Verifier' },
];
