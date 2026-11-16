import { describe, expect, it } from 'vitest'
import { RECORD_TUNNEL, STOCK_RECORD, type RecordDesign } from '../src/data/record'
import { SALT_FLATS } from '../src/data/saltFlats'
import { crossHeld, frontKept, flatDensity, recordAero, sideCentre, stillDay, twoWay } from '../src/sim/record'
import { correctRecord, forecastRecord, isRecordRun, prepareRecord, readRecord, recordEvent, recordReadings, type RecordFloor } from '../src/sim/recordTunnel'
import { strains } from '../src/sim/failure'
import { STANDARD_ORDER } from '../src/data/model'
import { newLab } from '../src/sim/lab'
import type { RunSample } from '../src/sim/run'
import { Rng } from '../src/sim/rng'
import type { ModelSpec, TunnelSpec } from '../src/sim/views'

const flat = SALT_FLATS.sukhoye
const STOCK = STOCK_RECORD.streamliner
const GOOD: RecordDesign = { ...STOCK, nose: { length: 2.7, droop: 4 }, canopy: 0.25, fin: 1, fairings: 1 }
/** Drooped just enough on the salt; a still floor hides that it isn't. */
const EDGY: RecordDesign = { ...GOOD, nose: { length: 2.7, droop: 1.5 } }

const IDEAL: TunnelSpec = { turbulence: 0, balanceNoise: 0 }
const MODEL: ModelSpec = { scale: 1 / 8, finish: 'sanded', accuracy: 0, seed: 1 }
const YAWS = [0, -6, -4, 4, 6]

/** Read a model straight ahead and through a yaw sweep, and forecast the record. */
function forecast(design: RecordDesign, floor: RecordFloor, yaws = YAWS, tunnel = IDEAL) {
  const prepared = prepareRecord(design, MODEL, floor)
  const rng = new Rng(3)
  const reads = yaws.map((yawDeg) => readRecord(prepared, tunnel, { speed: 50, yawDeg }, rng))
  return forecastRecord(reads, design, STOCK, flat)!
}

