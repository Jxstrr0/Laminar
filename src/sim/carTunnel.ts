/**
 * The racing car in the tunnel and the forecast (plan sections 6.3, 6.8 and
 * 9.2, PR 9k).
 *
 * - readCar: what the balance says about a scale model held on posts: drag,
 *   and downforce at each axle, scaled to full size, through the tunnel's
 *   quirks (blockage, the posts' own drag) and the balance's noise. The
 *   model doesn't squat at speed as the real car does: the mount lowers it
 *   (the drop) instead. The floor is read through the tunnel's floor
 *   (CAR_TUNNEL.floor): a still floor or a ground board shows it stalling
 *   sooner and pulling less; a rolling road shows the truth. Still wheels
 *   read draggy until a rolling road spins them.
 * - forecastLap: a lap on the aero map those readings make. At each speed
 *   the car's springs (known from the team) squash it, and the map is read
 *   at that drop. If a lower reading lost downforce, the map has found the
 *   floor's stall: the car porpoises at the speed that squashes it there.
 *   If the car squats lower than any reading, the map is held flat and the
 *   forecast says to read lower.
 */
import { AIR } from '../data/air'
import { CAR_AERO, CAR_CLASS, CAR_DESK, CAR_TUNNEL, LAP, type CarDesign } from '../data/car'
import type { Circuit } from '../data/circuits'
import { aeroAt, circuitDensity, lapOn, lapTime, type FloorView, type LapAero } from './car'
import { gaussian } from './noise'
import { interp } from './num'
import { blockageFactor, type MountKind } from './quirks'
import { Rng } from './rng'
import type { ModelSpec, TunnelSpec } from './views'

/** The floor under a car model: still, the model shop's ground board, or your tunnel's rolling road. */
export type CarFloor = keyof typeof CAR_TUNNEL.floor

/** Which floor a car model sits over: a rolling road if the tunnel has one, else a board if the shop fitted it. */
export function carFloor(rollingRoad: boolean, board: boolean): CarFloor {
  return rollingRoad ? 'rolling' : board ? 'board' : 'still'
}

/** A built car model: its build errors and the floor it sits over, ready to read many times a second. */
export interface PreparedCar {
  design: CarDesign
  scale: number
  /** The model's downforce and drag came out this much bigger (or smaller) than drawn. */
  down: number
  drag: number
  floor: CarFloor
}

export function prepareCar(design: CarDesign, model: ModelSpec, floor: CarFloor): PreparedCar {
  const rng = new Rng(model.seed).fork('car-build')
  return { design, scale: model.scale, down: 1 + model.accuracy * gaussian(rng), drag: 1 + model.accuracy * gaussian(rng), floor }
}

export interface CarRun {
  speed: number
  /** How far the mount has lowered the model below its static ride height, full scale, m. */
  drop: number
  mount?: MountKind
}

/** One balance reading, scaled to full size. */
export interface CarReading {
  drop: number
  /** Drag area and downforce area at each axle, m². */
  cdA: number
  clAFront: number
  clARear: number
  /** The model's drag and downforce as the balance felt them, N. */
  dragN: number
  downN: number
}

/** The ride heights the model sits at on the mount at a drop: never under the skid plank. */
export function heightsAt(design: CarDesign, drop: number): { front: number; rear: number } {
  return { front: Math.max(CAR_AERO.plank, design.ride.front - drop), rear: Math.max(CAR_AERO.plank, design.ride.rear - drop) }
}

/** The deepest the mount lowers this class's model, m. */
export function maxDrop(design: CarDesign): number {
  return CAR_TUNNEL.drop[design.class]
}

/**
 * One balance reading of a prepared car at a speed and drop. Draws its
 * noise from `rng`, so repeat readings on the same stream scatter.
 */
export function readCar(prepared: PreparedCar, tunnel: TunnelSpec, run: CarRun, rng: Rng): CarReading {
  const { design, scale } = prepared
  const s2 = scale * scale
  const h = heightsAt(design, run.drop)
  const view: FloorView = CAR_TUNNEL.floor[prepared.floor]
  const a = aeroAt(design, h.front, h.rear, view)
  const q = tunnel.quirks
  const section = tunnel.section
  const blocked = q && section ? blockageFactor(q.blockage, CAR_CLASS[design.class].frontal * s2, section.width * section.height) : 1
  const mount = q && run.mount ? q.mountCdA[run.mount] / s2 : 0
  const wheels = prepared.floor === 'rolling' ? 0 : CAR_TUNNEL.staticWheels
  const noise = () => 1 + tunnel.balanceNoise * gaussian(rng)
  const cdA = ((a.cdA * prepared.drag + wheels) * blocked + mount) * noise()
  const clAFront = a.clAFront * prepared.down * blocked * noise()
  const clARear = a.clARear * prepared.down * blocked * noise()
  const qN = 0.5 * AIR.density * run.speed * run.speed
  return { drop: run.drop, cdA, clAFront, clARear, dragN: qN * cdA * s2, downN: qN * (clAFront + clARear) * s2 }
}

