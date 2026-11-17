/**
 * The 3D scenes' colours (Isobar, PR 13h): one place for every scene colour
 * that changes with the phone's light or dark mode, and the "model shop"
 * finish the models wear in both. Kelbo, 16 November 2026: the lab follows
 * the phone's dark mode (it used to stay bright), and the Dark wall goes darker
 * still in dark mode, so the chip always does something.
 *
 * Scenes read `sceneColours()` when they build and call `onThemeChange` to
 * re-set their materials when the phone switches. That's a colour change only:
 * nothing new happens per frame.
 */

export type Theme = 'light' | 'dark'

/** The lab, the bench and the field for one theme. */
export interface SceneColours {
  /** The scene's backdrop (--scene in style.css). */
  background: number
  wall: number
  floor: number
  seam: number
  frame: number
  /** Soft light from above and from the floor, and the key light. */
  hemiSky: number
  hemiGround: number
  key: number
  /** The Dark wall instrument's backdrop, for white smoke. */
  darkWall: { background: number; wall: number; floor: number; seam: number }
  /** The smoke's twin, so white smoke reads on pale walls; white where the walls are dark. */
  smokeTwin: number
  /** Attached tufts: the lab's ink. */
  tuft: number
  /** The action colour (teal) for marks in the lab: the turntable tick, the stripe, the wand's tip, your own tunnel's trim. */
  accent: number
  /** Separation and failures (--sep). */
  sep: number
  /** The bench's grid and its broken-rule boxes (Shape). */
  grid: number
  /** The field replays' sky and fog: daylight, or a dusk in dark mode so the screen isn't a white flash. */
  fieldSky: number
  /** Your own marks in the field (your landing, your finish): the pressure blue (--cp-lo). */
  mine: number
}

export const SCENE_THEMES: Record<Theme, SceneColours> = {
  light: {
    background: 0xf6f7ff,
    wall: 0xe9ecfa,
    floor: 0xe2e5f7,
    seam: 0xc8cce6,
    frame: 0x8a90b0,
    // Lilac-white over lilac-grey, and a slightly warm key.
    hemiSky: 0xf8f7ff,
    hemiGround: 0xbcc0dc,
    key: 0xfff4e6,
    darkWall: { background: 0x151936, wall: 0x1c2142, floor: 0x1f2447, seam: 0x2c3262 },
    smokeTwin: 0x5a6082,
    tuft: 0x161a33,
    accent: 0x00756f,
    sep: 0xff5a4e,
    grid: 0x9ea4c4,
    fieldSky: 0xe3e7f6,
    mine: 0x3d5bff,
  },
  dark: {
    background: 0x151936,
    wall: 0x1c2142,
    floor: 0x1f2447,
    seam: 0x2c3262,
    frame: 0x8d94be,
    hemiSky: 0xe6e4ff,
    hemiGround: 0x5a5f86,
    key: 0xfff4e6,
    // In dark mode the Dark wall goes near-black.
    darkWall: { background: 0x080a16, wall: 0x0d1024, floor: 0x10132a, seam: 0x1a1e3a },
    smokeTwin: 0xffffff,
    tuft: 0xeef0ff,
    accent: 0x2ed3c6,
    sep: 0xff7a6e,
    grid: 0x5a6090,
    fieldSky: 0x3a4170,
    mine: 0x7189ff,
  },
}

/**
 * The models' "model shop" finish: matte, the same in both themes, so data
 * colours and handles stand out. The rider's suit is deep indigo with a teal
 * panel; other sports' figures use the same teal for their marked parts.
 */
export const MODEL = {
  suit: 0x3a4170,
  panel: 0x14a296,
  helmet: 0xf6f7ff,
  frame: 0x8a90b0,
  tyre: 0x2a2f4f,
  /** A broken rule or failed part (--sep, light). */
  broken: 0xff5a4e,
  /** The posture or part under the most strain (--warn). */
  strain: 0xe08a00,
} as const

const query = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null

/** The phone's theme right now. */
export function currentTheme(): Theme {
  return query?.matches ? 'dark' : 'light'
}

/** The scene colours for the phone's theme right now. */
export function sceneColours(): SceneColours {
  return SCENE_THEMES[currentTheme()]
}

/** Hear when the phone switches between light and dark; returns a function that stops listening. */
export function onThemeChange(cb: (colours: SceneColours, theme: Theme) => void): () => void {
  if (!query) return () => undefined
  const listener = () => cb(sceneColours(), currentTheme())
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}
