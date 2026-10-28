/**
 * Shared inline SVG marks, 24x24 stroke glyphs rendered locally. Decorative
 * (always rendered with aria-hidden), no assets or dependencies, no emoji.
 *
 * Keys cover specialist roles, principles, and the package families on the homepage. Components
 * render them via `<svg {...markAttrs} set:html={marks[key]} />`.
 */

export const markAttrs = {
  'aria-hidden': 'true',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  'stroke-width': 1.7,
  viewBox: '0 0 24 24',
} as const;

export const marks: Record<string, string> = {
  ecosystem:
    '<circle cx="6.5" cy="6" r="1.9"/><circle cx="17.5" cy="8" r="1.9"/><circle cx="10" cy="18" r="1.9"/><path d="M8.3 6.6 15.7 7.8"/><path d="m6.9 7.9 2.6 8.2"/><path d="m16.9 9.8-5.9 6.6"/>',
  makerChecker:
    '<rect x="3.5" y="7" width="4.5" height="4.5"/><rect x="16" y="7" width="4.5" height="4.5"/><line x1="9.5" y1="9.25" x2="14.5" y2="9.25"/><polyline points="12.5 7.25 14.5 9.25 12.5 11.25"/>',
  opencode:
    '<polyline points="5.5 7.5 10 12 5.5 16.5"/><line x1="12.5" y1="17" x2="18.5" y2="17"/>',
  orchestrator:
    '<circle cx="12" cy="12" r="8.25"/><circle cx="12" cy="12" r="3.25"/><circle cx="12" cy="12" r="0.75" fill="currentColor"/>',
  piOmp:
    '<circle cx="12" cy="12" r="8.25"/><path d="M12 3.75a8.25 8.25 0 0 1 0 16.5Z" fill="currentColor"/>',
  pipeline:
    '<polyline points="4 6 8 6 8 12 12 12 12 18 16 18"/><polyline points="13.5 16.75 16 18 13.5 19.25"/>',
  platforms:
    '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/>',
  reviewer:
    '<rect x="4.5" y="4.5" width="15" height="15"/><polyline points="8.25 12.25 11.25 15.25 16 9"/>',
};
