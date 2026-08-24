/**
 * Shared inline SVG marks, 24x24 stroke glyphs rendered locally. Decorative
 * (always rendered with aria-hidden), no assets or dependencies, no emoji.
 *
 * Keys cover specialist roles, principles, and platform adapters. Components
 * render them via `<svg {...markAttrs} set:html={marks[key]} />`.
 */

export const markAttrs = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 1.7,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  'aria-hidden': 'true',
} as const;

export const marks: Record<string, string> = {
  // Specialist role marks.
  orchestrator:
    '<circle cx="12" cy="12" r="8.25"/><circle cx="12" cy="12" r="3.25"/><circle cx="12" cy="12" r="0.75" fill="currentColor"/>',
  adventurer: '<polyline points="4 18 9 18 9 11 15 11 15 6 20 6"/>',
  architect:
    '<rect x="4.5" y="4.5" width="15" height="15"/><rect x="9.5" y="9.5" width="5" height="5"/>',
  builder: '<path d="M10 5.5 4.5 12 10 18.5"/><path d="M14 5.5 19.5 12 14 18.5"/>',
  diagnose: '<circle cx="10.5" cy="10.5" r="6"/><line x1="15" y1="15" x2="20.5" y2="20.5"/>',
  planner:
    '<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="13" y2="18"/>',
  reviewer:
    '<rect x="4.5" y="4.5" width="15" height="15"/><polyline points="8.25 12.25 11.25 15.25 16 9"/>',
  writer:
    '<path d="M12 4.5 18.75 18.75 12 16 5.25 18.75 Z"/><line x1="12" y1="4.5" x2="12" y2="16"/>',
  // Principle marks.
  pipeline:
    '<polyline points="4 6 8 6 8 12 12 12 12 18 16 18"/><polyline points="13.5 16.75 16 18 13.5 19.25"/>',
  makerChecker:
    '<rect x="3.5" y="7" width="4.5" height="4.5"/><rect x="16" y="7" width="4.5" height="4.5"/><line x1="9.5" y1="9.25" x2="14.5" y2="9.25"/><polyline points="12.5 7.25 14.5 9.25 12.5 11.25"/>',
  platforms:
    '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/>',
  // Platform adapter marks.
  opencode:
    '<polyline points="5.5 7.5 10 12 5.5 16.5"/><line x1="12.5" y1="17" x2="18.5" y2="17"/>',
  claudeCode: '<path d="M12 4.5v15"/><path d="m5.8 8.25 12.4 7.5"/><path d="m18.2 8.25-12.4 7.5"/>',
  codex:
    '<path d="M9.75 4.5c-2.1 0-3.15 1.05-3.15 3.15v1.7c0 1.5-.85 2.4-2.35 2.65 1.5.25 2.35 1.15 2.35 2.65v1.7c0 2.1 1.05 3.15 3.15 3.15"/><path d="M14.25 4.5c2.1 0 3.15 1.05 3.15 3.15v1.7c0 1.5.85 2.4 2.35 2.65-1.5.25-2.35 1.15-2.35 2.65v1.7c0 2.1-1.05 3.15-3.15 3.15"/>',
  kimiCode: '<path d="M12 4.5 19.5 12 12 19.5 4.5 12Z"/>',
  cursorMark: '<path d="M5.5 4.5 10.53 18.03l2.02-5.48 5.48-2.02z"/>',
  piOmp:
    '<circle cx="12" cy="12" r="8.25"/><path d="M12 3.75a8.25 8.25 0 0 1 0 16.5Z" fill="currentColor"/>',
  hermes: '<path d="M4.5 6.5 15 10.25"/><path d="M4.5 12H20"/><path d="m15 13.75-10.5 3.75"/>',
  primeAgent:
    '<path d="M12 3.75 18.5 6v5.25c0 4.06-2.72 6.63-6.5 8.25-3.78-1.62-6.5-4.19-6.5-8.25V6Z"/><polyline points="9 11.75 11.25 14 15.25 9.75"/>',
  ecosystem:
    '<circle cx="6.5" cy="6" r="1.9"/><circle cx="17.5" cy="8" r="1.9"/><circle cx="10" cy="18" r="1.9"/><path d="M8.3 6.6 15.7 7.8"/><path d="m6.9 7.9 2.6 8.2"/><path d="m16.9 9.8-5.9 6.6"/>',
};
