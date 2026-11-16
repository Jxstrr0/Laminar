/**
 * The tunnel's latest record forecast for a land-speed car, kept for the
 * Deliver sheet (PR 9u): the declared speed starts from it. Like the car's,
 * it's only offered back for the design and salt flat it was read for, so
 * an old forecast never fills in a new design. Not saved: open the tunnel
 * after a reload and it reads again.
 */
import type { RecordDesign } from '../data/record'
import type { SaltFlat } from '../data/saltFlats'
import type { RecordFloor } from '../sim/recordTunnel'

export interface RecordForecastKept {
  /** The two-way mean on the still day, m/s, and the gain on the team's car, m/s; null if the forecast run pulled its chutes. */
  speed: number | null
  gain: number | null
  /** Why the forecast run stopped, if it did. */
  abort: 'lift' | 'wander' | null
  /** The floor under the model: still, the shop's ground board, or a rolling road. */
  floor: RecordFloor
  /** Whether the readings placed the side force (a yaw sweep was run). */
  swept: boolean
  /** The forecast's top Mach number, where the air starts to squeeze round this car, and whether the forecast is well past it, so too fast (PR 9y). */
  mach: number
  squeezeMach: number
  squeezed: boolean
}

let latest: { key: string; forecast: RecordForecastKept } | null = null

const keyOf = (design: RecordDesign, flat: SaltFlat['id']) => JSON.stringify([design, flat])

export const recordForecast = {
  set(design: RecordDesign, flat: SaltFlat['id'], forecast: RecordForecastKept | null): void {
    latest = forecast ? { key: keyOf(design, flat), forecast } : null
  },
  /** The forecast for this design and flat, or null if the tunnel hasn't read one. */
  get(design: RecordDesign, flat: SaltFlat['id']): RecordForecastKept | null {
    return latest && latest.key === keyOf(design, flat) ? latest.forecast : null
  },
}
