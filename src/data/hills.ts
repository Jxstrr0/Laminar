/**
 * The ski-jump hills (Kelbo, 16 November 2026: a normal hill and a large
 * hill). Each landing slope is drawn from a few numbers: the drop under the
 * take-off edge, a knoll that steepens to the landing angle, the landing
 * slope, then the transition that flattens into the outrun. Jumps are
 * measured along the surface from the edge, as on a real hill.
 *
 * x runs forward from the take-off edge, y up; metres, degrees, m/s.
 */

export type HillId = 'normal' | 'large'

export interface Hill {
  id: HillId
  /** The construction point and the hill size: the landing slope's target and its end, m along the surface. */
  k: number
  hs: number
  /** Take-off table: its angle below level, the speed off it, and the jumper's push up and away from it. */
  tableDeg: number
  takeoffSpeed: number
  jumpSpeed: number
  /** The surface: drop under the edge, the knoll's start angle and length, the landing angle, where the transition starts and how long it runs. */
  drop: number
  knollDeg: number
  knollLength: number
  landingDeg: number
  transitionAt: number
  transitionLength: number
}

export const HILLS: Record<Hill['id'], Hill> = {
  normal: {
    id: 'normal',
    k: 90,
    hs: 98,
    tableDeg: 11,
    takeoffSpeed: 24.9,
    jumpSpeed: 2.4,
    drop: 2.6,
    knollDeg: 6,
    knollLength: 45,
    landingDeg: 34,
    transitionAt: 85,
    transitionLength: 45,
  },
  large: {
    id: 'large',
    k: 120,
    hs: 134,
    tableDeg: 11,
    takeoffSpeed: 26.7,
    jumpSpeed: 2.5,
    drop: 3,
    knollDeg: 6,
    knollLength: 55,
    landingDeg: 35,
    transitionAt: 116,
    transitionLength: 55,
  },
}

/** The flight's numbers: the time step, and how finely the surface is walked for distances. */
export const FLIGHT = {
  dt: 0.005,
  /** Give up after this long in the air (a safety net; real flights last 3 to 5 s). */
  maxSeconds: 10,
  /** Surface steps, m, for measuring along it. */
  surfaceStep: 0.25,
  /** Gravity, m/s². */
  gravity: 9.81,
}

/**
 * The jump the Shape screen's desk estimate flies until a ski-jump job sets
 * its own (PR 8d): the normal hill on a cold, still day.
 */
export const PRACTICE_JUMP = {
  hill: HILLS.normal,
  /** Jumper plus kit, kg. */
  mass: 65,
  temperature: -2,
  altitude: 700,
  headwind: 0,
  spread: { temperature: 3, wind: 1, speed: 0.3 },
}
