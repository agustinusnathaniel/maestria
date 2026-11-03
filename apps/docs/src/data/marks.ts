/**
 * Shared inline SVG marks, 24x24 stroke glyphs rendered locally. Decorative
 * (always rendered with aria-hidden), no assets or dependencies, no emoji.
 *
 * Keys cover method steps, principles, and the package families on the homepage. Components
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
  architecturePlan:
    '<rect x="3.5" y="3.5" width="7" height="7"/><rect x="13.5" y="13.5" width="7" height="7"/><path d="M7 10.5V17h6.5"/><path d="M10.5 7H17v6.5"/>',
  deepseek:
    '<path d="M12 5v14"/><path d="M12 5c-1.2 3.4-4 5.8-7.5 6.2 2 .8 3.4 2.2 4.2 4.3"/><path d="M12 5c1.2 3.4 4 5.8 7.5 6.2-2 .8-3.4 2.2-4.2 4.3"/>',
  diagnose: '<polyline points="3 12 7 12 9.5 6.5 14.5 17.5 17 12 21 12"/>',
  docsUpdate:
    '<path d="M6 3.5h8l4 4v13H6Z"/><polyline points="14 3.5 14 7.5 18 7.5"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="15.5" x2="13" y2="15.5"/>',
  ecosystem:
    '<circle cx="6.5" cy="6" r="1.9"/><circle cx="17.5" cy="8" r="1.9"/><circle cx="10" cy="18" r="1.9"/><path d="M8.3 6.6 15.7 7.8"/><path d="m6.9 7.9 2.6 8.2"/><path d="m16.9 9.8-5.9 6.6"/>',
  floors:
    '<line x1="4" y1="19.5" x2="20" y2="19.5"/><line x1="4" y1="15" x2="20" y2="15"/><polyline points="8 11 12 6.5 16 11"/>',
  implement:
    '<polyline points="8.5 7 3.5 12 8.5 17"/><polyline points="15.5 7 20.5 12 15.5 17"/><line x1="13.5" y1="5.5" x2="10.5" y2="18.5"/>',
  makerChecker:
    '<rect x="3.5" y="7" width="4.5" height="4.5"/><rect x="16" y="7" width="4.5" height="4.5"/><line x1="9.5" y1="9.25" x2="14.5" y2="9.25"/><polyline points="12.5 7.25 14.5 9.25 12.5 11.25"/>',
  opencode:
    '<polyline points="5.5 7.5 10 12 5.5 16.5"/><line x1="12.5" y1="17" x2="18.5" y2="17"/>',
  piOmp:
    '<circle cx="12" cy="12" r="8.25"/><path d="M12 3.75a8.25 8.25 0 0 1 0 16.5Z" fill="currentColor"/>',
  pipeline:
    '<polyline points="4 6 8 6 8 12 12 12 12 18 16 18"/><polyline points="13.5 16.75 16 18 13.5 19.25"/>',
  platforms:
    '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/>',
  pullRequest:
    '<circle cx="6.5" cy="6" r="2"/><circle cx="6.5" cy="18" r="2"/><circle cx="17.5" cy="18" r="2"/><line x1="6.5" y1="8" x2="6.5" y2="16"/><path d="M17.5 16V10a3 3 0 0 0-3-3H11"/><polyline points="13 5 11 7 13 9"/>',
  recon: '<circle cx="10.5" cy="10.5" r="6.25"/><line x1="15" y1="15" x2="20" y2="20"/>',
  reviewer:
    '<rect x="4.5" y="4.5" width="15" height="15"/><polyline points="8.25 12.25 11.25 15.25 16 9"/>',
  verify: '<circle cx="12" cy="12" r="8.25"/><polyline points="8.25 12.25 11 15 15.75 9.5"/>',
};
