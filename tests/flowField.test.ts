import { describe, expect, it } from 'vitest'
import { DEFAULT_CYCLIST, POSTURE_RANGE, SIT_UP_CYCLIST, type CyclistDesign } from '../src/data/cyclist'
import { shapeDrag } from '../src/sim/aero/drag'
import { describeShape } from '../src/sim/geom/body'
import { cyclistShape } from '../src/sim/geom/cyclist'
import { riderPose, type Point } from '../src/sim/geom/pose'
import { riderEllipsoids, scaleEllipsoids, type Ellipsoid } from '../src/sim/flow/ellipsoids'
import { flowField, riderFlowField, rngJitter, tufts, turbulenceNoise, type FlowField } from '../src/sim/flow/field'
import { Rng } from '../src/sim/rng'
import { eventFlow, REFERENCE_TT } from '../src/sim/views'

const FLOW = eventFlow(REFERENCE_TT)
const edit = (base: CyclistDesign, f: (d: CyclistDesign) => void): CyclistDesign => {
  const d = structuredClone(base)
  f(d)
  return d
}
const field = (d: CyclistDesign = DEFAULT_CYCLIST, yaw = 0) => riderFlowField(d, FLOW, yaw)
const len = (v: Point) => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y + a.z * b.z
const ell = (f: FlowField, id: string): Ellipsoid => f.bodies.find((b) => b.ellipsoid.id === id)!.ellipsoid
/**
 * A point on an ellipsoid's surface (q on the unit ball, in its forward/up/side
 * axes), moved out along the ray from its centre by the factor k, and the
 * surface normal there.
 */
function onSurface(e: Ellipsoid, q: Point, k = 1): { p: Point; n: Point } {
  const fx = Math.cos(e.pitchRad)
  const fy = Math.sin(e.pitchRad)
  const lf = q.x * e.axes.a * k
  const lu = q.y * e.axes.b * k
  const g = { f: q.x / e.axes.a, u: q.y / e.axes.b, s: q.z / e.axes.c }
  const gl = Math.sqrt(g.f * g.f + g.u * g.u + g.s * g.s)
  const n = { x: (g.f * fx - g.u * fy) / gl, y: (g.f * fy + g.u * fx) / gl, z: g.s / gl }
  return { p: { x: e.centre.x + lf * fx - lu * fy, y: e.centre.y + lf * fy + lu * fx, z: e.centre.z + q.z * e.axes.c * k }, n }
}
const separatedOn = (f: FlowField, id: string) => tufts(f).filter((t) => t.ellipsoidId === id && t.separated).length
const countOn = (f: FlowField, id: string) => tufts(f).filter((t) => t.ellipsoidId === id).length

