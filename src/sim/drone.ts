/**
 * The racing quad (plan sections 6 and 9.6, PR 10a).
 *
 * A quad holds itself up and pushes itself along with the same four props:
 * tilted nose-down by θ, their thrust T lifts T cos θ and pushes T sin θ.
 * So flat out it tilts as far as the thrust left over after its weight
 * allows, and the air meets the frame at that tilt. The body pod meets it
 * at the tilt less the pod's rake: raked to the racing tilt, it points into
 * the wind.
 *
 * - Drag: the pod (head-on, finer the longer it is, plus the side it shows
 *   at an angle), the frame plate (shown more the more it tilts), the arms
 *   (far less when faired), the motors and props, and open vents.
 * - Thrust falls as the quad speeds up (the props can't pull much faster
 *   than they screw through the air), loses a share to the downwash beating
 *   on the arms (less with fairings), and, with too few vents open, a share
 *   more once the speed controllers overheat partway through the race.
 * - Corners are flown on the thrust left over after holding the quad up:
 *   a heavier quad corners slower.
 * - A pod met at an angle twists the quad (its pitching moment, more for a
 *   longer pod and faster air). Braking, the quad tilts hard back, so a
 *   pod raked for the straights meets the air nearly tail-first and twists
 *   hardest. Past what the motors can hold, the quad tumbles and crashes,
 *   and the race ends there.
 *
 * The race is laps of the club's gate course from a standing start, flown
 * as fast as the quad can: flat out on the straights, braking (tilting
 * back) into the corners as late as it can.
 */
import { ATMOSPHERE } from '../data/field'
import type { CircuitSegment } from '../data/circuits'
import { segmentLength } from '../data/circuits'
import { DRONE_AERO as A, DRONE_CLASS, DRONE_RACE as RACE, type DroneCourse, type DroneDesign } from '../data/drone'
import { detAtan2, detSin } from './det'
import { densityAt } from './field/atmosphere'

const DEG = Math.PI / 180

/** The quad's all-up mass, kg: the fairings and a longer pod add to it. */
export function droneMass(design: DroneDesign): number {
  const c = DRONE_CLASS[design.class]
  return c.mass + A.fairingMass * design.arms + A.podMassPerM * (design.pod.length - A.podStock)
}

/** The quad's drag at this tilt (radians, nose down), m², with each part's share. */
export interface DroneDrag {
  cdA: number
  parts: { pod: number; frame: number; arms: number; props: number; vents: number }
}

export function droneDrag(design: DroneDesign, tilt: number): DroneDrag {
  const p = design.pod
  const alpha = tilt - p.rake * DEG
  const sa = detSin(alpha)
  const st = detSin(tilt)
  const parts = {
    pod: (A.podCd + (A.podBluff * A.podWidth) / p.length) * A.podFront + A.crossCd * p.length * A.podWidth * sa * sa,
    frame: A.frameCd * A.frameArea * st * st,
    arms: A.armArea * (A.armCdBare + (A.armCdFaired - A.armCdBare) * design.arms),
    props: A.propCdA,
    vents: A.ventCdA * p.vents,
  }
  return { cdA: parts.pod + parts.frame + parts.arms + parts.props + parts.vents, parts }
}

/** The share of the thrust the downwash on the arms takes. */
export function downwashLoss(design: DroneDesign): number {
  return A.downwashBare + (A.downwashFaired - A.downwashBare) * design.arms
}

/** The share of the thrust lost once the speed controllers overheat (0 with the vents they need open). */
export function heatLoss(design: DroneDesign): number {
  const c = DRONE_CLASS[design.class]
  return c.heatLoss * Math.max(0, 1 - design.pod.vents / c.coolNeed)
}

/** The props' thrust at this airspeed, N, after the downwash on the arms (its share given, or the truth), and the heat once `hot`. */
export function thrustAt(design: DroneDesign, speed: number, hot = false, downwash = downwashLoss(design)): number {
  const c = DRONE_CLASS[design.class]
  const fresh = c.thrust * Math.max(0, 1 - speed / c.pitchSpeed)
  return fresh * (1 - downwash) * (1 - (hot ? heatLoss(design) : 0))
}

