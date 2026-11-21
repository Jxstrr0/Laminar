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
  /** How far it's turned, degrees, so its sun sits roughly where the venue's sun light is. */
  turn: number
}

export const SKIES: Record<SkyId, Sky> = {
  kloofendal_48d_partly_cloudy_puresky: { name: 'cumulus', horizon: 0xced0d5, light: 1, hemi: 0.45, sun: 1, sunColour: 0xffffff, turn: 0 },
  autumn_field_puresky: { name: 'wisps', horizon: 0xdce1e4, light: 1, hemi: 0.45, sun: 1, sunColour: 0xffffff, turn: 0 },
  kloofendal_43d_clear_puresky: { name: 'clear', horizon: 0xd5d8db, light: 1, hemi: 0.45, sun: 1, sunColour: 0xffffff, turn: 0 },
  overcast_soil_puresky: { name: 'overcast', horizon: 0xdedddb, light: 1, hemi: 0.5, sun: 0.6, sunColour: 0xf2f4ff, turn: 0 },
  kloppenheim_06_puresky: { name: 'dusk', horizon: 0x98938f, light: 1.6, hemi: 0.5, sun: 0.55, sunColour: 0xffc69c, turn: 0 },
  evening_road_01_puresky: { name: 'evening', horizon: 0xa1a6a8, light: 1.4, hemi: 0.5, sun: 0.6, sunColour: 0xffd2ae, turn: 0 },
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