/** One measured drop: the readings there, averaged. */
export interface MapPoint {
  drop: number
  cdA: number
  clAFront: number
  clARear: number
  n: number
}

/** Readings pooled by drop, smallest drop (highest car) first. */
export function aeroMap(readings: readonly Pick<CarReading, 'drop' | 'cdA' | 'clAFront' | 'clARear'>[]): MapPoint[] {
  const out: MapPoint[] = []
  for (const r of [...readings].sort((a, b) => a.drop - b.drop)) {
    const last = out[out.length - 1]
    if (last && Math.abs(r.drop - last.drop) <= CAR_TUNNEL.sameDrop) {
      const n = last.n + 1
      last.drop += (r.drop - last.drop) / n
      last.cdA += (r.cdA - last.cdA) / n
      last.clAFront += (r.clAFront - last.clAFront) / n
      last.clARear += (r.clARear - last.clARear) / n
      last.n = n
    } else out.push({ drop: r.drop, cdA: r.cdA, clAFront: r.clAFront, clARear: r.clARear, n: 1 })
  }
  return out
}

/** The map read at a drop: straight lines between the drops read, held flat past the ends. */
function mapAt(points: readonly MapPoint[], drop: number) {
  const ds = points.map((p) => p.drop)
  return {
    cdA: interp(ds, points.map((p) => p.cdA), drop),
    clAFront: interp(ds, points.map((p) => p.clAFront), drop),
    clARear: interp(ds, points.map((p) => p.clARear), drop),
  }
}

export interface LapForecast {
  /** The lap on the map, s, and its gain on the team's current car, s. */
  time: number
  gain: number
  /** The speed where the map's floor stalls and the car porpoises, m/s, or null if the map shows no stall the car reaches. */
  porpoise: number | null
  /** How far the car squats at its fastest, and the deepest drop read, m. */
  need: number
  have: number
  /** True when the map reaches as low as the car squats (or it has found the stall). */
  covered: boolean
  /** The balance at the read speed's squat, for the screen. */
  balance: number
}

/**
 * A lap on the tunnel's aero map, against the team's current car (their
 * own data, so the truth). Null until at least one drop has been read.
 */
export function forecastLap(readings: readonly Pick<CarReading, 'drop' | 'cdA' | 'clAFront' | 'clARear'>[], design: CarDesign, old: CarDesign, circuit: Circuit): LapForecast | null {
  const points = aeroMap(readings)
  if (points.length === 0) return null
  const c = CAR_CLASS[design.class]
  const density = circuitDensity(circuit)
  // How far the car squats at a speed: the springs at each axle under the map's downforce there, solved together.
  const squat = (v: number) => {
    const q = 0.5 * density * v * v
    let d = 0
    for (let i = 0; i < LAP.passes; i++) {
      const m = mapAt(points, d)
      d = Math.max(0, ((q * m.clAFront) / c.spring.front + (q * m.clARear) / c.spring.rear) / 2)
    }
    return d
  }
  const at: LapAero = (v) => {
    const m = mapAt(points, squat(v))
    const clA = m.clAFront + m.clARear
    return { clA, cdA: m.cdA, balance: clA > 0 ? m.clAFront / clA : 0.5 }
  }
  // The stall, if the map has found it: a lower reading with less downforce than the one above it.
  const total = points.map((p) => p.clAFront + p.clARear)
  let peak = 0
  for (let i = 1; i < total.length; i++) if (total[i]! > total[peak]!) peak = i
  const stallSeen = peak < points.length - 1
  let porpoise: number | null = null
  if (stallSeen) {
    const edge = points[peak]!.drop
    for (let v = LAP.speeds[0]!; v <= LAP.topSpeed; v++) {
      if (squat(v) > edge) {
        let lo = v - 1
        let hi = v
        while (hi - lo > 0.1) {
          const mid = (lo + hi) / 2
          if (squat(mid) > edge) hi = mid
          else lo = mid
        }
        porpoise = lo
        break
      }
    }
  }
  const lap = lapOn(design, circuit, at, porpoise)
  const theirs = lapTime(old, circuit).time
  const need = squat(lap.top)
  const have = points[points.length - 1]!.drop
  return {
    time: lap.time,
    gain: theirs - lap.time,
    porpoise: lap.porpoise,
    need,
    have,
    covered: stallSeen || need <= have + CAR_TUNNEL.coverSlack,
    balance: at(CAR_DESK.readSpeed).balance,
  }
}
