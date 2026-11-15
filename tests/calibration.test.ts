import { describe, expect, it } from 'vitest'
import { DEFAULT_CYCLIST } from '../src/data/cyclist'
import { DEMO_MODEL_SEED, STANDARD_MODEL } from '../src/data/model'
import { DEMO_TUNNEL_SEED, UNIVERSITY_QUIRKS, UNIVERSITY_TUNNEL } from '../src/data/tunnel'
import { bookCurve, calibrate, correct, corrections, crisisRe, latestTare, tareModel } from '../src/sim/calibration'
import { describeBody } from '../src/sim/geom/body'
import { cyclistShape } from '../src/sim/geom/cyclist'
import { sphere } from '../src/sim/geom/shapes'
import { blockageFactor, rollQuirks, type MountKind } from '../src/sim/quirks'
import { Rng } from '../src/sim/rng'
import type { Run, RunSample } from '../src/sim/run'
import { prepareExact, prepareModel, readBalance, readTare, type TunnelSpec } from '../src/sim/views'

const quirks = rollQuirks(UNIVERSITY_QUIRKS, DEMO_TUNNEL_SEED)
const tunnel: TunnelSpec = { ...UNIVERSITY_TUNNEL, quirks }
const C = UNIVERSITY_TUNNEL.section.width * UNIVERSITY_TUNNEL.section.height
const ballSpec = sphere('calibration-sphere', 0.25)
const ball = describeBody(ballSpec)
const sphereModel = prepareExact({ bodies: [ballSpec] })

let nextId = 1
function makeRun(model: string, speeds: number[], read: (speed: number) => number, perSpeed = 20): Run {
  const samples: RunSample[] = []
  for (const speed of speeds)
    for (let i = 0; i < perSpeed; i++) samples.push({ t: samples.length * 0.25, speed, yawDeg: 0, cdA: read(speed), cyA: 0, dragN: 0, steady: true })
  return { id: nextId++, model, samples, duration: samples.length * 0.25, energyKWh: 0, topSpeed: Math.max(...speeds) }
}
const tareRun = (mount: MountKind, rng: Rng) => makeRun(tareModel(mount), [10, 20], (speed) => readTare(tunnel, { speed, yawDeg: 0, mount }, rng))
const sweep = (rng: Rng, speeds: number[]) =>
  makeRun('sphere', speeds, (speed) => readBalance(sphereModel, tunnel, { speed, yawDeg: 0, mount: 'sting' }, rng).cdA)
const fine = Array.from({ length: 37 }, (_, i) => 2 + i * 0.5)

describe('tunnel quirks', () => {
  it('are drawn inside their ranges, the same for the same seed', () => {
    expect(rollQuirks(UNIVERSITY_QUIRKS, DEMO_TUNNEL_SEED)).toEqual(quirks)
    expect(rollQuirks(UNIVERSITY_QUIRKS, 99)).not.toEqual(quirks)
    expect(quirks.blockage).toBeGreaterThanOrEqual(UNIVERSITY_QUIRKS.blockage.min)
    expect(quirks.blockage).toBeLessThanOrEqual(UNIVERSITY_QUIRKS.blockage.max)
    expect(quirks.turbulence).toBeGreaterThanOrEqual(UNIVERSITY_QUIRKS.turbulence.min)
    expect(quirks.mountCdA.posts).toBeLessThanOrEqual(UNIVERSITY_QUIRKS.mount.posts.max)
  })

  it('make the rider read high: blockage plus the posts', () => {
    const prepared = prepareModel(cyclistShape(DEFAULT_CYCLIST), { ...STANDARD_MODEL, seed: DEMO_MODEL_SEED })
    const run = { speed: 30, yawDeg: 0, mount: 'posts' as const }
    const quiet = { balanceNoise: 0 }
    const ideal = readBalance(prepared, { ...UNIVERSITY_TUNNEL, ...quiet, turbulence: quirks.turbulence }, run, new Rng(1)).modelCdA
    const real = readBalance(prepared, { ...tunnel, ...quiet }, run, new Rng(1)).modelCdA
    const factor = blockageFactor(quirks.blockage, prepared.shape.frontalArea, C)
    expect(real).toBeCloseTo(ideal * factor + quirks.mountCdA.posts, 10)
    // A real lesson: the raw reading is well over 5 % high.
    expect(real / ideal).toBeGreaterThan(1.05)
  })

  it('give a tare reading of the bare mount, and nothing without quirks', () => {
    const quiet = { ...tunnel, balanceNoise: 0 }
    expect(readTare(quiet, { speed: 20, yawDeg: 0, mount: 'sting' }, new Rng(1))).toBeCloseTo(quirks.mountCdA.sting, 12)
    expect(readTare(UNIVERSITY_TUNNEL, { speed: 20, yawDeg: 0, mount: 'sting' }, new Rng(1))).toBe(0)
  })
})

