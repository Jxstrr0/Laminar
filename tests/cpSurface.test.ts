import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { CP_PALETTE, TAPS } from '../src/data/flowViz'
import { CP_SURFACE, createCpSurface } from '../src/render/cpSurface'
import { cpRgb } from '../src/render/cpScale'
import type { Tap } from '../src/sim/flow/taps'

/** A marked figure with one plain box, beside an unmarked mount part, under a frame. */
function scene() {
  const frame = new THREE.Group()
  const figure = new THREE.Group()
  figure.userData[CP_SURFACE] = true
  const plain = new THREE.MeshStandardMaterial({ color: 0x3a4170 })
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), plain)
  figure.add(box)
  const far = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.02), plain)
  far.position.set(5, 0, 0)
  figure.add(far)
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), plain)
  frame.add(figure, post)
  return { frame, figure, box, far, post, plain }
}

const tap = (x: number, y: number, z: number): Tap => ({ bodyId: 'torso', point: { x, y, z }, normal: { x: 0, y: 1, z: 0 } })

describe('pressure colour on the model (PR 13i)', () => {
  it('paints only the marked figure, and every vertex near a tap wears the scan', () => {
    const s = scene()
    const surface = createCpSurface()
    // A tap on every corner of the box.
    const taps: Tap[] = []
    for (const x of [-0.1, 0.1]) for (const y of [-0.1, 0.1]) for (const z of [-0.1, 0.1]) taps.push(tap(x, y, z))
    surface.paint(s.frame, s.frame, taps, taps.map(() => -1))
    expect(s.box.material).not.toBe(s.plain)
    expect(s.post.material).toBe(s.plain)
    const col = s.box.geometry.getAttribute('color')
    const cpw = s.box.geometry.getAttribute('cpw')
    expect(col.count).toBe(s.box.geometry.getAttribute('position').count)
    // Every tap reads −1, so every blended vertex reads −1, in the legend's colour.
    const want = new THREE.Color().setRGB(...cpRgb(-1), THREE.SRGBColorSpace)
    for (let v = 0; v < cpw.count; v++) {
      expect(cpw.getX(v)).toBeCloseTo(-1, 5)
      expect(cpw.getY(v)).toBe(1)
      expect(col.getX(v)).toBeCloseTo(want.r, 5)
    }
  })

  it('leaves parts far from every tap in their own colour', () => {
    const s = scene()
    const surface = createCpSurface()
    surface.paint(s.frame, s.frame, [tap(0, 0, 0)], [CP_PALETTE.max])
    const cpw = s.far.geometry.getAttribute('cpw')
    const col = s.far.geometry.getAttribute('color')
    expect(5 - 0.01).toBeGreaterThan(TAPS.spacing * 2)
    for (let v = 0; v < cpw.count; v++) {
      expect(cpw.getY(v)).toBe(0)
      expect(col.getX(v)).toBeCloseTo(s.plain.color.r, 5)
    }
  })

  it('a new scan recolours without re-laying, and clearing gives everything back', () => {
    const s = scene()
    const original = s.box.geometry
    const surface = createCpSurface()
    const taps = [tap(0, 0.1, 0)]
    surface.paint(s.frame, s.frame, taps, [0.5])
    const borrowed = s.box.geometry
    surface.paint(s.frame, s.frame, taps, [-1.5])
    expect(s.box.geometry).toBe(borrowed)
    expect(borrowed.getAttribute('cpw').getX(0)).toBeCloseTo(-1.5, 5)
    surface.clear()
    expect(s.box.geometry).toBe(original)
    expect(s.box.material).toBe(s.plain)
    expect(original.getAttribute('color')).toBeUndefined()
    // An empty scan (the taps off, or the fan too slow) takes the paint off too.
    surface.paint(s.frame, s.frame, taps, [0.2])
    surface.paint(s.frame, s.frame, [], [])
    expect(s.box.material).toBe(s.plain)
  })
})
