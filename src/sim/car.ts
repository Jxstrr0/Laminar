/**
 * The racing car on the circuit (plan sections 6.3, 8 and 9, PR 9i).
 *
 * The aero: the body's own drag and slight lift, the front wing (a splitter
 * flap on a touring car) and the rear wing, each pressing down with drag
 * and stalling past their angle, and the floor: the closer it sits to the
 * road the harder it pulls, until under its critical height the flow under
 * it stalls and the pull collapses (that is what makes a car porpoise).
 * Downforce squashes the springs, so the car sits lower the faster it goes:
 * the ride heights and the downforce are solved together at each speed.
 *
 * The balance is the share of downforce on the front axle. Outside the
 * class's window the car understeers or oversteers and the driver lifts:
 * grip is lost in proportion (Kelbo, 16 November 2026).
 *
 * The lap: corners at the speed the tyres hold with the downforce at that
 * speed, straights flat out with the engine against the drag, braking as
 * late as the grip allows. The promise is time off the team's current lap.
 */
import { CAR_AERO as A, CAR_CLASS, CAR_RULES, LAP, type CarDesign } from '../data/car'
import { ATMOSPHERE } from '../data/field'
import { segmentLength, type Circuit } from '../data/circuits'
import { densityAt } from './field/atmosphere'
import { PI } from './det'
import { DEG, clamp, interp, smoothstep } from './num'

/** The car's aero at one speed. */
export interface CarAero {
  speed: number
  /** Drag area and downforce area (front, rear and all), m². */
  cdA: number
  clAFront: number
  clARear: number
  clA: number
  /** Share of downforce on the front axle. */
  balance: number
  /** Ride heights at speed, m. */
  front: number
  rear: number
  /** The floor has stalled: it sits under its critical height, or one end of it is scraping the road. */
  stalled: boolean
  /** Each part's share: downforce areas and drag areas, m². */
  parts: { frontWing: number; rearWing: number; floor: number; body: number; drag: { body: number; wings: number; floor: number; cooling: number } }
}

/** A wing's effective angle: past its stall, lift falls away. */
function stalled(angleDeg: number, stallDeg: number): number {
  return angleDeg <= stallDeg ? angleDeg : stallDeg - (angleDeg - stallDeg) * (A.stallDrop - 1)
}

/** The rear wing's area, m². */
export function rearWingArea(design: CarDesign): number {
  return CAR_CLASS[design.class].rearSpan * design.rearWing.chord
}

/** The floor's pull factor at a mean ride height (1 at the reference height): rising as it sits lower, collapsing under the critical height. */
export function floorFactor(design: CarDesign, height: number): number {
  const f = CAR_CLASS[design.class].floor
  const soft = A.floorSoft * f.refHeight
  const pull = (h: number) => (f.refHeight + soft) / (Math.max(h, 0) + soft)
  if (height >= f.critHeight) return pull(height)
  // Under the critical height the flow chokes: from the peak at the critical height down to `floorStallKeep` of it at the road.
  const peak = pull(f.critHeight)
  return peak * (A.floorStallKeep + (1 - A.floorStallKeep) * clamp(height / f.critHeight, 0, 1))
}

/** The diffuser's factor (1 at the class's reference angle), past its stall falling away. */
function diffuserFactor(design: CarDesign): number {
  const f = CAR_CLASS[design.class].floor
  const d = design.diffuser
  if (d <= f.stallDiffuser) return 1 + A.diffuserGain * (d - f.refDiffuser)
  return 1 + A.diffuserGain * (f.stallDiffuser - f.refDiffuser) - A.diffuserStallDrop * (d - f.stallDiffuser)
}

