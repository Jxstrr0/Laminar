/**
 * The dock's icons (Isobar, PR 13e): small inline SVGs drawn in strokes of
 * currentColor, so they take the button's text colour in both themes. Each
 * sits on a 24-unit grid and is drawn at 22px.
 */

const svg = (paths: string) =>
  `<svg class="icon" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`

export const ICONS = {
  /** Jobs: a clipboard with a brief on it. */
  board: svg('<rect x="5" y="4.5" width="14" height="16.5" rx="2.5"/><path d="M9 4.5V3.6c0-.6.4-1.1 1-1.1h4c.6 0 1 .5 1 1.1v.9"/><path d="M8.5 10h7M8.5 13.5h7M8.5 17h4"/>'),
  /** Shape: a bezier pen stroke between two nodes, with its handle. */
  shape: svg('<path d="M4 18c3-9 9-12 16-12"/><rect x="2.5" y="16.5" width="3.4" height="3.4" rx=".8"/><rect x="18.3" y="4.3" width="3.4" height="3.4" rx=".8"/><path d="M11 4.5l3 3M8.5 7l5.5 5.5"/><circle cx="11" cy="9.6" r="1.2"/>'),
  /** Tunnel: wind lines streaming past. */
  tunnel: svg('<path d="M3 8h10.5a2.5 2.5 0 1 0-2.5-2.5"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h6"/>'),
  /** Deliver (the tutorial's last card): a finish flag on its pole. */
  deliver: svg('<path d="M5 21V3.5"/><path d="M5 4h13l-2.5 4 2.5 4H5"/><path d="M9 4v8M13 4v8M5 8h13"/>'),
  /** Saves: a floppy disk. */
  saves: svg('<path d="M5 3.5h11l3.5 3.5v11.5a2 2 0 0 1-2 2h-12.5a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z"/><path d="M8 3.5v5h7v-5"/><rect x="7.5" y="13" width="9" height="7.5" rx="1"/>'),
} as const

export type IconName = keyof typeof ICONS
