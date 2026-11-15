import { describe, expect, it } from 'vitest'
import { SPOKES } from '../src/data/aero'
import { DEFAULT_CYCLIST } from '../src/data/cyclist'
import { DEMO_MODEL_SEED, STANDARD_MODEL } from '../src/data/model'
import { DEMO_TUNNEL_SEED, UNIVERSITY_QUIRKS, UNIVERSITY_TUNNEL } from '../src/data/tunnel'
import { shapeDrag } from '../src/sim/aero/drag'
import {
  calibrate,
  correct,
  corrections,
  latestTare,
  spokeShare,
  tareModel,
  WHEEL_RUN,
  wheelCheck,
} from '../src/sim/calibration'
import { describeShape, scaleShape } from '../src/sim/geom/body'
import { cyclistShape, referenceWheel } from '../src/sim/geom/cyclist'
import { sphere } from '../src/sim/geom/shapes'
import { blockageFactor, rollQuirks, type MountKind } from '../src/sim/quirks'
import { Rng } from '../src/sim/rng'
import type { Run, RunSample } from '../src/sim/run'
import { prepareExact, prepareModel, readBalance, readTare, type TunnelSpec } from '../src/sim/views'

const model = { ...STANDARD_MODEL, seed: DEMO_MODEL_SEED }
const quirks = rollQuirks(UNIVERSITY_QUIRKS, DEMO_TUNNEL_SEED)
const tunnel: TunnelSpec = { ...UNIVERSITY_TUNNEL, quirks }
const C = UNIVERSITY_TUNNEL.section.width * UNIVERSITY_TUNNEL.section.height
const calm = { density: 1.2, viscosity: 1.8e-5, speed: 20, turbulence: 0 }
const drag = (spec: Parameters<typeof describeShape>[0]) => shapeDrag(describeShape(spec), calm).cdA
const refStill = prepareExact(scaleShape(referenceWheel(false), model.scale), model.scale)
const refSpin = describeShape(scaleShape(referenceWheel(true), model.scale))

let nextId = 1
function makeRun(name: string, speeds: number[], read: (speed: number) => number, perSpeed = 20): Run {
  const samples: RunSample[] = []
  for (const speed of speeds)
    for (let i = 0; i < perSpeed; i++) samples.push({ t: samples.length * 0.25, speed, yawDeg: 0, cdA: read(speed), cyA: 0, dragN: 0, steady: true })
  return { id: nextId++, model: name, samples, duration: samples.length * 0.25, energyKWh: 0, topSpeed: Math.max(...speeds) }
}
const tareRun = (mount: MountKind, rng: Rng) => makeRun(tareModel(mount), [10, 20], (speed) => readTare(tunnel, { speed, yawDeg: 0, mount }, rng))
const wheelRun = (rng: Rng, speeds = [15, 25]) =>
  makeRun(WHEEL_RUN, speeds, (speed) => readBalance(refStill, tunnel, { speed, yawDeg: 0, mount: 'posts' }, rng).modelCdA)

