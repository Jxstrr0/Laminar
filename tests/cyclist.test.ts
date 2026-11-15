import { describe, expect, it } from 'vitest'
import { DEFAULT_CYCLIST, SIT_UP_CYCLIST, type CyclistDesign } from '../src/data/cyclist'
import { TCF_TIME_TRIAL } from '../src/data/rules'
import { checkRules, comfort, readouts, riderEvent } from '../src/sim/cyclist'
import { deskEstimate } from '../src/sim/desk'
import { cyclistShape, helmetLength, tuckFactor } from '../src/sim/geom/cyclist'
import { fieldResult, REFERENCE_TT, truth } from '../src/sim/views'

const edit = (f: (d: CyclistDesign) => void): CyclistDesign => {
  const d = structuredClone(DEFAULT_CYCLIST)
  f(d)
  return d
}
const cda = (d: CyclistDesign) => truth(cyclistShape(d), REFERENCE_TT).cdA
const wa = (d: CyclistDesign) => truth(cyclistShape(d), REFERENCE_TT).windAveragedCdA

describe('the shaped cyclist', () => {
  it('starts close to a real time-trial rider, and sitting up costs a lot', () => {
    expect(cda(DEFAULT_CYCLIST)).toBeGreaterThan(0.19)
    expect(cda(DEFAULT_CYCLIST)).toBeLessThan(0.24)
    expect(cda(SIT_UP_CYCLIST)).toBeGreaterThan(0.28)
    expect(cda(SIT_UP_CYCLIST)).toBeLessThan(0.36)
  })
  it('gets faster as the back flattens, by a real-world amount', () => {
    const at = (deg: number) => cda(edit((d) => (d.posture.torsoDeg = deg)))
    expect(at(8)).toBeLessThan(at(15))
    expect(at(25) / at(15)).toBeGreaterThan(1.05)
    expect(tuckFactor(15)).toBeCloseTo(0, 9)
    expect(tuckFactor(45)).toBeCloseTo(1, 9)
  })
  it('rewards a tucked head and narrow arms', () => {
    expect(cda(edit((d) => (d.posture.headDrop = 1)))).toBeLessThan(cda(edit((d) => (d.posture.headDrop = 0))))
    expect(cda(edit((d) => (d.posture.armWidth = 0.18)))).toBeLessThan(cda(edit((d) => (d.posture.armWidth = 0.42))))
  })
  it('a long helmet tail only pays with the head held down', () => {
    const tail = (t: number, head: number) => cda(edit((d) => ((d.helmet.tail = t), (d.posture.headDrop = head))))
    expect(tail(1, 0.6)).toBeLessThan(tail(0, 0.6))
    expect(tail(1, 0) - tail(0, 0)).toBeGreaterThan(tail(1, 0.6) - tail(0, 0.6))
  })
  it('a vented road helmet is slower than an aero one', () => {
    expect(cda(edit((d) => (d.helmet = { kind: 'road', tail: 0, vents: 0.8 })))).toBeGreaterThan(cda(DEFAULT_CYCLIST) + 0.003)
  })
  it('trip strips and textured fabric help the arms through their drag crisis', () => {
    expect(cda(edit((d) => (d.suit.armTrips = true)))).toBeLessThan(cda(DEFAULT_CYCLIST))
    expect(cda(edit((d) => (d.suit.fabric = 'textured')))).toBeLessThan(cda(DEFAULT_CYCLIST))
  })
  it('deep and disc wheels and Kamm-tail tubes lower the wind-averaged drag', () => {
    const base = wa(DEFAULT_CYCLIST)
    expect(wa(edit((d) => (d.wheels.rear = 'disc')))).toBeLessThan(base)
    expect(wa(edit((d) => (d.wheels.front = 'deep')))).toBeLessThan(base)
    expect(wa(edit((d) => (d.frame = 'kamm')))).toBeLessThan(base)
  })
  it('a front disc catches the crosswind', () => {
    const side = (d: CyclistDesign) => truth(cyclistShape(d), REFERENCE_TT).curve.cyA[18]!
    expect(side(edit((d) => (d.wheels.front = 'disc')))).toBeGreaterThan(side(DEFAULT_CYCLIST) * 2)
  })
  it('is the same shape every time, and symmetric in yaw', () => {
    expect(cyclistShape(DEFAULT_CYCLIST)).toEqual(cyclistShape(structuredClone(DEFAULT_CYCLIST)))
    const c = truth(cyclistShape(DEFAULT_CYCLIST), REFERENCE_TT).curve
    expect(c.cdA[0]).toBeCloseTo(c.cdA[c.cdA.length - 1]!, 9)
  })
})

