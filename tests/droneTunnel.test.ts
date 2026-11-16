import { describe, expect, it } from 'vitest'
import { DRONE_CLASS, DRONE_COURSES, DRONE_TUNNEL, STOCK_DRONE, type DroneDesign } from '../src/data/drone'
import { downwashLoss, droneDrag, droneRace, pitchMoment } from '../src/sim/drone'
import { correctDrone, droneEvent, forecastDrone, prepareDrone, readDrone, twistArea, type DroneProps } from '../src/sim/droneTunnel'
import { DEG } from '../src/sim/num'
import { Rng } from '../src/sim/rng'
import type { ModelSpec, TunnelSpec } from '../src/sim/views'

const course = DRONE_COURSES.lugovoy
const STOCK = STOCK_DRONE.racer
/** The sorted club racer: short pod raked to the racing tilt, the vents it needs, arms faired. */
const GOOD: DroneDesign = { ...STOCK, pod: { length: 0.12, rake: 70, vents: DRONE_CLASS.racer.coolNeed }, arms: 1 }
/** Raked hard with a long pod: fine head-on, but it tumbles braking for a corner. */
const TWISTY: DroneDesign = { ...GOOD, pod: { ...GOOD.pod, length: 0.2 } }

const IDEAL: TunnelSpec = { turbulence: 0, balanceNoise: 0 }
const REAL: TunnelSpec = { turbulence: 0, balanceNoise: 0.01 }
const MODEL: ModelSpec = { scale: 1, finish: 'sanded', accuracy: 0, seed: 1 }
const SWEEP = [-40, 0, 30, 60, 70]

/** Read a model through a tilt sweep and forecast the race. */
function forecast(design: DroneDesign, props: DroneProps, tilts = SWEEP, tunnel = IDEAL) {
  const prepared = prepareDrone(design, MODEL, props)
  const rng = new Rng(3)
  const reads = tilts.map((tiltDeg) => readDrone(prepared, tunnel, { speed: 30, tiltDeg }, rng))
  return forecastDrone(reads, design, STOCK, course)!
}

describe('a quad model in the tunnel', () => {
  it('reads the drag and the twist true in an ideal tunnel, at any tilt, tested full size', () => {
    const p = prepareDrone(GOOD, MODEL, 'stopped')
    for (const tiltDeg of [-30, 0, 45, 70]) {
      const r = readDrone(p, IDEAL, { speed: 30, tiltDeg }, new Rng(1))
      expect(r.cdA).toBeCloseTo(droneDrag(GOOD, tiltDeg * DEG).cdA, 9)
      // The twist per unit dynamic pressure is the sim's pitching moment over q.
      expect(r.twist).toBeCloseTo(pitchMoment(GOOD, 30, tiltDeg * DEG, 1) / (0.5 * 900), 9)
      expect(r.dragN).toBeCloseTo(0.5 * 1.225 * 900 * r.cdA, 9)
    }
    // Head-on to the pod, no twist.
    expect(twistArea(GOOD, 70 * DEG)).toBeCloseTo(0, 9)
  })

  it('with the props stopped reads no downwash; spinning, it reads what the arms take', () => {
    expect(readDrone(prepareDrone(GOOD, MODEL, 'stopped'), REAL, { speed: 30, tiltDeg: 60 }, new Rng(1)).downwash).toBeNull()
    const p = prepareDrone(GOOD, MODEL, 'powered')
    const rng = new Rng(4)
    const xs = Array.from({ length: 200 }, () => readDrone(p, REAL, { speed: 30, tiltDeg: 60 }, rng).downwash!)
    const m = xs.reduce((s, x) => s + x, 0) / xs.length
    expect(Math.abs(m - downwashLoss(GOOD))).toBeLessThan(0.0015)
  })

  it('takes the sting’s tare and the blockage off again', () => {
    const tunnel: TunnelSpec = { turbulence: 0, balanceNoise: 0, quirks: { blockage: 1.1, turbulence: 0, mountCdA: { sting: 0.003, posts: 0.004 } }, section: { width: 1.2, height: 0.9 } }
    const p = prepareDrone(GOOD, MODEL, 'stopped')
    const raw = readDrone(p, tunnel, { speed: 30, tiltDeg: 30, mount: 'sting' }, new Rng(1))
    expect(raw.cdA).toBeGreaterThan(droneDrag(GOOD, 30 * DEG).cdA + 0.002)
    const fixed = correctDrone(raw, { tare: 0.003, blockageK: 1.1 }, p, 1.2 * 0.9)
    expect(fixed.cdA).toBeCloseTo(droneDrag(GOOD, 30 * DEG).cdA, 9)
    expect(fixed.twist).toBeCloseTo(twistArea(GOOD, 30 * DEG), 9)
  })
})

