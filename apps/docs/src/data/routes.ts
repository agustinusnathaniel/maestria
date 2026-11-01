/**
 * Example routes for the homepage score. Each lane is one step of the method;
 * a route plays only the steps its task needs, so idle lanes show what the
 * main loop skipped. Mirrors /core/pipeline/ and the main-loop routing rules
 * in packages/core/agent-directives/specialists/main-loop.md.
 *
 * A lane with `skill` names a method skill in
 * packages/core/agent-directives/skills/; tests/homepage-data.test.ts checks
 * it. Steps play in order, one column per step.
 */

export interface Lane {
  id: string;
  /** Row label. */
  name: string;
  /** Key into src/data/marks.ts. */
  mark: string;
  /** Canonical method skill this lane loads, when it is one. */
  skill?: string;
}

export interface RouteStep {
  lane: string;
  /** What the step produced, shown on the score. */
  artifact: string;
}

export interface Route {
  id: string;
  /** Tab label. */
  label: string;
  /** Mode keyword typed before the task, if any (see /core/how-it-works/). */
  mode?: string;
  /** The example task shown above the score. */
  task: string;
  /** One-line rationale for why this route has these steps. */
  rationale: string;
  steps: RouteStep[];
}

export const laneGroups: { stage: string; lanes: Lane[] }[] = [
  {
    lanes: [
      { id: 'recon', mark: 'recon', name: 'recon', skill: 'recon' },
      { id: 'diagnose', mark: 'diagnose', name: 'diagnose', skill: 'diagnose' },
      {
        id: 'architecture-plan',
        mark: 'architecturePlan',
        name: 'architecture-plan',
        skill: 'architecture-plan',
      },
    ],
    stage: 'Understand',
  },
  {
    lanes: [
      { id: 'implement', mark: 'implement', name: 'Implement' },
      { id: 'docs-update', mark: 'docsUpdate', name: 'docs-update', skill: 'docs-update' },
      { id: 'verify', mark: 'verify', name: 'Verify' },
    ],
    stage: 'Make',
  },
  {
    lanes: [
      { id: 'reviewer', mark: 'reviewer', name: 'Reviewer' },
      {
        id: 'create-pull-request',
        mark: 'pullRequest',
        name: 'create-pull-request',
        skill: 'create-pull-request',
      },
    ],
    stage: 'Check and deliver',
  },
];

export const routes: Route[] = [
  {
    id: 'feature',
    label: 'New feature',
    mode: 'fein',
    rationale:
      'The fein keyword asks for the full method: map the code, settle the design, build and document it, then a review by someone who did not write it.',
    steps: [
      { artifact: 'Upload path mapped', lane: 'recon' },
      { artifact: 'Per-key token bucket', lane: 'architecture-plan' },
      { artifact: 'Middleware + tests', lane: 'implement' },
      { artifact: 'API limits documented', lane: 'docs-update' },
      { artifact: 'Checks pass', lane: 'verify' },
      { artifact: 'Approved', lane: 'reviewer' },
      { artifact: 'PR opened', lane: 'create-pull-request' },
    ],
    task: 'Add rate limiting to the upload API',
  },
  {
    id: 'bug',
    label: 'Bug fix',
    rationale:
      'No mode needed. The cause is unknown, so diagnose finds it before any fix; the design is not in question, so no plan.',
    steps: [
      { artifact: 'Proxy body limit', lane: 'diagnose' },
      { artifact: 'Fix + regression test', lane: 'implement' },
      { artifact: 'Repro now passes', lane: 'verify' },
      { artifact: 'Approved', lane: 'reviewer' },
      { artifact: 'PR opened', lane: 'create-pull-request' },
    ],
    task: 'Uploads over 10 MB fail without an error',
  },
  {
    id: 'research',
    label: 'Research',
    mode: 'sonar',
    rationale:
      'The sonar keyword is research only: it maps the code, weighs the options, and stops at a recommendation without changing a file.',
    steps: [
      { artifact: 'Current flow mapped', lane: 'recon' },
      { artifact: 'Options + recommendation', lane: 'architecture-plan' },
    ],
    task: 'Should uploads move to presigned URLs?',
  },
  {
    id: 'small',
    label: 'Small edit',
    mode: 'blitz',
    rationale:
      'The blitz keyword skips optional ceremony for familiar, low-risk work. Safety, authorization, and required review still apply.',
    steps: [
      { artifact: 'Typo fixed', lane: 'implement' },
      { artifact: 'Page renders', lane: 'verify' },
    ],
    task: 'Fix a typo in the README',
  },
];
