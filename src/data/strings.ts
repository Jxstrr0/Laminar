/**
 * Player-facing text. Keep words here, not in the UI code, so they are easy
 * to find and change (and to translate one day).
 * Canadian spelling throughout.
 */
const STRINGS = {
  'game.title': 'Laminar',
  'tunnel.place': 'University tunnel · test section',
  'tunnel.model': 'Calibration sphere on a sting',
  'fan.label': 'Fan',
  'fan.off': 'Fan off',
  'fan.target': 'Set {target}',
  'read.speed': 'Air speed',
  'read.q': 'Dynamic pressure',
  'read.re': 'Reynolds number',
  'read.drag': 'Sphere drag',
  'read.dragNote': 'Cd {cd} · {regime}',
  'regime.laminar': 'laminar',
  'regime.mixed': 'drag crisis',
  'regime.turbulent': 'turbulent',
  'hint.orbit': 'Drag to look · pinch to zoom',
  'boot.fail': 'Laminar could not start. Reload to try again.',
  'boot.noGl': 'This browser cannot draw 3D (WebGL is off or missing). Try another browser.',
  'studio.credit': '© 2026 Kelbo / Longlight Interactive',
} as const

export type StringKey = keyof typeof STRINGS

/** Look up a string and fill any {slots}. */
export function t(key: StringKey, slots: Record<string, string | number> = {}): string {
  return STRINGS[key].replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in slots ? String(slots[name]) : whole,
  )
}