describe('a record model in the tunnel', () => {
  it('reads the truth in an ideal tunnel over a rolling road, and places the side force only at yaw', () => {
    const p = prepareRecord(GOOD, MODEL, 'rolling')
    const a = recordAero(GOOD)
    const straight = readRecord(p, IDEAL, { speed: 50, yawDeg: 0 }, new Rng(1))
    expect(straight.cdA).toBeCloseTo(a.cdA, 9)
    expect(straight.liftFront).toBeCloseTo(a.liftFront, 9)
    expect(straight.cyA).toBe(0)
    expect(straight.centre).toBeNull()
    const yawed = readRecord(p, IDEAL, { speed: 50, yawDeg: 6 }, new Rng(1))
    expect(yawed.cyA).toBeGreaterThan(0)
    expect(yawed.centre!).toBeCloseTo(sideCentre(GOOD).centre, 9)
    // The model's drag, felt at model size.
    expect(straight.dragN).toBeCloseTo(0.5 * 1.225 * 2500 * a.cdA * (1 / 64), 1)
  })

  it('places the side force more surely the further it yaws', () => {
    const p = prepareRecord(GOOD, MODEL, 'rolling')
    const real: TunnelSpec = { turbulence: 0, balanceNoise: 0.01 }
    const spread = (yaw: number) => {
      const rng = new Rng(9)
      const xs = Array.from({ length: 200 }, () => readRecord(p, real, { speed: 50, yawDeg: yaw }, rng).centre!)
      const m = xs.reduce((s, x) => s + x, 0) / xs.length
      return Math.sqrt(xs.reduce((s, x) => s + (x - m) * (x - m), 0) / xs.length)
    }
    expect(spread(2)).toBeGreaterThan(spread(8) * 2)
    expect(spread(1)).toBeGreaterThan(0.4)
    expect(spread(8)).toBeLessThan(0.15)
  })

  it('reads the nose’s lift low over a still floor, less so over the shop’s board', () => {
    const lift = (floor: RecordFloor) => readRecord(prepareRecord(GOOD, MODEL, floor), IDEAL, { speed: 50, yawDeg: 0 }, new Rng(1)).liftFront
    expect(lift('still')).toBeCloseTo(recordAero(GOOD).liftFront * RECORD_TUNNEL.floor.still.lift, 9)
    expect(lift('still')).toBeLessThan(lift('board'))
    expect(lift('board')).toBeLessThan(lift('rolling'))
  })

  it('reads still wheels draggy, less so when faired, and true on a rolling road', () => {
    const drag = (d: RecordDesign, floor: RecordFloor) => readRecord(prepareRecord(d, MODEL, floor), IDEAL, { speed: 50, yawDeg: 0 }, new Rng(1)).cdA - recordAero(d).cdA
    expect(drag({ ...STOCK, fairings: 0 }, 'still')).toBeCloseTo(RECORD_TUNNEL.staticWheels, 9)
    expect(drag({ ...STOCK, fairings: 1 }, 'still')).toBeLessThan(drag({ ...STOCK, fairings: 0 }, 'still'))
    expect(drag(STOCK, 'rolling')).toBeCloseTo(0, 9)
  })

  it('takes off the strut’s tare and the blockage when calibration has found them', () => {
    const tunnel: TunnelSpec = { turbulence: 0, balanceNoise: 0, quirks: { blockage: 1.2, turbulence: 0.01, mountCdA: { strut: 0.004, sting: 0.003, 'rear-strut': 0.003 } as never }, section: { width: 2.4, height: 1.8 } }
    const p = prepareRecord(GOOD, MODEL, 'rolling')
    const r = readRecord(p, tunnel, { speed: 50, yawDeg: 4, mount: 'strut' as never }, new Rng(1))
    expect(r.cdA).toBeGreaterThan(recordAero(GOOD).cdA)
    expect(correctRecord(r, { tare: null, blockageK: null }, p, 4.32)).toEqual(r)
    const fixed = correctRecord(r, { tare: 0.004, blockageK: 1.2 }, p, 4.32)
    expect(fixed.cdA).toBeCloseTo(recordAero(GOOD).cdA, 6)
    expect(fixed.liftFront).toBeCloseTo(recordAero(GOOD).liftFront, 6)
  })
})

describe('the record forecast', () => {
  it('matches the truth on the usual day from an ideal tunnel over a rolling road', () => {
    const f = forecast(GOOD, 'rolling')
    const truth = twoWay(GOOD, flat, stillDay(flat)).mean!
    expect(f.speed!).toBeCloseTo(truth, 0)
    expect(f.gain!).toBeCloseTo(truth - twoWay(STOCK, flat, stillDay(flat)).mean!, 0)
    expect(f.crossHeld!).toBeCloseTo(crossHeld(GOOD), 0)
    expect(f.noseKept).toBeCloseTo(frontKept(GOOD, f.top + 2.5, flatDensity(flat)), 6)
  })

  it('can’t say how the car points without a yaw sweep', () => {
    const f = forecast(GOOD, 'rolling', [0])
    expect(f.crossHeld).toBeNull()
    expect(f.speed).not.toBeNull()
    // So it doesn't see a car with no fin wander either.
    expect(forecast({ ...GOOD, fin: 0 }, 'rolling', [0]).abort).toBeNull()
    expect(forecast({ ...GOOD, fin: 0 }, 'rolling').abort?.cause).toBe('wander')
  })

  it('over a still floor misses a nose that goes light on the salt', () => {
    expect(twoWay(EDGY, flat, stillDay(flat)).runs[0].abort?.cause).toBe('lift')
    expect(forecast(EDGY, 'rolling').abort?.cause).toBe('lift')
    const still = forecast(EDGY, 'still')
    expect(still.abort).toBeNull()
    expect(still.speed).not.toBeNull()
  })

  it('never sees the air squeeze: it leaves the drag rise out', () => {
    // The same readings forecast the same run with the squeeze left out.
    const f = forecast(GOOD, 'rolling')
    const plain = twoWay(GOOD, flat, stillDay(flat), { squeeze: false }).mean!
    expect(f.speed!).toBeCloseTo(plain, 0)
    expect(forecastRecord([], GOOD, STOCK, flat)).toBeNull()
  })

  it('says when it ran past the squeeze it can’t see: a jet car, not a streamliner', () => {
    // A streamliner barely reaches the squeeze: the forecast stands.
    expect(forecast(GOOD, 'rolling').squeezed).toBe(false)
    // The team's jet car reads far faster than it runs: the forecast says so.
    const jet = STOCK_RECORD.jet
    const prepared = prepareRecord(jet, MODEL, 'rolling')
    const rng = new Rng(3)
    const f = forecastRecord(YAWS.map((yawDeg) => readRecord(prepared, IDEAL, { speed: 50, yawDeg }, rng)), jet, jet, flat)!
    expect(f.squeezed).toBe(true)
    expect(f.topMach).toBeGreaterThan(f.squeezeMach)
    expect(f.speed!).toBeGreaterThan(twoWay(jet, flat, stillDay(flat)).mean! + 50 / 3.6)
  })
})