/** The pitching moment the air puts on the pod at this speed and tilt, N·m (positive: nose up). */
export function pitchMoment(design: DroneDesign, speed: number, tilt: number, density: number): number {
  const alpha = tilt - design.pod.rake * DEG
  return A.munk * 0.5 * density * speed * speed * design.pod.length * A.podFront * detSin(2 * alpha)
}

/**
 * A guess at the quad rather than the truth (the desk's, and the tunnel's
 * from PR 10c): a scale on its drag, and optionally a scale on its twist
 * and the share of the thrust the downwash takes (the truth if left out).
 */
export interface DroneTrim {
  drag: number
  twist?: number
  downwash?: number
}

const NO_TRIM: DroneTrim = { drag: 1 }

/** What the race model needs at one speed: the push left over sideways or forward, the tilt flat out, and the drag there. */
function flatOut(design: DroneDesign, speed: number, density: number, hot: boolean, trim: DroneTrim) {
  const w = droneMass(design) * ATMOSPHERE.gravity
  const t = thrustAt(design, speed, hot, trim.downwash)
  const spare = Math.sqrt(Math.max(0, t * t - w * w))
  const tilt = detAtan2(spare, w)
  const drag = 0.5 * density * speed * speed * droneDrag(design, tilt).cdA * trim.drag
  return { spare, tilt, drag }
}

/** The tilt that holds this speed steady, radians: the push just matches the drag. */
export function steadyTilt(design: DroneDesign, speed: number, density: number, trim: DroneTrim = NO_TRIM): number {
  const w = droneMass(design) * ATMOSPHERE.gravity
  const q = 0.5 * density * speed * speed
  let tilt = 0
  for (let k = 0; k < 8; k++) tilt = detAtan2(q * droneDrag(design, tilt).cdA * trim.drag, w)
  return tilt
}

