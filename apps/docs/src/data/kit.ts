/**
 * The homepage "What you get" grid: what every maestria install gives the main
 * loop. Modes and skills mirror packages/core/agent-directives/commands/ and
 * skills/; tests/homepage-data.test.ts keeps the names in sync.
 */

export interface KitItem {
  term: string;
  detail: string;
  /** Render the term in monospace (a keyword or skill name). */
  code?: boolean;
}

export interface KitPart {
  id: string;
  title: string;
  lead: string;
  /** Key into src/data/marks.ts. */
  mark: string;
  items: KitItem[];
}

export const kit: KitPart[] = [
  {
    id: 'modes',
    items: [
      { code: true, detail: 'Full method with required review', term: 'fein' },
      { code: true, detail: 'Research only, changes no files', term: 'sonar' },
      { code: true, detail: 'Skips optional ceremony', term: 'blitz' },
    ],
    lead: 'Type one before a task to set how much method it gets. Without one, the main loop picks.',
    mark: 'pipeline',
    title: 'Three modes',
  },
  {
    id: 'skills',
    items: [
      { code: true, detail: 'Map unfamiliar code first', term: 'recon' },
      { code: true, detail: 'Find the cause before the fix', term: 'diagnose' },
      { code: true, detail: 'Weigh options, phase the work', term: 'architecture-plan' },
      { code: true, detail: 'Keep docs true to the change', term: 'docs-update' },
      { code: true, detail: 'Write a reviewable PR', term: 'create-pull-request' },
    ],
    lead: 'Loaded in the main loop only when they add information or reduce risk.',
    mark: 'recon',
    title: 'Method skills',
  },
  {
    id: 'floors',
    items: [
      { detail: 'Against code, docs, and runtime', term: 'Verify claims' },
      { detail: 'Smallest route that proves acceptance', term: 'Match effort to stakes' },
      { detail: 'Auth, data loss, production', term: 'Stop for authorization' },
      { detail: 'At most three repair passes', term: 'Bounded repair' },
    ],
    lead: 'Rules every task follows. No mode or project rule can waive them.',
    mark: 'floors',
    title: 'Always-on floors',
  },
  {
    id: 'reviewer',
    items: [
      { detail: "Goal and evidence, never the maker's verdict", term: 'Blind brief' },
      { detail: 'Fix, dismiss, or escalate', term: 'Triaged findings' },
      { detail: 'An empty or blocked review is not a pass', term: 'No silent approval' },
    ],
    lead: 'One independent check for every meaningful change. The maker never approves its own work.',
    mark: 'reviewer',
    title: 'Independent reviewer',
  },
];
