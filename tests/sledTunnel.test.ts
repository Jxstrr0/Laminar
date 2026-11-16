import { describe, expect, it } from 'vitest'
import { BOB_TUNNEL, DEFAULT_BOBSLED, SLED, type BobsledDesign } from '../src/data/bobsled'
import { MODEL_SHOP, STANDARD_ORDER } from '../src/data/model'
import { TRACKS } from '../src/data/tracks'
import { UNIVERSITY_TUNNEL } from '../src/data/tunnel'
import { dayDrag, referenceConditions, referenceRun } from '../src/sim/bobsled'
import { modelSpecOf, quote } from '../src/sim/modelShop'
import { Rng } from '../src/sim/rng'
import { floorRead, forecastRun, prepareSled, sledEvent } from '../src/sim/sledTunnel'
import { readBalance, type ModelSpec } from '../src/sim/views'

const track = TRACKS.belogor
const sled = (crew: 2 | 4 = 2): BobsledDesign => ({ ...structuredClone(DEFAULT_BOBSLED), crew })
const model = (patch: Partial<ModelSpec> = {}): ModelSpec => ({ scale: 0.25, finish: 'polished', accuracy: 0, seed: 7, trips: true, ...patch })
const quiet = { ...UNIVERSITY_TUNNEL, balanceNoise: 0 }
const read = (m: ModelSpec, design = sled()) => readBalance(prepareSled(design, m), quiet, { speed: 40, yawDeg: 0 }, new Rng(1)).cdA

describe('the bobsled in the tunnel', () => {
  it('reads only part of the runners on the bare floor, nearly all on a ground board', () => {
    expect(floorRead(false)).toBeCloseTo(1 - BOB_TUNNEL.floorHidden, 12)
    expect(floorRead(true)).toBeGreaterThan(floorRead(false))
    expect(floorRead(true)).toBeLessThan(1)
  })

  it('carries the nose, runners and crew as fixed drag beside the hull', () => {
    const p = prepareSled(sled(), model())
    expect(p.fixedCdA).toBeGreaterThan(SLED.runnersCdA * floorRead(false) * 0.25 * 0.25)
    expect(p.shape.bodies.length).toBe(1)
  })

  it('reads the board’s difference as the runners’ hidden drag', () => {
    const bare = read(model())
    const board = read(model({ board: true }))
    const hidden = SLED.runnersCdA * (floorRead(true) - floorRead(false))
    expect(board - bare).toBeCloseTo(hidden, 10)
  })

  it('reads a bare-floor sled too slippery, and a boarded one close to the truth', () => {
    const truth = dayDrag(sled(), track, referenceConditions(sled())).cdA
    const bare = read(model())
    const board = read(model({ board: true }))
    expect(bare).toBeLessThan(truth * 0.93)
    expect(Math.abs(board / truth - 1)).toBeLessThan(0.04)
  })

  it('forecasts the reference run on a drag area, and the truth gives the real one', () => {
    const d = sled()
    const truth = dayDrag(d, track, referenceConditions(d)).cdA
    expect(forecastRun(truth, d, track).time).toBeCloseTo(referenceRun(d, track).time, 9)
    // The bare floor's slippery reading forecasts a run quicker than the sled really is.
    expect(forecastRun(read(model()), d, track).time).toBeLessThan(referenceRun(d, track).time - 0.05)
  })

  it('matches the model to the track at the sled’s speed', () => {
    const e = sledEvent(track)
    expect(e.altitude).toBe(track.altitude)
    expect(e.riderSpeed).toBeGreaterThan(20)
  })

  it('is deterministic for a seed', () => {
    expect(read(model({ accuracy: 0.01 }))).toBe(read(model({ accuracy: 0.01 })))
    expect(read(model({ accuracy: 0.01, seed: 8 }))).not.toBe(read(model({ accuracy: 0.01 })))
  })
})

describe('the ground board in the model shop', () => {
  it('costs extra and a day, and goes on the model it builds', () => {
    const plain = quote(STANDARD_ORDER)
    const boarded = quote({ ...STANDARD_ORDER, board: true })
    expect(boarded.price - plain.price).toBe(MODEL_SHOP.board.price)
    expect(boarded.days - plain.days).toBe(MODEL_SHOP.board.days)
    expect(modelSpecOf({ ...STANDARD_ORDER, board: true }, 1).board).toBe(true)
    expect(modelSpecOf(STANDARD_ORDER, 1).board).toBeUndefined()
  })
})