/** The aero at given ride heights (no springs), for a dynamic pressure's worth of nothing: areas only. */
function aeroAt(design: CarDesign, front: number, rear: number) {
  const c = CAR_CLASS[design.class]
  // Front wing: its slope times its angle, more of it the nearer the front sits to the road.
  const fw = c.frontWing
  const fwGround = 1 + A.frontWingGround * clamp((fw.height - front) / fw.height, -1, 1)
  const fwCl = fw.slope * stalled(design.frontWing, fw.stallDeg) * DEG
  const frontWing = Math.max(0, fw.area * fwCl * fwGround)
  const fwStall = Math.max(0, design.frontWing - fw.stallDeg)
  const fwDrag = fw.area * A.profileCd + (frontWing * frontWing) / (PI * A.efficiency * fw.aspect * fw.area) + fw.area * A.stallDrag * fwStall
  // Rear wing: camber plus slope times angle, over its area.
  const area = rearWingArea(design)
  const aspect = c.rearSpan / design.rearWing.chord
  const rwCl = A.rearCamber + A.rearSlope * stalled(design.rearWing.angle, A.rearStallDeg) * DEG
  const rearWing = Math.max(0, area * rwCl)
  const rwStall = Math.max(0, design.rearWing.angle - A.rearStallDeg)
  const rwDrag = area * A.profileCd + (rearWing * rearWing) / (PI * A.efficiency * aspect * area) + area * A.stallDrag * rwStall
  // Floor: the mean height sets its pull; the diffuser, the seal and the rake scale it; rake moves it forward.
  const mean = (front + rear) / 2
  const rakeDeg = ((rear - front) / c.wheelbase) / DEG
  const seal = A.unsealedShare + (1 - A.unsealedShare) * design.floorEdge
  const rake = clamp(1 + A.rakeGain * rakeDeg, 0.5, 1.6)
  const floor = c.floor.pull * floorFactor(design, mean) * diffuserFactor(design) * seal * rake
  const floorFront = clamp(A.floorFront + A.rakeShift * rakeDeg, 0.1, 0.8)
  const clAFront = frontWing + floor * floorFront - c.bodyLift.front
  const clARear = rearWing + floor * (1 - floorFront) - c.bodyLift.rear
  const drag = {
    body: c.bodyCdA,
    wings: fwDrag + rwDrag,
    floor: Math.max(0, floor) * A.floorDrag + design.floorEdge * A.edgeDrag,
    cooling: A.coolCdA * design.inlet,
  }
  return {
    clAFront,
    clARear,
    cdA: drag.body + drag.wings + drag.floor + drag.cooling,
    // The floor stalls under its critical height, or when either end of it is all but on the road.
    stalled: mean < c.floor.critHeight || Math.min(front, rear) < c.floor.critHeight * A.edgeStall,
    parts: { frontWing, rearWing, floor, body: -(c.bodyLift.front + c.bodyLift.rear), drag },
  }
}

/** The car's aero at a speed in air of this density: the springs squash under the downforce, and the two are solved together. */
export function carAero(design: CarDesign, speed: number, density: number): CarAero {
  const c = CAR_CLASS[design.class]
  const q = 0.5 * density * speed * speed
  let front = design.ride.front
  let rear = design.ride.rear
  let a = aeroAt(design, front, rear)
  for (let i = 0; i < LAP.passes; i++) {
    front = Math.max(A.plank, design.ride.front - (q * a.clAFront) / c.spring.front)
    rear = Math.max(A.plank, design.ride.rear - (q * a.clARear) / c.spring.rear)
    a = aeroAt(design, front, rear)
  }
  const clA = a.clAFront + a.clARear
  return {
    speed,
    cdA: a.cdA,
    clAFront: a.clAFront,
    clARear: a.clARear,
    clA,
    balance: clA > 0 ? a.clAFront / clA : 0.5,
    front,
    rear,
    stalled: a.stalled,
    parts: a.parts,
  }
}

/** The car's aero across the lap's speed range. */
export function carAeroTable(design: CarDesign, density: number): CarAero[] {
  return LAP.speeds.map((v) => carAero(design, v, density))
}

/** Read the table at a speed. */
function aeroLookup(table: readonly CarAero[]) {
  const vs = table.map((a) => a.speed)
  const cl = table.map((a) => a.clA)
  const cd = table.map((a) => a.cdA)
  const bal = table.map((a) => a.balance)
  return (v: number) => ({ clA: interp(vs, cl, v), cdA: interp(vs, cd, v), balance: interp(vs, bal, v) })
}

/** Grip lost to a balance outside the class's window: the driver lifts. 0 inside it. */
export function balanceLoss(design: CarDesign, balance: number): number {
  const w = CAR_CLASS[design.class].window
  const outside = Math.max(0, w.low - balance, balance - w.high) * 100
  return clamp(outside * LAP.balancePenalty, 0, 0.5)
}

