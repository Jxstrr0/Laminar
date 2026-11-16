import { describe, expect, it } from 'vitest'
import { DRONE_CLASS, DRONE_COURSES, DRONE_TUNNEL, STOCK_DRONE, type DroneDesign } from '../src/data/drone'
import { downwashLoss, droneDrag, droneRace, pitchMoment } from '../src/sim/drone'
import { correctDrone, droneEvent, droneReadings, forecastDrone, isDroneRun, prepareDrone, readDrone, twistArea, type DroneProps } from '../src/sim/droneTunnel'
import { MODEL_SHOP, STANDARD_ORDER } from '../src/data/model'
import { TUNNEL_UPGRADES, UNIVERSITY_TUNNEL } from '../src/data/tunnel'
import { strains } from '../src/sim/failure'
import { newLab } from '../src/sim/lab'
import { forMaker, makerScales, matchedSpeed, quote, scaleFamily } from '../src/sim/modelShop'
import { newRecorder, runCost, stepRecorder, type RunSample } from '../src/sim/run'
import { soundLab } from '../src/persist/save'
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

describe('a quad model on the Tunnel screen (PR 10d)', () => {
  it('keeps the twist in run samples and reads it back for the forecast', () => {
    const p = prepareDrone(GOOD, MODEL, 'stopped')
    const rng = new Rng(4)
    const samples: RunSample[] = [0, 60].map((tiltDeg, i) => {
      const r = readDrone(p, IDEAL, { speed: 30, tiltDeg }, rng)
      return { t: i, speed: 30, yawDeg: tiltDeg, cdA: r.cdA, cyA: 0, dragN: r.dragN, twist: r.twist, steady: true }
    })
    // A sample taken while the sting was still turning is left out.
    samples.push({ ...samples[0]!, steady: false })
    const run = { samples }
    expect(isDroneRun(run)).toBe(true)
    expect(isDroneRun({ samples: [{ ...samples[0]!, twist: undefined }] })).toBe(false)
    const back = droneReadings([run])
    expect(back).toHaveLength(2)
    expect(back[1]!.twist).toBeCloseTo(twistArea(GOOD, 60 * DEG), 9)
    expect(back[1]!.downwash).toBeNull()
    // The same readings forecast the same race as the readings themselves.
    const direct = forecastDrone([0, 60].map((tiltDeg) => readDrone(p, IDEAL, { speed: 30, tiltDeg }, new Rng(4))), GOOD, STOCK, course)!
    expect(forecastDrone(back, GOOD, STOCK, course)!.time).toBeCloseTo(direct.time!, 6)
  })

  it('a save keeps a quad run’s twist and downwash, and refuses a broken one', () => {
    const lab = newLab(GOOD)
    const sample: RunSample = { t: 0, speed: 30, yawDeg: 60, cdA: 0.03, cyA: 0, dragN: 16, twist: 4e-4, downwash: 0.05, steady: true }
    const run = { id: 1, model: 'rider', samples: [sample], duration: 10, energyKWh: 0.01, topSpeed: 30 }
    const kept = soundLab(JSON.parse(JSON.stringify({ ...lab, runs: [run], nextRunId: 2 })), GOOD)!
    expect(kept.runs[0]!.samples[0]!.twist).toBe(4e-4)
    expect(kept.runs[0]!.samples[0]!.downwash).toBe(0.05)
    expect(soundLab(JSON.parse(JSON.stringify({ ...lab, runs: [{ ...run, samples: [{ ...sample, twist: 'x' }] }], nextRunId: 2 })), GOOD)).toBeNull()
  })

  it('builds a quad full size: its own scale list, every maker, and the Reynolds number matched in the fan', () => {
    expect(newLab(GOOD).order.scale).toBe(1)
    expect(scaleFamily(1)).toBe('drone')
    expect(makerScales('shop', 'drone')).toEqual([1])
    expect(makerScales('resin', 'drone')).toEqual([1])
    // Moving the order to another maker keeps it full size.
    expect(forMaker({ ...STANDARD_ORDER, scale: 1 }, 'fdm').scale).toBe(1)
    expect(quote({ ...STANDARD_ORDER, scale: 1 }).price).toBe(MODEL_SHOP.scale[1].price)
    // About a racer's speed in the course's air: within the university fan's reach.
    expect(Math.abs(matchedSpeed(1, droneEvent(course)) - DRONE_TUNNEL.matchSpeed)).toBeLessThan(2)
    expect(matchedSpeed(1, droneEvent(course))).toBeLessThan(UNIVERSITY_TUNNEL.topSpeed)
  })

  it('tips on a slim sting that holds the flat-out lean in the university’s fan, but not in a big fan', () => {
    const model = { order: { ...STANDARD_ORDER, scale: 1 as const }, design: GOOD }
    const sting = (loadN: number) => strains(model, 40, loadN).find((s) => s.part === 'sting')!.level
    const load = (speed: number, tiltDeg: number) => 0.5 * 1.225 * speed * speed * droneDrag(GOOD, tiltDeg * DEG).cdA
    expect(sting(load(UNIVERSITY_TUNNEL.topSpeed, DRONE_TUNNEL.tilt.max))).toBeLessThan(0.9)
    expect(sting(load(TUNNEL_UPGRADES.fan.topSpeed, DRONE_TUNNEL.tilt.max))).toBeGreaterThan(1)
    // The dial reaches past the racer's flat-out lean.
    expect(DRONE_TUNNEL.tilt.max).toBeGreaterThan(70)
  })
})

