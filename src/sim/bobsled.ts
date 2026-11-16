/**
 * The bobsled down the track (plan sections 6.8 and 8.3, PR 8l).
 *
 * The drag is four parts: the hull (a body the drag model reads, so a
 * gentler tail closes its wake), its nose (a short nose meets the air
 * bluntly), the runners and axles under it, and the crew: whatever of each shows over the cowling, the
 * driver in clean air and the rest in the wake of the one ahead.
 *
 * The run: the crew's push gives the speed at the start; loading costs a
 * little of it (more for a deep tuck and a tall cowling). Then a fixed-step
 * march down the track: gravity along the grade, against runner friction on
 * the ice (pressed harder in each curve) and the air. A driver who can't
 * see over the cowling steers late and loses time in every curve.
 */
import { ATMOSPHERE, FIELD_TURBULENCE } from '../data/field'
import { BOB_BLIND, BOB_CREW, BOB_HULL_SPEED, BOB_ICE, BOB_LOAD, BOB_STEP, SLED, SLIDING_RULES, type BobsledDesign } from '../data/bobsled'
import { BOB_PUSH, BOB_REFERENCE, type Track } from '../data/tracks'
import { shapeDrag } from './aero/drag'
import type { Flow } from './aero/flow'
import { densityAt, viscosityAt } from './field/atmosphere'
import { describeShape } from './geom/body'
import { sledLength, sledShape } from './geom/bobsled'

/** The top of each crew member's helmet above the ice, m. */
export function helmetTop(design: BobsledDesign): number {
  return BOB_CREW.sitTop - (BOB_CREW.sitTop - BOB_CREW.tuckTop) * design.tuck
}

/** The area of a crew member that shows over the cowling, m²: the helmet first, then the shoulders. */
export function exposedArea(height: number): number {
  const e = Math.max(0, height)
  const helmet = Math.min(e, BOB_CREW.helmetHeight)
  return helmet * BOB_CREW.helmetWidth + Math.max(0, e - BOB_CREW.helmetHeight) * BOB_CREW.shoulderWidth
}

/** The crew's drag area, m²: the driver in clean air, the others sheltered. */
export function crewCdA(design: BobsledDesign): number {
  const one = BOB_CREW.cd * exposedArea(helmetTop(design) - design.sled.cowl)
  return one * (1 + (design.crew - 1) * BOB_CREW.shelter)
}

/** How far the driver's eyes clear the cowling past what they need, m (negative: they can't see enough). */
export function sightMargin(design: BobsledDesign): number {
  return helmetTop(design) - BOB_CREW.eyeBelowTop - design.sled.cowl - BOB_CREW.sightClear
}

/** Speed lost while the crew load after the push, m/s. */
export function loadLoss(design: BobsledDesign): number {
  const l = BOB_LOAD
  return l.base + l.perTuck * design.tuck * design.tuck + l.perCowl * Math.max(0, design.sled.cowl - l.cowlEasy)
}

export interface SledDrag {
  /** The hull's friction and wake, then its nose's pressure drag, m². */
  hull: number
  nose: number
  runners: number
  crew: number
  /** All of it, m². */
  cdA: number
}

/** The sled's drag areas in a flow (the hull's depend a little on speed and air). */
export function sledDrag(design: BobsledDesign, flow: Flow): SledDrag {
  const shape = describeShape(sledShape(design))
  const hull = shapeDrag(shape, flow).cdA
  const nose = noseCdA(design, shape.frontalArea)
  const crew = crewCdA(design)
  return { hull, nose, runners: SLED.runnersCdA, crew, cdA: hull + nose + SLED.runnersCdA + crew }
}

/** The nose's pressure drag on a hull of this frontal area, m²: blunter (shorter) costs more. */
export function noseCdA(design: BobsledDesign, frontalArea: number): number {
  const k = SLED.noseK / design.sled.nose
  return k * k * frontalArea
}

export interface BobsledReadouts {
  /** The hull's front plus what of the crew shows over the cowling, m². */
  frontalArea: number
  /** The sled's own mass, kg (ballast tops the crew up to the limit). */
  mass: number
  price: number
}

export function bobsledReadouts(design: BobsledDesign): BobsledReadouts {
  const hull = describeShape(sledShape(design)).frontalArea
  const crew = exposedArea(helmetTop(design) - design.sled.cowl)
  return { frontalArea: hull + crew, mass: SLED.mass[design.crew], price: SLED.price[design.crew] }
}

/** A rule the sled breaks, with the slider to change. */
export interface SledRuleBreak {
  rule: 'length' | 'cowl'
  part: 'sled.nose' | 'sled.tail' | 'sled.cowl'
  value: number
  limit: number
}

/**
 * The Tarnovian Sliding Federation's box: the whole length (nose and tail
 * share it; the jump goes to the longer of the two) and the cowling's height.
 */