/** Power lost to an engine running hot behind too small an inlet. 0 with enough air. */
export function heatLoss(design: CarDesign): number {
  const need = CAR_CLASS[design.class].coolNeed
  return clamp(((need - design.inlet) / 0.1) * LAP.heatPenalty, 0, 0.6)
}

export interface CornerResult {
  /** The corner's index among the segments, its radius, and the speed through it, m/s. */
  segment: number
  radius: number
  speed: number
  /** The balance at that speed, and the grip it cost (0 inside the window). */
  balance: number
  loss: number
}

export interface Lap {
  /** The lap time, s, and its length, m. */
  time: number
  length: number
  /** The fastest the car went, m/s, and every corner's speed. */
  top: number
  corners: CornerResult[]
  /** Speed at every step round the lap, m/s (for the replay and the charts). */
  speeds: number[]
  /**
   * The speed where the floor stalls and the car starts to porpoise, m/s,
   * or null if it never does on this lap. The driver lifts there to stop
   * the bouncing, so it caps the car's speed.
   */
  porpoise: number | null
  /** The lowest the car sat at its fastest, m. */
  lowest: number
  /** Power lost to heat (0 with enough inlet). */
  heat: number
}

/** The air on a race day: density, kg/m³. */
export function circuitDensity(circuit: Circuit, temperature = circuit.temperature): number {
  return densityAt(temperature, circuit.altitude)
}

/**
 * One flying lap. The lap is cut into steps; each corner step gets the
 * speed its grip holds (with downforce, and less grip if the balance is out
 * of the window), then a pass forward accelerates out of each corner and a
 * pass backward brakes into the next. Two laps forward give a flying start.
 */
export function lapTime(design: CarDesign, circuit: Circuit, temperature = circuit.temperature): Lap {
  const c = CAR_CLASS[design.class]
  const density = circuitDensity(circuit, temperature)
  const table = carAeroTable(design, density)
  const at = aeroLookup(table)
  const g = ATMOSPHERE.gravity
  const m = c.mass
  const heat = heatLoss(design)
  const power = c.power * (1 - heat)
  const step = LAP.step
  const porpoise = porpoiseSpeed(design, density)
  // The driver lifts where the floor stalls: nothing on the lap goes faster.
  const ceiling = porpoise ?? LAP.topSpeed

  // Each step's speed limit: a corner's grip, or the top speed on a straight.
  const limit: number[] = []
  const lengths: number[] = []
  const corners: CornerResult[] = []
  circuit.segments.forEach((seg, i) => {
    const len = segmentLength(seg)
    const n = Math.max(1, Math.round(len / step))
    let cap: number = ceiling
    if (seg.kind === 'corner') {
      // m v² / r = μ (m g + q ClA): solved with the downforce and balance at the speed it settles on.
      let v = Math.sqrt(c.grip * g * seg.radius)
      let loss = 0
      let bal = 0.5
      for (let k = 0; k < LAP.passes; k++) {
        const a = at(v)
        bal = a.balance
        loss = balanceLoss(design, bal)
        const mu = c.grip * (1 - loss)
        const denom = m / seg.radius - 0.5 * density * mu * a.clA
        v = denom > 0 ? Math.min(ceiling, Math.sqrt((mu * m * g) / denom)) : ceiling
      }
      cap = v
      corners.push({ segment: i, radius: seg.radius, speed: v, balance: bal, loss })
    }
    for (let k = 0; k < n; k++) {
      limit.push(cap)
      lengths.push(len / n)
    }
  })
  const count = limit.length

  const forces = (v: number) => {
    const a = at(v)
    const q = 0.5 * density * v * v
    return { down: q * a.clA, drag: q * a.cdA }
  }
  // Forward: accelerate as the engine and the driven tyres allow, never past a step's limit. Two laps for a flying start.
  const fwd = new Array<number>(count).fill(0)
  let v = limit[count - 1]!
  for (let lap = 0; lap < 2; lap++) {
    for (let i = 0; i < count; i++) {
      const f = forces(v)
      const traction = c.grip * c.driven * (m * g + f.down)
      const push = Math.min(power / Math.max(v, 1), traction)
      const accel = (push - f.drag - LAP.rolling * m * g) / m
      v = Math.min(limit[i]!, Math.sqrt(Math.max(0, v * v + 2 * accel * lengths[i]!)))
      fwd[i] = v
    }
  }
  // Backward: brake into each corner as late as the grip (and the drag) allows. Wraps once round.
  const speeds = fwd.slice()
  let w = speeds[0]!
  for (let lap = 0; lap < 2; lap++) {
    for (let i = count - 1; i >= 0; i--) {
      const f = forces(w)
      const decel = (c.grip * (m * g + f.down) + f.drag) / m
      w = Math.min(speeds[i]!, Math.sqrt(w * w + 2 * decel * lengths[i]!))
      speeds[i] = w
    }
  }
  let time = 0
  let top = 0
  let length = 0
  for (let i = 0; i < count; i++) {
    // The step at the mean of its end speeds (the speed on entry is the previous step's).
    const entry = speeds[(i + count - 1) % count]!
    const mean = (entry + speeds[i]!) / 2
    time += lengths[i]! / Math.max(mean, 1)
    top = Math.max(top, speeds[i]!)
    length += lengths[i]!
  }
  const fastest = carAero(design, top, density)
  // Porpoising only counts if the car got up to the speed where it starts.
  return { time, length, top, corners, speeds, porpoise: porpoise !== null && top >= porpoise - 0.5 ? porpoise : null, lowest: Math.min(fastest.front, fastest.rear), heat }
}

