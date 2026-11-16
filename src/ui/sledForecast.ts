/**
 * The tunnel's latest bobsled run forecast, kept for the Deliver sheet (PR 8p):
 * the declared run time starts from it. Like the jump forecast, it's only
 * offered back for the design and track it was run for, so an old forecast
 * never fills in a new design. Not saved: open the tunnel after a reload and
 * it reads again.
 */
import type { BobsledDesign } from '../data/bobsled'
import type { Track } from '../data/tracks'

export interface SledForecast {
  /** The reference run on the pooled, corrected reading, s. */
  time: number
  /** Whether the model sat on a ground board (without one the runners read low, so the time is too quick). */
  board: boolean
}

let latest: { key: string; forecast: SledForecast } | null = null

const keyOf = (design: BobsledDesign, track: Track['id']) => JSON.stringify([design, track])

export const sledForecast = {
  set(design: BobsledDesign, track: Track['id'], forecast: SledForecast | null): void {
    latest = forecast ? { key: keyOf(design, track), forecast } : null
  },
  /** The forecast for this design and track, or null if the tunnel hasn't read one. */
  get(design: BobsledDesign, track: Track['id']): SledForecast | null {
    return latest && latest.key === keyOf(design, track) ? latest.forecast : null
  },
}