describe('calibration', () => {
  it('finds the book crisis of a smooth sphere in calm air near Re 3.5 × 10⁵', () => {
    const re = crisisRe(bookCurve(ball))!
    expect(re).toBeGreaterThan(2.8e5)
    expect(re).toBeLessThan(4.2e5)
  })

  it('takes the latest tare run of the right mount', () => {
    const rng = new Rng(3)
    const runs = [tareRun('sting', rng), tareRun('posts', rng), tareRun('sting', rng)]
    const tare = latestTare(runs, 'sting')!
    expect(tare.runId).toBe(runs[2]!.id)
    expect(tare.trusted).toBe(true)
    expect(Math.abs(tare.mean - quirks.mountCdA.sting)).toBeLessThan(tare.band * 2)
    expect(latestTare(runs.slice(1, 2), 'sting')).toBeNull()
  })

  it('finds the turbulence from the early crisis', () => {
    const cal = calibrate([sweep(new Rng(4), fine)], ball, C)
    expect(cal.crisis).not.toBeNull()
    expect(cal.crisis!.re).toBeLessThan(cal.crisis!.bookRe)
    expect(cal.turbulence!).toBeGreaterThan(quirks.turbulence * 0.8)
    expect(cal.turbulence!).toBeLessThan(quirks.turbulence * 1.25)
  })

  it('needs a sting tare before it trusts a blockage figure', () => {
    expect(calibrate([sweep(new Rng(5), fine)], ball, C).blockage).toBeNull()
  })

  it('finds the blockage constant once the sting is tared', () => {
    const rng = new Rng(6)
    const cal = calibrate([tareRun('sting', rng), sweep(rng, fine)], ball, C)
    expect(cal.blockage).not.toBeNull()
    expect(cal.blockage!.ratio).toBeGreaterThan(1)
    expect(Math.abs(cal.blockage!.k - quirks.blockage)).toBeLessThan(0.3)
  })

  it('a sweep that misses the crisis finds neither', () => {
    const cal = calibrate([sweep(new Rng(7), [3, 4, 5])], ball, C)
    expect(cal.crisis).toBeNull()
    expect(cal.turbulence).toBeNull()
    expect(cal.blockage).toBeNull()
  })

  it('brings the rider’s reading back within about 1 % of an ideal tunnel’s', () => {
    const rng = new Rng(8)
    const runs = [tareRun('sting', rng), sweep(rng, fine), tareRun('posts', rng)]
    const cal = calibrate(runs, ball, C)
    const prepared = prepareModel(cyclistShape(DEFAULT_CYCLIST), { ...STANDARD_MODEL, seed: DEMO_MODEL_SEED })
    const fix = corrections(cal, latestTare(runs, 'posts'), prepared.shape.frontalArea, C)
    expect(fix.tare).not.toBeNull()
    expect(fix.blockage).not.toBeNull()
    const run = { speed: 30, yawDeg: 0, mount: 'posts' as const }
    const quiet = { balanceNoise: 0 }
    const ideal = readBalance(prepared, { ...UNIVERSITY_TUNNEL, ...quiet, turbulence: quirks.turbulence }, run, new Rng(1)).modelCdA
    const raw = readBalance(prepared, { ...tunnel, ...quiet }, run, new Rng(1)).modelCdA
    expect(Math.abs(correct(raw, fix) / ideal - 1)).toBeLessThan(0.012)
    expect(correct(raw, { tare: null, blockage: null })).toBe(raw)
  })
})