/**
 * The speed where the floor first stalls as downforce squashes the car
 * down onto it, m/s, or null if it never does up to the top speed. Found
 * a metre per second at a time, then halved down to a tenth.
 */
export function porpoiseSpeed(design: CarDesign, density: number): number | null {
  let lo: number = LAP.speeds[0]!
  if (carAero(design, lo, density).stalled) return lo
  for (let v = lo + 1; v <= LAP.topSpeed; v++) {
    if (carAero(design, v, density).stalled) {
      let hi = v
      while (hi - lo > 0.1) {
        const mid = (lo + hi) / 2
        if (carAero(design, mid, density).stalled) hi = mid
        else lo = mid
      }
      return lo
    }
    lo = v
  }
  return null
}

/** Seconds a design takes off the team's current car's lap (positive: faster). */
export function lapGain(design: CarDesign, old: CarDesign, circuit: Circuit): number {
  return lapTime(old, circuit).time - lapTime(design, circuit).time
}

export interface CarRuleBreak {
  rule: 'rideFront' | 'rideRear' | 'chord'
  part: 'ride.front' | 'ride.rear' | 'rearWing.chord'
  value: number
  limit: number
}

/** The Tarnovian Motor Racing Federation's rulebook: the skid plank's ride height at each axle, and the rear wing's chord. */
export function checkCarRules(design: CarDesign): CarRuleBreak[] {
  const r = CAR_RULES[design.class]
  const out: CarRuleBreak[] = []
  if (design.ride.front < r.minRide - 1e-9) out.push({ rule: 'rideFront', part: 'ride.front', value: design.ride.front, limit: r.minRide })
  if (design.ride.rear < r.minRide - 1e-9) out.push({ rule: 'rideRear', part: 'ride.rear', value: design.ride.rear, limit: r.minRide })
  if (design.rearWing.chord > r.maxChord + 1e-9) out.push({ rule: 'chord', part: 'rearWing.chord', value: design.rearWing.chord, limit: r.maxChord })
  return out
}

/** The car the scrutineers pass: ride heights raised to the plank's minimum, the rear wing trimmed to the chord limit. */
export function scrutineered(design: CarDesign): CarDesign {
  if (checkCarRules(design).length === 0) return design
  const r = CAR_RULES[design.class]
  return {
    ...design,
    ride: { front: Math.max(design.ride.front, r.minRide), rear: Math.max(design.ride.rear, r.minRide) },
    rearWing: { ...design.rearWing, chord: Math.min(design.rearWing.chord, r.maxChord) },
  }
}

/** Downforce at a speed in kilograms (what the pull would lift), for readouts. */
export function downforceKg(aero: CarAero, density: number): number {
  return (0.5 * density * aero.speed * aero.speed * aero.clA) / ATMOSPHERE.gravity
}

/** How sharply the floor's pull changes near the critical height, for the shaper's warning: 0 well clear, 1 at or under it. */
export function stallRisk(design: CarDesign, height: number): number {
  const f = CAR_CLASS[design.class].floor
  return smoothstep(f.critHeight * 1.6, f.critHeight, height)
}