/** The fastest the quad flies level, m/s, at this air density (cool, as at the start). */
export function topSpeed(design: DroneDesign, density: number, trim: DroneTrim = NO_TRIM): number {
  let lo = 0
  let hi = RACE.ceiling
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    const f = flatOut(design, mid, density, false, trim)
    if (f.spare > f.drag) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** The air at a course on a day, kg/m³. */
export function courseDensity(course: DroneCourse, temperature = course.temperature): number {
  return densityAt(temperature, course.altitude)
}

/** Troubles to take away from a race, to see what each cost (for the debrief, later). */
export interface RaceRelief {
  /** The speed controllers never overheat. */
  heat?: boolean
  /** The motors hold any twist: no tumble. */
  tumble?: boolean
}

export interface DroneRace {
  /** The race's time, s, or null if the quad tumbled. */
  time: number | null
  /** The fastest it went, m/s. */
  top: number
  /** Where it tumbled (m from the start) and how fast it was going, m/s, or null. */
  tumble: { at: number; speed: number } | null
  /** When the speed controllers overheated, s into the race, or null if they never did. */
  hotAt: number | null
  /** The hardest the air twisted the quad (up to any tumble): the moment, N·m, the speed there, m/s, and whether it was braking. */
  twist: { moment: number; speed: number; braking: boolean }
  /** Its speed at the end of each step, m/s (RACE.step apart, give or take a corner's rounding). */
  speeds: number[]
  /** Each step's length, m. */
  lengths: number[]
}

/** The race's steps: their lengths and the course piece each belongs to. */
function steps(segments: readonly CircuitSegment[], laps: number) {
  const lengths: number[] = []
  const pieces: CircuitSegment[] = []
  for (let lap = 0; lap < laps; lap++) {
    for (const seg of segments) {
      const len = segmentLength(seg)
      const n = Math.max(1, Math.round(len / RACE.step))
      for (let k = 0; k < n; k++) {
        lengths.push(len / n)
        pieces.push(seg)
      }
    }
  }
  return { lengths, pieces }
}

/** The fastest the quad takes a corner of this radius, m/s: its spare push holds it round, less what the drag takes. */
function cornerSpeed(design: DroneDesign, radius: number, density: number, hot: boolean, trim: DroneTrim): number {
  const m = droneMass(design)
  let v = Math.sqrt(radius * 10)
  for (let k = 0; k < RACE.passes; k++) {
    const f = flatOut(design, v, density, hot, trim)
    const sideways = Math.sqrt(Math.max(0, f.spare * f.spare - f.drag * f.drag))
    v = Math.min(RACE.ceiling, Math.sqrt((radius * sideways) / m))
  }
  return v
}

/** Fly the race on the quad's true aero, with any troubles taken away. */
export function droneRace(design: DroneDesign, course: DroneCourse, temperature = course.temperature, opts: { trim?: DroneTrim; relief?: RaceRelief } = {}): DroneRace {
  const trim = opts.trim ?? NO_TRIM
  const relief = opts.relief ?? {}
  const density = courseDensity(course, temperature)
  const m = droneMass(design)
  const c = DRONE_CLASS[design.class]
  const { lengths, pieces } = steps(course.segments, RACE.laps)
  const count = lengths.length
  const canOverheat = !relief.heat && heatLoss(design) > 0
  // Corner speeds, cool and hot, per radius.
  const corners = new Map<string, number>()
  const capFor = (seg: CircuitSegment, hot: boolean) => {
    if (seg.kind !== 'corner') return RACE.ceiling
    const key = `${seg.radius}:${hot}`
    let v = corners.get(key)
    if (v === undefined) {
      v = cornerSpeed(design, seg.radius, density, hot, trim)
      corners.set(key, v)
    }
    return v
  }

  // When the controllers overheat depends on the speeds, and the speeds on the heat: settle it in two goes.
  let hotFrom = count
  let speeds: number[] = []
  let hotAt: number | null = null
  for (let pass = 0; pass < 2; pass++) {
    const hot = (i: number) => canOverheat && i >= hotFrom
    const limit = pieces.map((seg, i) => capFor(seg, hot(i)))
    // Forward: flat out from a standing start, never past a step's limit.
    const fwd = new Array<number>(count)
    let v = 0
    for (let i = 0; i < count; i++) {
      const f = flatOut(design, v, density, hot(i), trim)
      v = Math.min(limit[i]!, Math.sqrt(Math.max(0, v * v + (2 * (f.spare - f.drag) * lengths[i]!) / m)))
      fwd[i] = v
    }
    // Backward: tilt back into each corner as late as the spare push and the drag allow.
    speeds = fwd.slice()
    let w = speeds[count - 1]!
    for (let i = count - 1; i >= 0; i--) {
      const f = flatOut(design, w, density, hot(i), trim)
      w = Math.min(speeds[i]!, Math.sqrt(w * w + (2 * (f.spare + f.drag) * lengths[i]!) / m))
      speeds[i] = w
    }
    // When the race clock passes the controllers' limit.
    let time = 0
    hotFrom = count
    hotAt = null
    if (canOverheat) {
      for (let i = 0; i < count; i++) {
        const entry = i === 0 ? 0 : speeds[i - 1]!
        time += lengths[i]! / Math.max((entry + speeds[i]!) / 2, 0.5)
        if (time > c.heatAfter) {
          hotFrom = i
          hotAt = c.heatAfter
          break
        }
      }
    }
  }

  let time = 0
  let top = 0
  let along = 0
  let tumble: DroneRace['tumble'] = null
  let twist: DroneRace['twist'] = { moment: 0, speed: 0, braking: false }
  for (let i = 0; i < count; i++) {
    const entry = i === 0 ? 0 : speeds[i - 1]!
    const v = speeds[i]!
    // Speeding up, it tilts as far forward as it can; braking, as far back (the pod then meets the air
    // nearly tail-first, and a raked one twists hardest); holding its speed, just enough for the drag.
    const tilt = v > entry + 1e-9 ? flatOut(design, v, density, false, trim).tilt : v < entry - 1e-9 ? -flatOut(design, v, density, false, trim).tilt : steadyTilt(design, v, density, trim)
    const moment = Math.abs(pitchMoment(design, v, tilt, density)) * (trim.twist ?? 1)
    if (moment > twist.moment) twist = { moment, speed: v, braking: v < entry - 1e-9 }
    if (!relief.tumble && moment > c.authority) {
      tumble = { at: along, speed: v }
      break
    }
    time += lengths[i]! / Math.max((entry + v) / 2, 0.5)
    top = Math.max(top, v)
    along += lengths[i]!
  }
  return { time: tumble ? null : time, top, tumble, hotAt, twist, speeds, lengths }
}