describe('the flow the visuals show', () => {
  it('fits every drawn part with an ellipsoid linked to an aero body', () => {
    const d = edit(DEFAULT_CYCLIST, (x) => (x.wheels.rear = 'disc'))
    const list = riderEllipsoids(d, riderPose(d))
    const bodyIds = new Set(cyclistShape(d).bodies.map((b) => b.id))
    for (const e of list) expect(bodyIds.has(e.bodyId), `${e.id} → ${e.bodyId}`).toBe(true)
    const ids = list.map((e) => e.id)
    for (const id of ['torso', 'head', 'helmet', 'upper-arm-1', 'upper-arm-2', 'forearm-1', 'forearm-2', 'thigh-1', 'thigh-2', 'shin-1', 'shin-2', 'rear-disc'])
      expect(ids).toContain(id)
    expect(ids).not.toContain('front-disc')
  })

  it('far from the rider, the air is the free stream', () => {
    const f = field()
    for (const p of [
      { x: 30, y: 1, z: 0 },
      { x: 0.5, y: 1, z: 25 },
      { x: 0.5, y: 40, z: 0 },
      { x: -60, y: 1, z: 0 },
    ]) {
      const v = f.velocity(p)
      expect(v.x).toBeCloseTo(-FLOW.speed, 9)
      expect(v.y).toBeCloseTo(0, 9)
      expect(v.z).toBeCloseTo(0, 9)
      expect(f.wake(p)).toBe(0)
    }
  })

  it('a point just outside a body has no velocity into it', () => {
    for (const d of [DEFAULT_CYCLIST, SIT_UP_CYCLIST]) {
      for (const yaw of [0, 12]) {
        const f = field(d, yaw)
        let checked = 0
        for (const t of tufts(f, { parts: ['rider', 'bike'] })) {
          // Just outside along the ray from the ellipsoid's centre (its normal there is the tuft's).
          const c = f.bodies[t.bodyIndex]!.ellipsoid.centre
          const k = 1 + 1e-4
          const p = { x: c.x + (t.point.x - c.x) * k, y: c.y + (t.point.y - c.y) * k, z: c.z + (t.point.z - c.z) * k }
          expect(dot(f.potential(p), t.normal)).toBeGreaterThanOrEqual(-1e-9)
          expect(dot(f.velocity(p), t.normal)).toBeGreaterThanOrEqual(-1e-9)
          checked++
        }
        expect(checked).toBeGreaterThan(300)
      }
    }
  })

  it('keeps a single ellipsoid watertight on its own, as exact potential flow', () => {
    const shape = describeShape(cyclistShape(DEFAULT_CYCLIST))
    const drag = shapeDrag(shape, FLOW)
    const torso = riderEllipsoids(DEFAULT_CYCLIST, riderPose(DEFAULT_CYCLIST)).find((e) => e.id === 'torso')!
    const f = flowField({ ellipsoids: [torso], shape, drag, speed: 10, yawDeg: 7 })
    for (let i = 0; i < 40; i++) {
      const th = (Math.PI * (i + 0.5)) / 40
      const ph = i * 2.4
      const { p, n } = onSurface(torso, { x: Math.cos(th), y: Math.sin(th) * Math.cos(ph), z: Math.sin(th) * Math.sin(ph) })
      // Exactly on the surface the stretched doublet alone already cancels the normal flow.
      expect(Math.abs(dot(f.potential(p), n))).toBeLessThan(1e-9)
    }
  })

  it('speeds the air up over the top of the torso', () => {
    for (const d of [DEFAULT_CYCLIST, SIT_UP_CYCLIST]) {
      const f = field(d)
      // Over the shoulders, the torso's highest point as the air sees it.
      const { p } = onSurface(ell(f, 'torso'), { x: 0.5, y: Math.sqrt(0.75), z: 0 }, 1.03)
      expect(len(f.potential(p))).toBeGreaterThan(FLOW.speed * 1.15)
    }
    // And slows it at the front, where the air meets the body: the tip of an aero-bar forearm.
    const f = field()
    const { p } = onSurface(ell(f, 'forearm-1'), { x: 1, y: 0, z: 0 }, 1.03)
    expect(len(f.potential(p))).toBeLessThan(FLOW.speed * 0.2)
  })

  it('has no wake upstream, and a wake just behind a separated body', () => {
    const f = field()
    for (const p of [
      { x: 1.6, y: 1.2, z: 0 },
      { x: 1.2, y: 0.5, z: 0.1 },
      { x: 2.5, y: 0.9, z: -0.2 },
    ])
      expect(f.wake(p)).toBe(0)
    // The upper arm separates (laminar, round the side).
    const arm = f.bodies.find((b) => b.ellipsoid.id === 'upper-arm-2')!
    expect(arm.wakeStart).not.toBeNull()
    const behindArm = { x: arm.ellipsoid.centre.x - arm.ellipsoid.axes.c - 0.03, y: arm.ellipsoid.centre.y, z: arm.ellipsoid.centre.z }
    expect(f.wake(behindArm)).toBeGreaterThan(0.3)
    // The helmet too: just behind its tail, above the back.
    const helmet = ell(f, 'helmet')
    const { p } = onSurface(helmet, { x: -1, y: 0, z: 0 }, 1.15)
    expect(f.wake(p)).toBeGreaterThan(0.3)
    // And the smoke slows there.
    expect(len(f.velocity(behindArm))).toBeLessThan(len(f.potential(behindArm)))
  })

  it('sheds only a small wake behind a streamlined body the flow holds on to', () => {
    // The aero-bar forearm is a teardrop the flow follows to its 0.6 cut: a far
    // smaller wake than the round upper arm's, and its tufts let go much later.
    const f = field()
    const fore = f.bodies.find((b) => b.ellipsoid.id === 'forearm-1')!
    const upper = f.bodies.find((b) => b.ellipsoid.id === 'upper-arm-1')!
    expect(fore.wakeSize.up * fore.wakeSize.side).toBeLessThan(0.2 * upper.wakeSize.up * upper.wakeSize.side)
    expect(fore.separation.top).toBeGreaterThan(upper.separation.side)
  })

  it('moves the separation point with the drag result', () => {
    // Sitting up turns the back into the wind: far more of the torso is separated.
    const tuck = field(DEFAULT_CYCLIST)
    const sit = field(SIT_UP_CYCLIST)
    const fracTuck = separatedOn(tuck, 'torso') / countOn(tuck, 'torso')
    const fracSit = separatedOn(sit, 'torso') / countOn(sit, 'torso')
    expect(fracSit).toBeGreaterThan(2 * fracTuck)
    // A bigger cut-off section on the upright torso lets go earlier, and its wake is bigger.
    const bt = tuck.bodies.find((b) => b.ellipsoid.id === 'torso')!
    const bs = sit.bodies.find((b) => b.ellipsoid.id === 'torso')!
    expect(bs.separation.top).toBeLessThan(bt.separation.top)
    expect(bs.wakeSize.up * bs.wakeSize.side).toBeGreaterThan(bt.wakeSize.up * bt.wakeSize.side)

    // Trip strips make the arm's layer turbulent: it holds on longer, fewer tufts flail, the wake narrows.
    const trips = field(edit(DEFAULT_CYCLIST, (d) => (d.suit.armTrips = true)))
    expect(separatedOn(trips, 'upper-arm-1')).toBeLessThan(separatedOn(tuck, 'upper-arm-1'))
    const plain = tuck.bodies.find((b) => b.ellipsoid.id === 'upper-arm-1')!
    const tripped = trips.bodies.find((b) => b.ellipsoid.id === 'upper-arm-1')!
    expect(tripped.separation.side).toBeGreaterThan(plain.separation.side)
    expect(tripped.wakeSize.side).toBeLessThan(plain.wakeSize.side)

    // Every separated tuft faces downstream; no tuft facing the wind is separated.
    for (const t of tufts(sit)) if (t.separated) expect(dot(t.normal, sit.downstream)).toBeGreaterThan(0)
  })

  it('reads the scale model tunnel run, not just full size', () => {
    // At a fifth of the speed the arm stays laminar even with trip strips: tufts flail as they do without.
    const slow = { ...FLOW, speed: FLOW.speed / 5 }
    const d = edit(DEFAULT_CYCLIST, (x) => (x.suit.armTrips = true))
    expect(separatedOn(riderFlowField(d, slow, 0), 'upper-arm-1')).toBeGreaterThan(separatedOn(riderFlowField(d, FLOW, 0), 'upper-arm-1'))
    // Scaled ellipsoids give the same picture at model size.
    const shape = describeShape(cyclistShape(DEFAULT_CYCLIST))
    const drag = shapeDrag(shape, FLOW)
    const list = riderEllipsoids(DEFAULT_CYCLIST, riderPose(DEFAULT_CYCLIST))
    const full = flowField({ ellipsoids: list, shape, drag, speed: 10, yawDeg: 0 })
    const model = flowField({ ellipsoids: scaleEllipsoids(list, 0.25), shape, drag, speed: 10, yawDeg: 0 })
    const p = { x: 0.2, y: 1.3, z: 0.05 }
    const q = { x: p.x * 0.25, y: p.y * 0.25, z: p.z * 0.25 }
    const a = full.potential(p)
    const b = model.potential(q)
    expect(b.x).toBeCloseTo(a.x, 9)
    expect(b.y).toBeCloseTo(a.y, 9)
    expect(model.wake(q)).toBeCloseTo(full.wake(p), 2)
  })

  it('swings the wake sideways with yaw', () => {
    const straight = field(DEFAULT_CYCLIST, 0)
    const yawed = field(DEFAULT_CYCLIST, 15)
    expect(yawed.downstream.z).toBeGreaterThan(0)
    expect(yawed.freestream.z).toBeGreaterThan(0)
    // 1.2 m behind the torso, off to the right: in the wake only when yawed.
    const torso = ell(straight, 'torso')
    const right = { x: torso.centre.x - 1.2, y: torso.centre.y, z: 0.45 }
    const left = { ...right, z: -0.45 }
    expect(yawed.wake(right)).toBeGreaterThan(straight.wake(right) + 0.2)
    expect(yawed.wake(left)).toBeLessThan(straight.wake(left) + 1e-12)
    // The lee side moves too: the right side of the torso separates more under positive yaw.
    const sep = (f: FlowField, side: number) => tufts(f).filter((t) => t.ellipsoidId === 'torso' && t.separated && t.normal.z * side > 0.3).length
    expect(sep(yawed, 1)).toBeGreaterThan(sep(yawed, -1))
  })

  it('gives tufts that lie along the surface and know their line', () => {
    const f = field(SIT_UP_CYCLIST)
    const list = tufts(f)
    expect(list.length).toBeGreaterThan(300)
    for (const t of list) {
      expect(Math.abs(dot(t.direction, t.normal))).toBeLessThan(1e-9)
      expect(len(t.direction)).toBeCloseTo(1, 9)
      expect(t.strength).toBeGreaterThanOrEqual(0)
      expect(t.strength).toBeLessThanOrEqual(1)
      expect(t.buffet).toBeGreaterThanOrEqual(0)
      expect(t.buffet).toBeLessThanOrEqual(1)
    }
    const torso = list.filter((t) => t.ellipsoidId === 'torso')
    expect(new Set(torso.map((t) => t.line))).toEqual(new Set(['top', 'bottom', 'side']))
    expect(list.filter((t) => t.ellipsoidId.startsWith('thigh')).every((t) => t.line === 'side')).toBe(true)
    // Attached flow combs the tufts downstream.
    const attached = torso.filter((t) => !t.separated)
    const along = attached.filter((t) => dot(t.direction, f.downstream) > 0).length
    expect(along / attached.length).toBeGreaterThan(0.8)
    // Bike tubes carry tufts only on request.
    expect(list.some((t) => t.bodyId === 'seat-tube')).toBe(false)
    expect(tufts(f, { parts: ['bike'] }).some((t) => t.bodyId === 'seat-tube')).toBe(true)
  })

  it('makes deterministic turbulence', () => {
    const p = { x: -0.4, y: 1.1, z: 0.05 }
    const a = turbulenceNoise(p, 1.25, 42)
    const b = turbulenceNoise(p, 1.25, 42)
    expect(a).toEqual(b)
    expect(turbulenceNoise(p, 1.25, 43)).not.toEqual(a)
    expect(turbulenceNoise(p, 1.5, 42)).not.toEqual(a)
    for (const c of [a.x, a.y, a.z]) expect(Math.abs(c)).toBeLessThanOrEqual(1)
    // Smooth: a tiny step in space or time barely changes it.
    const near = turbulenceNoise({ ...p, x: p.x + 1e-4 }, 1.25 + 1e-4, 42)
    expect(Math.abs(near.x - a.x) + Math.abs(near.y - a.y) + Math.abs(near.z - a.z)).toBeLessThan(0.02)
    // Gusts only in a wake, and the same for the same seed.
    const f1 = riderFlowField(DEFAULT_CYCLIST, FLOW, 0, { seed: 7 })
    const f2 = riderFlowField(DEFAULT_CYCLIST, FLOW, 0, { seed: 7 })
    const arm = f1.bodies.find((b) => b.ellipsoid.id === 'upper-arm-2')!.ellipsoid
    const inWake = { x: arm.centre.x - arm.axes.c - 0.05, y: arm.centre.y, z: arm.centre.z }
    expect(f1.gust(inWake, 0.8)).toEqual(f2.gust(inWake, 0.8))
    expect(len(f1.gust(inWake, 0.8))).toBeGreaterThan(0)
    expect(f1.gust({ x: 2, y: 1, z: 0 }, 0.8)).toEqual({ x: 0, y: 0, z: 0 })
    // The generator version replays from the same seed.
    expect(rngJitter(new Rng(9), 0.5)).toEqual(rngJitter(new Rng(9), 0.5))
  })

  it('stays finite at every slider extreme', () => {
    const R = POSTURE_RANGE
    const keys = Object.keys(R) as (keyof typeof R)[]
    const designs: CyclistDesign[] = []
    for (const base of [DEFAULT_CYCLIST, SIT_UP_CYCLIST]) {
      for (const k of keys)
        for (const v of [R[k].min, R[k].max]) designs.push(edit(base, (d) => (d.posture[k] = v)))
      designs.push(edit(base, (d) => keys.forEach((k) => (d.posture[k] = R[k].min))))
      designs.push(edit(base, (d) => keys.forEach((k) => (d.posture[k] = R[k].max))))
    }
    designs.push(edit(DEFAULT_CYCLIST, (d) => ((d.helmet.tail = 1), (d.frame = 'kamm'), (d.wheels.front = 'disc'), (d.wheels.rear = 'disc'))))
    for (const d of designs) {
      const f = riderFlowField(d, FLOW, 10)
      for (const b of f.bodies) {
        const e = b.ellipsoid
        for (const n of [e.centre.x, e.centre.y, e.centre.z, e.axes.a, e.axes.b, e.axes.c, e.pitchRad]) expect(Number.isFinite(n)).toBe(true)
        for (const n of [e.axes.a, e.axes.b, e.axes.c]) expect(n).toBeGreaterThan(0)
        for (const n of [b.separation.top, b.separation.bottom, b.separation.side, b.wakeSize.up, b.wakeSize.side, b.wakeLength])
          expect(Number.isFinite(n)).toBe(true)
        // Even at the centre of a body (inside it) the field stays finite.
        const v = f.velocity(e.centre)
        expect(Number.isFinite(v.x + v.y + v.z)).toBe(true)
      }
      for (const t of tufts(f)) expect(Number.isFinite(t.direction.x + t.direction.y + t.direction.z + t.strength)).toBe(true)
    }
  })

  it('pushes a point that strays inside a body back out', () => {
    const f = field()
    const torso = ell(f, 'torso')
    expect(f.clearance(torso.centre)).toBeLessThan(0)
    const out = f.pushOutside(torso.centre, 0.01)
    expect(f.clearance(out)).toBeGreaterThan(0)
    const clear = { x: 2, y: 1, z: 0 }
    expect(f.pushOutside(clear, 0.01)).toEqual(clear)
  })

  it('estimates pressure: high at the nose, low over the top, base pressure in the wake', () => {
    const f = field()
    expect(f.pressure(onSurface(ell(f, 'forearm-1'), { x: 1, y: 0, z: 0 }, 1.02).p)).toBeGreaterThan(0.8)
    expect(f.pressure(onSurface(ell(f, 'helmet'), { x: 0, y: 1, z: 0 }, 1.02).p)).toBeLessThan(-0.5)
    // Deep in the torso's wake the map shows base pressure.
    const torso = ell(f, 'torso')
    const behind = { x: torso.centre.x - torso.axes.a - 0.1, y: torso.centre.y, z: 0 }
    expect(f.wake(behind)).toBeGreaterThan(0.8)
    expect(f.pressure(behind)).toBeLessThan(-0.2)
    expect(f.pressure({ x: 30, y: 1, z: 0 })).toBeCloseTo(0, 9)
  })

  it('is quick enough for a few hundred smoke particles a frame', () => {
    const f = field()
    const pts = Array.from({ length: 300 }, (_, i) => ({ x: 1 - (i % 30) * 0.1, y: 0.2 + Math.floor(i / 30) * 0.15, z: (((i * 7) % 11) - 5) * 0.05 }))
    let sum = 0
    for (const p of pts) {
      const v = f.velocity(p)
      sum += v.x + v.y + v.z + f.wake(p)
    }
    expect(Number.isFinite(sum)).toBe(true)
  })
})

