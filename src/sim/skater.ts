/**
 * The skater's live readouts, like cyclist.ts for a rider: frontal area,
 * kit mass and price, and the comfort meter for the crouch. A swinging arm
 * adds push; a crouch past the skater's limit fades in the last third.
 */
import { SKATER_COMFORT, SKATER_COST, SK_ARMS, type SkaterDesign } from '../data/skater'
import { FIELD_TROUBLE } from '../data/field'
import { describeShape } from './geom/body'
import { skaterShape } from './geom/skater'
import type { Comfort, Readouts } from './cyclist'
import type { EventSpec } from './views'

export type SkaterPart = keyof SkaterDesign['posture']

export function skaterComfort(design: SkaterDesign, limit: number = SKATER_COMFORT.limit): Comfort<SkaterPart> {
  const c = SKATER_COMFORT
  const p = design.posture
  const parts: [SkaterPart, number][] = [
    ['trunkDeg', Math.max(0, c.trunkEasyDeg - p.trunkDeg) * c.trunkPerDeg],
    ['kneeDeg', Math.max(0, c.kneeEasyDeg - p.kneeDeg) * c.kneePerDeg],
    ['headDrop', p.headDrop * c.headDropPer],
  ]
  let strain = 0
  let worst: SkaterPart | null = null
  let most = 0
  for (const [key, s] of parts) {
    strain += s
    if (s > most) {
      most = s
      worst = key
    }
  }
  const holdable = strain <= limit
  const f = FIELD_TROUBLE.fade
  const fade = holdable ? 0 : Math.min(f.max, f.start + f.per * (strain - limit))
  const push = design.arms === 'swing' ? 1 + SK_ARMS.swingPower : 1
  return { strain, limit, powerFactor: Math.max(0, (1 - c.powerPerStrain * strain) * push), holdable, fade, worst }
}

export function skaterReadouts(design: SkaterDesign, limit?: number): Readouts<SkaterPart> {
  const c = SKATER_COST
  const items = [c.base, c.hood[design.hood], c.suit[design.suit.fabric], ...(design.suit.legTrips ? [c.legTrips] : [])]
  return {
    frontalArea: describeShape(skaterShape(design)).frontalArea,
    mass: items.reduce((s, i) => s + i.mass, 0),
    price: items.reduce((s, i) => s + i.price, 0),
    comfort: skaterComfort(design, limit),
    breaks: [],
  }
}

/** The event as this crouch skates it: power through the comfort meter, and a fade past the limit. */
export function skaterEvent(design: SkaterDesign, event: EventSpec, limit?: number): EventSpec {
  const c = skaterComfort(design, limit)
  return { ...event, rider: { ...event.rider, power: event.rider.power * c.powerFactor }, fade: c.fade }
}