describe('a powered quad model (PR 10e)', () => {
  it('costs more to build, with its motors, and every run with the props spinning costs more', () => {
    const plain = quote({ ...STANDARD_ORDER, scale: 1 })
    const powered = quote({ ...STANDARD_ORDER, scale: 1, powered: true })
    expect(powered.price - plain.price).toBe(MODEL_SHOP.motors.price)
    expect(powered.days - plain.days).toBe(MODEL_SHOP.motors.days)
    // The recorder marks a run with the props spinning, and it's billed the extra.
    let rec = newRecorder()
    rec = stepRecorder(rec, 20, 0.01, 'rider', 'university', true).recorder
    const run = rec.run!
    expect(run.powered).toBe(true)
    expect(runCost(run) - runCost({ ...run, powered: undefined })).toBeCloseTo(DRONE_TUNNEL.poweredRun, 6)
    expect(stepRecorder(newRecorder(), 20, 0.01, 'rider').recorder.run!.powered).toBeUndefined()
  })

  it('a save keeps a powered order and a powered run', () => {
    const lab = { ...newLab(GOOD), order: { ...STANDARD_ORDER, scale: 1 as const, powered: true } }
    const run = { id: 1, model: 'rider', samples: [], duration: 10, energyKWh: 0.01, topSpeed: 30, powered: true }
    const back = soundLab(JSON.parse(JSON.stringify({ ...lab, runs: [run], nextRunId: 2 })), GOOD)!
    expect(back.order.powered).toBe(true)
    expect(back.runs[0]!.powered).toBe(true)
    expect(soundLab(JSON.parse(JSON.stringify({ ...lab, runs: [{ ...run, powered: 'yes' }], nextRunId: 2 })), GOOD)).toBeNull()
  })

  it('reads the downwash with its props spinning, so the forecast sees what the fairings save', () => {
    const truth = droneRace(GOOD, course).time!
    const stopped = forecast(GOOD, 'stopped', SWEEP, REAL)
    const powered = forecast(GOOD, 'powered', SWEEP, REAL)
    expect(stopped.downwashMeasured).toBe(false)
    expect(powered.downwashMeasured).toBe(true)
    expect(Math.abs(powered.time! - truth)).toBeLessThan(Math.abs(stopped.time! - truth))
  })
})
