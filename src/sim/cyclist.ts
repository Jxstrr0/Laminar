/**
 * The cyclist's live readouts (plan section 4, step 3): geometry only
 * (frontal area, mass, price, rule checks) plus the comfort / power meter.
 * The desk estimate lives in desk.ts.
 */
import { COMFORT, PART_COST, type CyclistDesign } from '../data/cyclist'
import { FIELD_TROUBLE } from '../data/field'
import type { CyclingRules } from '../data/rules'
import { cyclistShape, helmetLength, tubeAspect } from './geom/cyclist'
import { describeShape } from './geom/body'
import type { EventSpec } from './views'

export interface Comfort {
  /** 0 is easy; past `limit` the rider can't hold it. */
  strain: number
  limit: number
  /** Fraction of the rider's power still available (1 is all of it). */
  powerFactor: number
  holdable: boolean
  /** Share of the rider's power lost when they sit up for the last third (0 if they can hold it). */
  fade: number
  /** Which part of the posture strains most (for the "change this" jump). */
  worst: keyof CyclistDesign['posture'] | null
}

export function comfort(design: CyclistDesign, limit: number = COMFORT.riderLimit): Comfort {
  const p = design.posture
  const parts: [keyof CyclistDesign['posture'], number][] = [
    ['torsoDeg', Math.max(0, COMFORT.torsoEasyDeg - p.torsoDeg) * COMFORT.torsoPerDeg],
    ['headDrop', p.headDrop * COMFORT.headDropPer],
    ['armWidth', Math.max(0, COMFORT.armEasy - p.armWidth) * COMFORT.armPerMetre],
    ['handReach', Math.max(0, p.handReach - COMFORT.reachEasy) * COMFORT.reachPerMetre],
    ['handHeight', Math.max(0, p.handHeight - COMFORT.handHighEasy) * COMFORT.handHighPerMetre],
  ]
  let strain = 0
  let worst: Comfort['worst'] = null
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
  return { strain, limit, powerFactor: Math.max(0, 1 - COMFORT.powerPerStrain * strain), holdable, fade, worst }
}

/** Which part breaks which rule. `part` names the slider or picker to jump to. */
export interface RuleBreak {
  rule: 'helmetLength' | 'handReach' | 'handHeight' | 'frontWheel' | 'tubeAspect'
  part: 'helmet' | 'posture.handReach' | 'posture.handHeight' | 'wheels.front' | 'frame'
  value: number | string
  limit: number | string
}

export function checkRules(design: CyclistDesign, rules: CyclingRules): RuleBreak[] {
  const out: RuleBreak[] = []
  const hl = helmetLength(design)
  if (hl > rules.maxHelmetLength + 1e-9) out.push({ rule: 'helmetLength', part: 'helmet', value: hl, limit: rules.maxHelmetLength })
  if (design.posture.handReach > rules.maxHandReach + 1e-9)
    out.push({ rule: 'handReach', part: 'posture.handReach', value: design.posture.handReach, limit: rules.maxHandReach })
  if (design.posture.handHeight > rules.maxHandHeight + 1e-9)
    out.push({ rule: 'handHeight', part: 'posture.handHeight', value: design.posture.handHeight, limit: rules.maxHandHeight })
  if (!rules.frontWheels.includes(design.wheels.front))
    out.push({ rule: 'frontWheel', part: 'wheels.front', value: design.wheels.front, limit: rules.frontWheels.join(', ') })
  const ta = tubeAspect(design)
  if (ta > rules.maxTubeAspect + 1e-9) out.push({ rule: 'tubeAspect', part: 'frame', value: ta, limit: rules.maxTubeAspect })
  return out
}

export interface Readouts {
  /** Frontal area, m² (the sum of the parts' outlines). */
  frontalArea: number
  /** Bike and kit mass, kg. */
  mass: number
  /** Parts price, ₽. */
  price: number
  comfort: Comfort
  breaks: RuleBreak[]
}

export function readouts(design: CyclistDesign, rules: CyclingRules, limit?: number): Readouts {
  const c = PART_COST
  const items = [
    c.base,
    c.helmet[design.helmet.kind],
    c.wheel[design.wheels.front],
    c.wheel[design.wheels.rear],
    c.bars[design.bars],
    c.frame[design.frame],
    c.suit[design.suit.fabric],
    ...(design.suit.armTrips ? [c.armTrips] : []),
  ]
  return {
    frontalArea: describeShape(cyclistShape(design)).frontalArea,
    mass: items.reduce((s, i) => s + i.mass, 0),
    price: items.reduce((s, i) => s + i.price, 0),
    comfort: comfort(design, limit),
    breaks: checkRules(design, rules),
  }
}

/**
 * The event as this design rides it: the rider's power cut by the posture's
 * strain, and, past their limit, a fade for the last third.
 */
export function riderEvent(design: CyclistDesign, event: EventSpec, limit?: number): EventSpec {
  const c = comfort(design, limit)
  return { ...event, rider: { ...event.rider, power: event.rider.power * c.powerFactor }, fade: c.fade }
}
