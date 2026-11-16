/**
 * The sliding track (PR 8l): Belogor's, on the same mountain as its ski
 * jumps. The crew push the sled over the start, load, and then it's gravity
 * against the ice and the air to the finish. The track is a list of
 * stretches, each with its grade and, in a curve, its radius: the curve
 * presses the runners into the ice and that friction is time.
 *
 * Lengths in metres, grades in per cent (drop per 100 m along), speeds m/s.
 */
import type { Crew } from './bobsled'

export interface TrackStretch {
  length: number
  grade: number
  /** Radius of the curve, m, or 0 on a straight. */
  radius: number
}

export interface Track {
  id: 'belogor'
  /** The push zone at the top, m and per cent. */
  push: { length: number; grade: number }
  stretches: readonly TrackStretch[]
  /** Altitude of the track, m. */
  altitude: number
}

const s = (length: number, grade: number, radius = 0): TrackStretch => ({ length, grade, radius })

export const TRACKS: Record<Track['id'], Track> = {
  belogor: {
    id: 'belogor',
    push: { length: 50, grade: 2 },
    altitude: 1050,
    stretches: [
      s(60, 12),
      s(50, 10, 30),
      s(40, 9),
      s(55, 11, 25),
      s(45, 8),
      s(70, 10, 28),
      s(50, 9),
      s(60, 12, 22),
      s(40, 8),
      // The long horseshoe.
      s(120, 7, 35),
      s(60, 10),
      s(55, 9, 24),
      s(50, 11),
      s(60, 8, 26),
      s(45, 10),
      s(55, 9, 22),
      s(60, 8),
      s(50, 10, 30),
      s(70, 7),
      s(45, 8, 25),
      // The finish straight.
      s(60, 6),
    ],
  },
}

/**
 * The crew's push: the speed the sled has when they load, and the time the
 * push takes, by crew size. A client's own crew may push faster or slower.
 */
export const BOB_PUSH: Record<Crew, { speed: number; time: number }> = {
  2: { speed: 11.2, time: 5.1 },
  4: { speed: 11.7, time: 4.9 },
}

/** The conditions the promise is judged in: no wind, best ice, a cold still day. */
export const BOB_REFERENCE = { iceTemp: -7, temperature: -5, headwind: 0 } as const
