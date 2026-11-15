import { describe, expect, it } from 'vitest'
import { aeroForces, yawSweep } from '../src/sim/aero/forces'
import type { Flow } from '../src/sim/aero/flow'
import { aspectRatio, elementForces, liftSlope } from '../src/sim/aero/lift'
import { PI } from '../src/sim/det'
import { describeShape, type LiftingElement } from '../src/sim/geom/body'
import { box, sphere, streamlined } from '../src/sim/geom/shapes'

const flow: Flow = { density: 1.225, viscosity: 1.81e-5, speed: 30, turbulence: 0 }

const wing = (over: Partial<LiftingElement> = {}): LiftingElement => ({
  id: 'wing',
  plane: 'horizontal',
  span: 1.2,
  chord: 0.2,
  camber: 0,
  thickness: 0.12,
  angleDeg: 0,
  x: 0,
  ...over,
})

/** Lift-curve slope per radian from two small angles. */
function slopeOf(el: LiftingElement): number {
  const a = elementForces(el, flow, -2).cl
  const b = elementForces(el, flow, 2).cl
  return (b - a) / ((4 * PI) / 180)
}

describe('lift', () => {
  it('approaches 2π per radian for a very long wing (thin-airfoil theory)', () => {
    const slope = slopeOf(wing({ span: 200, chord: 0.2 }))
    expect(slope / (2 * PI)).toBeGreaterThan(0.98)
    expect(slope / (2 * PI)).toBeLessThanOrEqual(1)
  })
  it('falls for a stubby wing as lifting-line theory says', () => {
    const el = wing({ span: 1.2, chord: 0.2 }) // aspect ratio 6
    expect(slopeOf(el)).toBeCloseTo(liftSlope(6), 6)
    expect(liftSlope(6)).toBeGreaterThan(4.2)
    expect(liftSlope(6)).toBeLessThan(4.9)
  })
  it('makes no lift at the zero-lift angle camber gives', () => {
    const el = wing({ camber: 0.04 })
    const zero = (-2 * 0.04 * 180) / PI
    expect(elementForces(el, flow, zero).cl).toBeCloseTo(0, 9)
    expect(elementForces(el, flow, 0).cl).toBeGreaterThan(0)
  })
  it('makes downforce when upside down', () => {
    expect(elementForces(wing({ camber: -0.04 }), flow, 0).cl).toBeLessThan(0)
  })
  it('stalls: lift peaks then falls, more sharply for a sharp section', () => {
    const sharp = wing({ stallSharpness: 1 })
    const soft = wing({ stallSharpness: 0 })
    const cls = [0, 5, 10, 13, 16, 20, 25].map((a) => elementForces(sharp, flow, a).cl)
    const peak = Math.max(...cls)
    expect(elementForces(sharp, flow, 19).cl).toBeLessThan(peak * 0.75)
    expect(elementForces(sharp, flow, 16).cl).toBeLessThan(elementForces(soft, flow, 16).cl)
    expect(elementForces(sharp, flow, 25).stalled).toBeCloseTo(1, 6)
    expect(elementForces(sharp, flow, 25).cd).toBeGreaterThan(elementForces(sharp, flow, 5).cd * 3)
  })
  it('pays induced drag CL² / (π AR e), worse for short wings', () => {
    const r = elementForces(wing(), flow, 6)
    expect(r.cdi).toBeCloseTo((r.cl * r.cl) / (PI * 6 * 0.85), 9)
    const short = elementForces(wing({ span: 0.4 }), flow, 6)
    expect(short.cdi / (short.cl * short.cl)).toBeGreaterThan(r.cdi / (r.cl * r.cl))
  })
  it('acts longer with endplates', () => {
    expect(aspectRatio(wing({ endplates: 0.2 }))).toBeGreaterThan(aspectRatio(wing()))
    const plain = elementForces(wing(), flow, 6)
    const plated = elementForces(wing({ endplates: 0.2 }), flow, 6)
    expect(plated.cdi / (plated.cl * plated.cl)).toBeLessThan(plain.cdi / (plain.cl * plain.cl))
  })
  it('makes less in another part’s wake', () => {
    const clean = elementForces(wing(), flow, 5).liftA
    const dirty = elementForces(wing({ inWake: 0.3 }), flow, 5).liftA
    expect(dirty / clean).toBeCloseTo(0.7, 9)
  })
})