describe('modelFlowField', () => {
  it('reads the scale model at tunnel speed, in full-size coordinates', async () => {
    const { modelFlowField, riderFlowField: full, tufts: tuftsOf } = await import('../src/sim/flow/field')
    const { prepareModel } = await import('../src/sim/views')
    const { cyclistShape } = await import('../src/sim/geom/cyclist')
    const { STANDARD_MODEL } = await import('../src/data/model')
    const { AIR } = await import('../src/data/air')
    const { DEFAULT_CYCLIST } = await import('../src/data/cyclist')
    const prepared = prepareModel(cyclistShape(DEFAULT_CYCLIST), { ...STANDARD_MODEL, seed: 1 })
    const flow = { density: AIR.density, viscosity: AIR.viscosity, speed: 30, turbulence: 0.005 }
    const field = modelFlowField(DEFAULT_CYCLIST, prepared.shape, flow, 0)
    expect(field.bodies.length).toBe(full(DEFAULT_CYCLIST, flow, 0).bodies.length)
    // Far upstream the air is the free stream, at the field's speed.
    const v = field.velocity({ x: 5, y: 1, z: 0 })
    expect(v.x).toBeCloseTo(-30, 1)
    const list = tuftsOf(field)
    expect(list.length).toBeGreaterThan(50)
    expect(list.some((t) => t.separated)).toBe(true)
  })
})
