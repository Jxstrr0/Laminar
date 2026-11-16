/**
 * The tunnel's latest jump forecast, kept for the Deliver sheet (PR 8i): the
 * declared distance starts from it. It's only offered back for the design and
 * the jump it was flown for, so an old forecast never fills in a new design.
 * Not saved: open the tunnel after a reload and it flies again.
 */
import type { JumperDesign } from '../data/jumper'
import type { JumpEvent } from '../sim/jumper'
import type { JumpForecast } from '../sim/jumpTunnel'

let latest: { key: string; forecast: JumpForecast } | null = null

/** Which design on which hill and day: the forecast belongs to both. */
const keyOf = (design: JumperDesign, event: JumpEvent) => JSON.stringify([design, event])

export const jumpForecast = {
  set(design: JumperDesign, event: JumpEvent, forecast: JumpForecast | null): void {
    latest = forecast ? { key: keyOf(design, event), forecast } : null
  },
  /** The forecast for this design and jump, or null if the tunnel hasn't flown one. */
  get(design: JumperDesign, event: JumpEvent): JumpForecast | null {
    return latest && latest.key === keyOf(design, event) ? latest.forecast : null
  },
}