describe('static wheels', () => {
  it('read low on spokes, and leave a disc alone', () => {
    const spinning = drag(cyclistShape(DEFAULT_CYCLIST))
    const still = drag(cyclistShape(DEFAULT_CYCLIST, { staticWheels: true }))
    expect(still).toBeLessThan(spinning)
    // A real lesson: a couple of per cent of the whole rider.
    expect(1 - still / spinning).toBeGreaterThan(0.015)
    const discs = { ...DEFAULT_CYCLIST, wheels: { front: 'disc', rear: 'disc' } } as const
    expect(drag(cyclistShape(discs, { staticWheels: true }))).toBeCloseTo(drag(cyclistShape(discs)), 12)
  })

  it('make the reference wheel miss half its spoke drag', () => {
    const spinning = drag(referenceWheel(true))
    const still = drag(referenceWheel(false))
    const spokes = spinning - drag({ bodies: referenceWheel(true).bodies })
    expect(spinning - still).toBeCloseTo(spokes * (1 - SPOKES.staticFactor), 12)
  })

  it('give a spoke share of 0 for discs, about 1 for plain spoked wheels, between for deep rims', () => {
    const share = (wheels: { front: 'spoked' | 'deep' | 'disc'; rear: 'spoked' | 'deep' | 'disc' }) =>
      spokeShare(describeShape(scaleShape(cyclistShape({ ...DEFAULT_CYCLIST, wheels }), model.scale)), refSpin)
    expect(share({ front: 'disc', rear: 'disc' })).toBe(0)
    const spoked = share({ front: 'spoked', rear: 'spoked' })
    expect(spoked).toBeGreaterThan(0.8)
    expect(spoked).toBeLessThan(1.5)
    const deep = share({ front: 'deep', rear: 'deep' })
    expect(deep).toBeGreaterThan(0)
    expect(deep).toBeLessThan(spoked)
  })
})

describe('the known-wheel calibration', () => {
  it('finds what still spokes miss, once the posts are tared', () => {
    const rng = new Rng(11)
    const runs = [tareRun('posts', rng), wheelRun(rng), wheelRun(rng)]
    const tare = latestTare(runs, 'posts')!
    const blk = blockageFactor(quirks.blockage, refStill.shape.frontalArea, C)
    const check = wheelCheck(runs, refSpin, tare.mean, blk)!
    expect(check.trusted).toBe(true)
    expect(check.runId).toBe(runs[2]!.id)
    const spokes = shapeDrag(refSpin, { ...calm, speed: 20 }).cavityCdA
    const truthGap = spokes * (1 - SPOKES.staticFactor)
    expect(Math.abs(check.gap - truthGap)).toBeLessThan(truthGap * 0.25)
    expect(wheelCheck([tareRun('posts', rng)], refSpin, tare.mean, blk)).toBeNull()
  })

  it('brings a still-wheeled rider back within about 1 % of the spinning one in an ideal tunnel', () => {
    const rng = new Rng(12)
    const ball = sphere('calibration-sphere', 0.25)
    const ballModel = prepareExact({ bodies: [ball] })
    const fine = Array.from({ length: 37 }, (_, i) => 2 + i * 0.5)
    const sweep = makeRun('sphere', fine, (speed) => readBalance(ballModel, tunnel, { speed, yawDeg: 0, mount: 'sting' }, rng).cdA)
    const runs = [tareRun('sting', rng), sweep, tareRun('posts', rng), wheelRun(rng), wheelRun(rng), wheelRun(rng)]
    const cal = calibrate(runs, ballModel.shape.bodies[0]!, C)
    const posts = latestTare(runs, 'posts')!
    const blk = cal.blockage ? blockageFactor(cal.blockage.k, refStill.shape.frontalArea, C) : null
    const check = wheelCheck(runs, refSpin, posts.mean, blk)!

    const still = prepareModel(cyclistShape(DEFAULT_CYCLIST, { staticWheels: true }), model)
    const spinning = prepareModel(cyclistShape(DEFAULT_CYCLIST), model)
    const fix = corrections(cal, posts, still.shape.frontalArea, C, check.gap * spokeShare(still.shape, refSpin))
    const run = { speed: 30, yawDeg: 0, mount: 'posts' as const }
    const quiet = { balanceNoise: 0 }
    const ideal = readBalance(spinning, { ...UNIVERSITY_TUNNEL, ...quiet, turbulence: quirks.turbulence }, run, new Rng(1)).modelCdA
    const raw = readBalance(still, { ...tunnel, ...quiet }, run, new Rng(1)).modelCdA
    const noWheels = correct(raw, { ...fix, wheels: null })
    expect(Math.abs(noWheels / ideal - 1)).toBeGreaterThan(0.015)
    expect(Math.abs(correct(raw, fix) / ideal - 1)).toBeLessThan(0.012)
  })
})