export function checkSledRules(design: BobsledDesign): SledRuleBreak[] {
  const out: SledRuleBreak[] = []
  const length = sledLength(design)
  const max = SLIDING_RULES.maxLength[design.crew]
  if (length > max + 1e-9) out.push({ rule: 'length', part: design.sled.nose >= design.sled.tail ? 'sled.nose' : 'sled.tail', value: length, limit: max })
  if (design.sled.cowl > SLIDING_RULES.maxCowl + 1e-9) out.push({ rule: 'cowl', part: 'sled.cowl', value: design.sled.cowl, limit: SLIDING_RULES.maxCowl })
  return out
}

/** The day on the track. */
export interface RunConditions {
  /** Ice and air temperature, °C. */
  iceTemp: number
  temperature: number
  /** Wind along the track against the sled, m/s (negative: from behind). */
  headwind: number
  /** The crew's push: speed when they load, m/s, and how long it took, s. */
  pushSpeed: number
  pushTime: number
}

/** One sample of the run, for charts and the replay. */
export interface RunPoint {
  t: number
  /** Metres down the track from the start. */
  s: number
  speed: number
}

export interface BobRun {
  /** Start to finish, s, with the push. */
  time: number
  /** Speed at the finish and the fastest, m/s. */
  finishSpeed: number
  topSpeed: number
  /** Speed at the load, after loading, m/s. */
  loadSpeed: number
  /** Time lost to steering late, s (0 when the driver can see). */
  blindLoss: number
  /** Every quarter second or so, and the finish. */
  trace: RunPoint[]
}

/** Runner friction on ice at a temperature. */
export function iceFriction(iceTemp: number): number {
  return BOB_ICE.friction * (1 + BOB_ICE.perDegree * Math.abs(iceTemp - BOB_ICE.bestTemp))
}

/** The conditions the promise is judged in: the crew's usual push, best ice, no wind. */
export function referenceConditions(design: Pick<BobsledDesign, 'crew'>): RunConditions {
  const push = BOB_PUSH[design.crew]
  return { ...BOB_REFERENCE, pushSpeed: push.speed, pushTime: push.time }
}

/** The run with a known drag area (the design's own, or one a tunnel read). */
export function runWith(cdA: number, design: BobsledDesign, track: Track, day: RunConditions): BobRun {
  const g = ATMOSPHERE.gravity
  const mass = SLED.maxTotal[design.crew]
  const density = densityAt(day.temperature, track.altitude)
  const mu = iceFriction(day.iceTemp)
  const dragK = (0.5 * density * cdA) / mass
  const loadSpeed = Math.max(0, day.pushSpeed - loadLoss(design))
  let v = loadSpeed
  let t = day.pushTime
  let s = track.push.length
  let top = v
  const trace: RunPoint[] = [{ t: 0, s: 0, speed: 0 }, { t, s, speed: v }]
  let nextMark = t + 0.25
  for (const st of track.stretches) {
    const k = st.grade / 100
    const norm = Math.sqrt(1 + k * k)
    const sin = k / norm
    const cos = 1 / norm
    let left = st.length
    while (left > 1e-9) {
      const air = v + day.headwind
      const lateral = st.radius > 0 ? (v * v) / st.radius : 0
      const press = Math.sqrt(g * g * cos * cos + lateral * lateral)
      const a = g * sin - mu * press - dragK * air * Math.abs(air)
      const ds = Math.max(1e-6, v * BOB_STEP + 0.5 * a * BOB_STEP * BOB_STEP)
      if (ds >= left) {
        // The last bit of the stretch: the time to cover just what's left.
        const dt = v > 1e-6 ? left / v : BOB_STEP
        t += dt
        v = Math.max(0.1, v + a * dt)
        s += left
        left = 0
      } else {
        t += BOB_STEP
        v = Math.max(0.1, v + a * BOB_STEP)
        s += ds
        left -= ds
      }
      if (v > top) top = v
      if (t >= nextMark) {
        trace.push({ t, s, speed: v })
        nextMark += 0.25
      }
    }
  }
  // Steering late: time lost in every curve for each metre short of clear sight.
  const curves = track.stretches.filter((x) => x.radius > 0).length
  const blindLoss = Math.max(0, -sightMargin(design)) * BOB_BLIND.perCurvePerMetre * curves
  t += blindLoss
  trace.push({ t, s, speed: v })
  return { time: t, finishSpeed: v, topSpeed: top, loadSpeed, blindLoss, trace }
}

/** The sled's drag areas in the air of a day on a track. */
export function dayDrag(design: BobsledDesign, track: Track, day: RunConditions): SledDrag {
  const flow: Flow = { density: densityAt(day.temperature, track.altitude), viscosity: viscosityAt(day.temperature), speed: BOB_HULL_SPEED, turbulence: FIELD_TURBULENCE }
  return sledDrag(design, flow)
}

/** The design's own run on a day. */
export function bobRun(design: BobsledDesign, track: Track, day: RunConditions): BobRun {
  return runWith(dayDrag(design, track, day).cdA, design, track, day)
}

/** The run the promise is judged on: the design on the reference day. */
export function referenceRun(design: BobsledDesign, track: Track): BobRun {
  return bobRun(design, track, referenceConditions(design))
}
