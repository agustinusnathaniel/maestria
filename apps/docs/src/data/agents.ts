/**
 * WARNING: This data is manually maintained.
 * Source of truth: packages/core/agent-directives/specialists/*.md
 * Update this file when specialist definitions change.
 */

export interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  scope: string;
  artifact: string;
  constraint: string;
  icon: string;
}

export const agents: Agent[] = [
  {
    artifact: 'Outcome delivery, review brief',
    constraint: 'Dispatches only reviewer',
    description:
      'The main loop investigates, designs, implements, and delivers each outcome itself: it loads the recon, architecture-plan, and diagnose skills when the task needs them, verifies the result, and sends meaningful changes to one independent reviewer before delivery.',
    icon: '🎯',
    id: 'maestria',
    name: 'Main loop',
    role: 'Investigates, designs, implements, delivers',
    scope: 'Every task, end to end',
  },
  {
    artifact: 'Review verdict',
    constraint: 'Sees work fresh - independent',
    description:
      'Runs one general review for quality, correctness, security, and maintainability, adding specialist lenses only for matching security, performance, architecture, or UX risk. Preserves blind review, lens exclusivity, observation over reasoning, and [fix]/[dismiss]/[escalate] triage. Enforces the maker/checker split.',
    icon: '✅',
    id: 'reviewer',
    name: 'Reviewer',
    role: 'Code review with quality gates',
    scope: 'Pre-merge quality gates',
  },
];