describe('ground effect', () => {
  const at = (h: number) => elementForces(wing({ camber: -0.04, angleDeg: -4, rideHeight: h }), flow, -4)
  it('adds downforce as the wing gets lower', () => {
    expect(at(0.06).cl).toBeLessThan(at(0.2).cl)
    expect(at(0.2).cl).toBeLessThan(elementForces(wing({ camber: -0.04 }), flow, -4).cl * 0.999 + 0)
  })
  it('collapses when it gets too close (what makes a car porpoise)', () => {
    expect(Math.abs(at(0.004).cl)).toBeLessThan(Math.abs(at(0.03).cl) * 0.6)
  })
  it('cuts induced drag near the ground', () => {
    const free = elementForces(wing({ camber: 0.04 }), flow, 4)
    const low = elementForces(wing({ camber: 0.04, rideHeight: 0.05 }), flow, 4)
    expect(low.cdi / (low.cl * low.cl)).toBeLessThan(free.cdi / (free.cl * free.cl))
  })
})

describe('crosswinds and yaw', () => {
  const yaws = [-15, -10, -5, 0, 5, 10, 15]

  it('a sphere’s drag just turns with the wind', () => {
    const s = describeShape({ bodies: [sphere('s', 0.25)] })
    const still = aeroForces(s, flow, { yawDeg: 0 })
    const yawed = aeroForces(s, flow, { yawDeg: 20 })
    const total = Math.hypot(yawed.cdA, yawed.cyA)
    expect(total).toBeCloseTo(still.cdA, 9)
  })
  it('side force is odd in yaw and drag is even, for a symmetric body', () => {
    const shape = describeShape({ bodies: [box('van', 4, 1, 1.4, 0.1)] })
    const sweep = yawSweep(shape, flow, yaws)
    expect(sweep[3]?.cyA).toBeCloseTo(0, 12)
    for (let i = 0; i < 3; i++) {
      const neg = sweep[i]!
      const pos = sweep[6 - i]!
      expect(pos.cyA).toBeCloseTo(-neg.cyA, 9)
      expect(pos.cdA).toBeCloseTo(neg.cdA, 9)
    }
  })
  it('a long bluff body’s yaw curve: side force climbs, drag rises', () => {
    const shape = describeShape({ bodies: [box('van', 4, 1, 1.4, 0.1)] })
    const [z, f, t] = yawSweep(shape, flow, [0, 5, 10])
    expect(f!.cyA).toBeGreaterThan(0)
    expect(t!.cyA).toBeGreaterThan(f!.cyA * 1.6)
    expect(t!.cdA).toBeGreaterThan(z!.cdA)
  })
  it('a disc reads less drag in a crosswind (the sail effect)', () => {
    const disc: LiftingElement = { id: 'disc', plane: 'vertical', span: 0.62, chord: 0.62, camber: 0, thickness: 0.04, angleDeg: 0, x: 0 }
    const shape = describeShape({ bodies: [], elements: [disc] })
    const still = aeroForces(shape, flow, { yawDeg: 0 }).cdA
    const yawed = aeroForces(shape, flow, { yawDeg: 12 }).cdA
    expect(yawed).toBeLessThan(still)
  })
  it('a tail fin behind the centre of mass makes the shape settle into the wind', () => {
    const body = streamlined('pod', 1, 0.2)
    const fin: LiftingElement = { id: 'fin', plane: 'vertical', span: 0.2, chord: 0.15, camber: 0, thickness: 0.1, angleDeg: 0, x: 0.95 }
    const bare = aeroForces(describeShape({ bodies: [body] }), flow, { yawDeg: 5 }, 0.45)
    const finned = aeroForces(describeShape({ bodies: [body], elements: [fin] }), flow, { yawDeg: 5 }, 0.45)
    expect(finned.centreOfPressureX!).toBeGreaterThan(bare.centreOfPressureX!)
    expect(finned.yawMomentA).toBeGreaterThan(0)
    expect(bare.yawMomentA).toBeLessThan(finned.yawMomentA)
  })
  it('wings ahead of the reference point pitch the nose up', () => {
    const shape = describeShape({ bodies: [], elements: [wing({ camber: 0.04, x: -0.5 })] })
    const r = aeroForces(shape, flow, { yawDeg: 0 }, 0)
    expect(r.clA).toBeGreaterThan(0)
    expect(r.pitchMomentA).toBeGreaterThan(0)
    expect(r.lOverD).toBeGreaterThan(5)
  })
})