describe('the forecast', () => {
  it('is null until something is read, and matches the race on a powered model in an ideal tunnel', () => {
    expect(forecastDrone([], GOOD, STOCK, course)).toBeNull()
    const f = forecast(GOOD, 'powered')
    expect(f.time!).toBeCloseTo(droneRace(GOOD, course).time!, 6)
    expect(f.gain!).toBeCloseTo(droneRace(STOCK, course).time! - f.time!, 9)
    expect(f.downwashMeasured).toBe(true)
    expect(f.twist!.scale).toBeCloseTo(1, 9)
    expect(f.tumble).toBeNull()
  })

  it('with the props stopped takes the maker’s bare-arm downwash: right for bare arms, slow for faired ones', () => {
    const bare = { ...GOOD, arms: 0 }
    expect(forecast(bare, 'stopped').time!).toBeCloseTo(droneRace(bare, course).time!, 6)
    const f = forecast(GOOD, 'stopped')
    expect(f.downwashMeasured).toBe(false)
    expect(f.downwash).toBe(DRONE_TUNNEL.bookDownwash)
    // The trap: the faired quad reads slower than it is, by more than half a second...
    expect(f.time! - droneRace(GOOD, course).time!).toBeGreaterThan(0.5)
    // ...and even slower than the same quad with bare arms, though truly it's faster.
    expect(f.time!).toBeGreaterThan(forecast(bare, 'stopped').time!)
    expect(droneRace(GOOD, course).time!).toBeLessThan(droneRace(bare, course).time!)
  })

  it('sees a tumble on the brakes only if a reading met the pod at an angle', () => {
    expect(droneRace(TWISTY, course).tumble).not.toBeNull()
    const swept = forecast(TWISTY, 'powered')
    expect(swept.time).toBeNull()
    expect(swept.tumble).not.toBeNull()
    expect(swept.twist!.braking).toBe(true)
    expect(swept.twist!.share).toBeGreaterThan(1)
    // Read only at the racing tilt, the pod is head-on: no twist to measure, and the forecast finishes the race.
    const headOn = forecast(TWISTY, 'powered', [70])
    expect(headOn.twist).toBeNull()
    expect(headOn.time).not.toBeNull()
  })

  it('keeps close to the truth through a real balance’s noise, and is the same every time', () => {
    const f = forecast(GOOD, 'powered', [-40, -20, 0, 20, 40, 60, 70, 70, 70], REAL)
    expect(Math.abs(f.time! - droneRace(GOOD, course).time!)).toBeLessThan(0.4)
    expect(forecast(GOOD, 'stopped', SWEEP, REAL)).toEqual(forecast(GOOD, 'stopped', SWEEP, REAL))
  })

  it('knows the heat from the controller maker’s data', () => {
    const shut = { ...GOOD, pod: { ...GOOD.pod, vents: 0 } }
    const f = forecast(shut, 'powered')
    expect(f.hotAt).toBe(DRONE_CLASS.racer.heatAfter)
    expect(f.heat).toBeGreaterThan(0)
  })

  it('matches a model’s Reynolds number to the course’s air at racing speed', () => {
    const e = droneEvent(course)
    expect(e.altitude).toBe(course.altitude)
    expect(e.riderSpeed).toBe(DRONE_TUNNEL.matchSpeed)
  })
})