describe('a record model on the Tunnel screen (PR 9s)', () => {
  it('keeps its lift and side-force centre in run samples, and reads them back for the forecast', () => {
    const p = prepareRecord(GOOD, MODEL, 'rolling')
    const rng = new Rng(4)
    const samples: RunSample[] = [0, 6].map((yawDeg, i) => {
      const r = readRecord(p, IDEAL, { speed: 40, yawDeg }, rng)
      const s: RunSample = { t: i, speed: 40, yawDeg, cdA: r.cdA, cyA: r.cyA, dragN: r.dragN, clA: r.liftFront + r.liftRear, liftFront: r.liftFront, steady: true }
      if (r.centre !== null) s.centre = r.centre
      return s
    })
    // A sample taken while the fan was still spinning up is left out.
    samples.push({ ...samples[0]!, steady: false })
    const run = { samples }
    expect(isRecordRun(run)).toBe(true)
    expect(isRecordRun({ samples: [{ ...samples[0]!, liftFront: undefined }] })).toBe(false)
    const back = recordReadings([run])
    expect(back).toHaveLength(2)
    const a = recordAero(GOOD)
    expect(back[0]!.liftFront).toBeCloseTo(a.liftFront, 9)
    expect(back[0]!.liftRear).toBeCloseTo(a.liftRear, 9)
    expect(back[0]!.centre).toBeNull()
    expect(back[1]!.centre!).toBeCloseTo(sideCentre(GOOD).centre, 9)
    expect(forecastRecord(back, GOOD, STOCK, flat)!.crossHeld).not.toBeNull()
  })

  it('matches the model to the salt at about record speed, which no tunnel reaches', () => {
    const e = recordEvent(flat)
    expect(e.riderSpeed).toBe(RECORD_TUNNEL.matchSpeed)
    expect(e.altitude).toBe(flat.altitude)
  })

  it('starts a land-speed car at a truck’s scale, and its posts give under a hard sweep in a fast fan', () => {
    expect(newLab(STOCK).order.scale).toBe(8)
    const model = { order: { ...STANDARD_ORDER, scale: 8 as const }, design: STOCK }
    const post = (loadN: number) => strains(model, 40, loadN).find((s) => s.part === 'posts')!.level
    // About 35 N at 40 m/s and 20° on a 1:8 model: well inside; twice that breaks them.
    expect(post(35)).toBeLessThan(0.7)
    expect(post(70)).toBeGreaterThan(1)
  })
})
