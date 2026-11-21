/**
 * The replays' skies (PR 13az): Poly Haven's CC0 "pure sky" photos, tone-mapped
 * by scripts/make-skies.py into public/sky/<id>.jpg. Each one is drawn
 * behind the venue and also lights it (the shiny parts of the cars, planes
 * and kit reflect it). Credits in CREDITS.md.
 *
 * Until a sky has loaded, or if it can't, the old flat colour stays.
 */

export type SkyId =
  | 'kloofendal_48d_partly_cloudy_puresky'
  | 'autumn_field_puresky'
  | 'kloofendal_43d_clear_puresky'
  | 'overcast_soil_puresky'
  | 'kloppenheim_06_puresky'
  | 'evening_road_01_puresky'

/** Which kind of day a venue gets: summer venues, winter ones (the lake, the hill, the sliding track), or dusk in dark mode. */
export type SkyMood = 'day' | 'winter' | 'dusk'

export interface Sky {
  /** A short name for the trial list (`?sky=` in the address). */
  name: string
  /** The colour just above its horizon (printed by the script): the fog fades the far ground into it. */
  horizon: number
  /** How strongly it lights the venue, and how much of the old flat hemisphere light stays on top. */
  light: number
  hemi: number
  /** The venue's sun light under it: how strong, against the daylight's, and its colour. */
  sun: number
  sunColour: number
  /**
   * Where its sun (or its brightest patch) sits in the picture, degrees, as the script prints it.
   * Each venue turns the sky so that lands where its own sun light comes from (PR 13bc).
   */
  sunAt: number
}

export const SKIES: Record<SkyId, Sky> = {
  kloofendal_48d_partly_cloudy_puresky: { name: 'cumulus', horizon: 0xced0d5, light: 1, hemi: 0.45, sun: 1, sunColour: 0xffffff, sunAt: 34 },
  autumn_field_puresky: { name: 'wisps', horizon: 0xdce1e4, light: 1, hemi: 0.45, sun: 1, sunColour: 0xffffff, sunAt: 36 },
  kloofendal_43d_clear_puresky: { name: 'clear', horizon: 0xd5d8db, light: 1, hemi: 0.45, sun: 1, sunColour: 0xffffff, sunAt: 36 },
  overcast_soil_puresky: { name: 'overcast', horizon: 0xdedddb, light: 0.85, hemi: 0.28, sun: 0.5, sunColour: 0xf2f4ff, sunAt: -12 },
  kloppenheim_06_puresky: { name: 'dusk', horizon: 0x98938f, light: 1.6, hemi: 0.3, sun: 0.45, sunColour: 0xffc69c, sunAt: 39 },
  evening_road_01_puresky: { name: 'evening', horizon: 0xa1a6a8, light: 1.4, hemi: 0.32, sun: 0.5, sunColour: 0xffd2ae, sunAt: 40 },
}

/** The sky each mood gets. */
export const SKY_FOR: Record<SkyMood, SkyId> = {
  day: 'kloofendal_48d_partly_cloudy_puresky',
  winter: 'overcast_soil_puresky',
  dusk: 'kloppenheim_06_puresky',
}

/**
 * The sky for a venue's mood, or what `?sky=` in the address asks for while
 * Kelbo tries them out: a sky's short name (`?sky=clear`) or `off` for the old flat colour.
 * Returns null for the flat colour.
 */
export function pickSky(mood: SkyMood, trial: string | null): SkyId | null {
  if (trial === 'off') return null
  if (trial) {
    const hit = (Object.keys(SKIES) as SkyId[]).find((id) => SKIES[id].name === trial)
    if (hit) return hit
  }
  return SKY_FOR[mood]
}

/**
 * The tunnel and Shape's soft studio light (PR 13ba): a lit room the models
 * reflect, how strongly, how much of the flat hemisphere light stays, and
 * how much of it the tunnel's pale walls and floor take.
 * The pressure map ignores it, so its colours read the same.
 */
export const STUDIO_LIGHT = { light: 0.55, hemi: 0.8, shell: 0.12 } as const
