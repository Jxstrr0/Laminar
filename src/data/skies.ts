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
  /** A short name, for the notes and the credits. */
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

/**
 * How a day's sky reads (PR 13bd), from clear (0) through thin cloud (1) and
 * broken cloud (2) to overcast (3). The replay shows the day the sim ran:
 * the same job always gets the same sky.
 */
export type Weather = 0 | 1 | 2 | 3

export const WEATHER = {
  /** By the day's wind, m/s: under each figure the sky is clear, thin, broken; from the last up, overcast. */
  wind: [1.5, 3, 6],
  /**
   * Where a venue's day has no wind to go by, the air against the venue's usual, °C: this much
   * warmer or more is clear, then thin, then broken; colder than the last, overcast.
   * On snow and ice it runs the other way: the colder day is the clear one.
   */
  warmer: [2.5, -0.5, -4],
  /** A venue with no weather (indoors): broken cloud, Kelbo's pick for the day sky. */
  usual: 2,
} as const satisfies { wind: readonly [number, number, number]; warmer: readonly [number, number, number]; usual: Weather }

/** The sky for a day with this much wind, m/s (a gust, where that's what the day has). */
export function weatherByWind(wind: number): Weather {
  const [clear, thin, broken] = WEATHER.wind
  return wind < clear ? 0 : wind < thin ? 1 : wind < broken ? 2 : 3
}

/** The sky for a day this much warmer than the venue's usual, °C (colder is negative); `winter` for snow and ice, where the cold day is the clear one. */
export function weatherByAir(warmer: number, winter = false): Weather {
  const [clear, thin, broken] = WEATHER.warmer
  const by = winter ? -warmer : warmer
  return by >= clear ? 0 : by >= thin ? 1 : by >= broken ? 2 : 3
}

/** The sky each mood gets in each weather, clear to overcast. Dark mode's dusk has two: a calmer evening, and heavier cloud. */
export const SKY_FOR: Record<SkyMood, readonly [SkyId, SkyId, SkyId, SkyId]> = {
  day: ['kloofendal_43d_clear_puresky', 'autumn_field_puresky', 'kloofendal_48d_partly_cloudy_puresky', 'overcast_soil_puresky'],
  winter: ['kloofendal_43d_clear_puresky', 'autumn_field_puresky', 'overcast_soil_puresky', 'overcast_soil_puresky'],
  dusk: ['evening_road_01_puresky', 'evening_road_01_puresky', 'kloppenheim_06_puresky', 'kloppenheim_06_puresky'],
}

/** The sky for a venue's mood on a day with this weather. */
export function pickSky(mood: SkyMood, weather: Weather): SkyId {
  return SKY_FOR[mood][weather]
}

/**
 * The tunnel and Shape's soft studio light (PR 13ba): a lit room the models
 * reflect, how strongly, how much of the flat hemisphere light stays, and
 * how much of it the tunnel's pale walls and floor take.
 * The pressure map ignores it, so its colours read the same.
 */
export const STUDIO_LIGHT = { light: 0.55, hemi: 0.8, shell: 0.12 } as const