describe('comfort and power', () => {
  it('sitting up is easy; the default tuck costs a few per cent of power', () => {
    expect(comfort(SIT_UP_CYCLIST).strain).toBeLessThan(0.1)
    const c = comfort(DEFAULT_CYCLIST)
    expect(c.holdable).toBe(true)
    expect(c.powerFactor).toBeLessThan(0.99)
    expect(c.powerFactor).toBeGreaterThan(0.95)
  })
  it('an extreme position can’t be held, and names the worst part', () => {
    const c = comfort(edit((d) => (d.posture = { torsoDeg: 5, headDrop: 1, armWidth: 0.12, handReach: 0.9, handHeight: 0.2 })))
    expect(c.holdable).toBe(false)
    expect(c.worst).toBe('torsoDeg')
  })
  it('a rider with a higher limit can hold more', () => {
    const hard = edit((d) => (d.posture.torsoDeg = 5))
    expect(comfort(hard, 0.5).holdable).toBe(false)
    expect(comfort(hard, 2).holdable).toBe(true)
  })
  it('strain costs time on the road', () => {
    const shape = cyclistShape(DEFAULT_CYCLIST)
    const fresh = fieldResult(shape, REFERENCE_TT, 2).time
    const strained = fieldResult(shape, riderEvent(DEFAULT_CYCLIST, REFERENCE_TT), 2).time
    expect(strained).toBeGreaterThan(fresh)
  })
})

describe('the TCF rule box', () => {
  it('passes the default design', () => {
    expect(checkRules(DEFAULT_CYCLIST, TCF_TIME_TRIAL)).toEqual([])
  })
  it('catches each rule and names the part to change', () => {
    const parts = (d: CyclistDesign) => checkRules(d, TCF_TIME_TRIAL).map((b) => b.part)
    expect(parts(edit((d) => (d.helmet.tail = 1)))).toEqual(['helmet'])
    expect(helmetLength(edit((d) => (d.helmet.tail = 1)))).toBeCloseTo(0.42, 9)
    expect(parts(edit((d) => (d.posture.handReach = 0.85)))).toEqual(['posture.handReach'])
    expect(parts(edit((d) => (d.posture.handHeight = 0.15)))).toEqual(['posture.handHeight'])
    expect(parts(edit((d) => (d.wheels.front = 'disc')))).toEqual(['wheels.front'])
    const kamm = edit((d) => (d.frame = 'kamm'))
    expect(parts(kamm)).toEqual([])
    expect(checkRules(kamm, { ...TCF_TIME_TRIAL, maxTubeAspect: 2.5 })[0]?.part).toBe('frame')
  })
})

describe('readouts and the desk estimate', () => {
  it('adds up mass and price', () => {
    const r = readouts(DEFAULT_CYCLIST, TCF_TIME_TRIAL)
    expect(r.mass).toBeCloseTo(8.2 + 0.42 + 0.75 * 2 + 0.65, 9)
    expect(r.price).toBe(24000 + 15000 * 2 + 31000 + 14000)
    expect(r.frontalArea).toBeGreaterThan(0.3)
    expect(readouts(edit((d) => (d.wheels.rear = 'disc')), TCF_TIME_TRIAL).price).toBeGreaterThan(r.price)
  })
  it('is truth plus a seeded error, with bars the analyst narrows', () => {
    const shape = cyclistShape(DEFAULT_CYCLIST)
    const a = deskEstimate(shape, REFERENCE_TT, 5, 'default')
    expect(deskEstimate(shape, REFERENCE_TT, 5, 'default')).toEqual(a)
    expect(a.low).toBeLessThan(a.value)
    expect(a.high).toBeGreaterThan(a.value)
    const sharp = deskEstimate(shape, REFERENCE_TT, 5, 'default', 3)
    expect(sharp.high - sharp.low).toBeLessThan(a.high - a.low)
    const best = deskEstimate(shape, REFERENCE_TT, 5, 'default', 99)
    expect(best.high - best.low).toBeGreaterThan(0)
  })
  it('its bars hold the truth most of the time', () => {
    const shape = cyclistShape(DEFAULT_CYCLIST)
    const real = truth(shape, REFERENCE_TT).windAveragedCdA
    let inside = 0
    for (let seed = 1; seed <= 60; seed++) {
      const e = deskEstimate(shape, REFERENCE_TT, seed, 'default')
      if (real >= e.low && real <= e.high) inside++
    }
    expect(inside).toBeGreaterThan(42)
    expect(inside).toBeLessThan(60)
  })
})
