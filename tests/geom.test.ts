import { describe, expect, it } from 'vitest'
import { PI } from '../src/sim/det'
import { describeBody, describeShape, scaleShape } from '../src/sim/geom/body'
import { box, crossCylinder, sphere, streamlined } from '../src/sim/geom/shapes'

describe('shape descriptors', () => {
  it('measure a sphere', () => {
    const r = 0.125
    const s = describeBody(sphere('s', 2 * r))
    expect(s.frontalArea / (PI * r * r)).toBeCloseTo(1, 2)
    expect(s.sideArea / (PI * r * r)).toBeCloseTo(1, 2)
    expect(s.wettedArea / (4 * PI * r * r)).toBeCloseTo(1, 1)
    expect(s.fineness).toBeCloseTo(1, 2)
    expect(s.sideCentroidX).toBeCloseTo(r, 3)
    expect(s.lines.top.faceArc).toBe(0)
  })
  it('measure a box, flat face and all', () => {
    const b = describeBody(box('b', 4, 2, 1, 0))
    expect(b.frontalArea).toBeCloseTo(2, 9)
    expect(b.sideArea).toBeCloseTo(4, 9)
    expect(b.lines.top.faceArc).toBeCloseTo(0.5, 9)
    expect(b.lines.side.faceArc).toBeCloseTo(1, 9)
  })
  it('give a cross cylinder no front face', () => {
    const c = describeBody(crossCylinder('c', 0.1, 1))
    expect(c.lines.side.faceArc).toBe(0)
    expect(c.frontalArea).toBeCloseTo(0.1, 3)
  })
  it('see a Kamm tail as a steeper close than a long point', () => {
    const long = describeBody(streamlined('l', 1.2, 0.2))
    const short = describeBody(streamlined('s', 0.5, 0.2))
    expect(short.closureDeg).toBeGreaterThan(long.closureDeg)
  })
  it('scale lengths but keep paint and tape real-size', () => {
    const spec = { bodies: [{ ...sphere('s', 1, 0.0001), trip: { at: 0.3, height: 0.001 } }] }
    const full = describeShape(spec)
    const model = describeShape(scaleShape(spec, 0.25))
    expect(model.frontalArea / full.frontalArea).toBeCloseTo(0.0625, 9)
    expect(model.bodies[0]?.roughness).toBe(0.0001)
    expect(model.bodies[0]?.trip?.height).toBe(0.001)
  })
  it('refuse a body with too few sections', () => {
    expect(() => describeBody({ id: 'x', stations: [{ x: 0, top: 0, bottom: 0, half: 0 }] })).toThrow()
  })
})
