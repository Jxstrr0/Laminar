/**
 * The sensor pod as a three.js group (PR 10z), drawn from the design at full
 * size: the pod on its pylon under a stretch of the patrol plane's left
 * wing. The pod is lofted from the very cross-sections its outline gives the
 * drag model (src/sim/geom/pod.ts). The parts the firm shapes are drawn in
 * the instruments' cobalt so they read at a glance: the nose fairing, the
 * tail cone and the pylon. The sensor's middle and the wing are the
 * ministry's, white and grey, with the sensor's dark window underneath.
 *
 * Built nose along +x, z out along the wing, the wing's thickest part at
 * x = 0. A part behind a warning (a buffet past the ministry's limit)
 * glows amber.
 */
import * as THREE from 'three'
import { POD_BODY as B, type PodDesign } from '../data/pod'
import { podMiddleX, podRadius, podX, wingBelow } from '../sim/geom/pod'
import { podLengths, sensorDiameter } from '../sim/pod'
import { loft, surface } from './planeFigure'
import type { Highlight } from './riderFigure'

const COLOURS = {
  white: 0xf3f5f7,
  grey: 0x8c97a1,
  glass: 0x24323f,
  part: 0x2456e8,
  broken: 0xd2462b,
  strain: 0xe08a00,
}

const mat = (color: number, roughness = 0.6, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness, side: THREE.DoubleSide })
const M = {
  white: mat(COLOURS.white, 0.5),
  grey: mat(COLOURS.grey, 0.4, 0.4),
  glass: mat(COLOURS.glass, 0.15, 0.3),
  part: mat(COLOURS.part, 0.45, 0.1),
  broken: new THREE.MeshStandardMaterial({ color: COLOURS.broken, emissive: COLOURS.broken, emissiveIntensity: 0.35, roughness: 0.5, side: THREE.DoubleSide }),
  strain: new THREE.MeshStandardMaterial({ color: COLOURS.strain, emissive: COLOURS.strain, emissiveIntensity: 0.25, roughness: 0.6, side: THREE.DoubleSide }),
}

/** Fixed sizes for the drawing only (the sim doesn't read these). */
const DRAW = {
  /** Sections per metre of pod. */
  perMetre: 24,
  /** The sensor's window: its radius as a share of the sensor's, and how far it sits below the axis as a share. */
  window: 0.45,
  windowDrop: 0.97,
}

export interface PodLook {
  broken: Highlight[]
  strained: Highlight[]
  /** Leave out the wing (a pod model tested on its own, from the tunnel PR). */
  alone?: boolean
}

export function buildPod(design: PodDesign, look: PodLook): THREE.Group {
  const g = new THREE.Group()
  const tint = (h: Highlight, base: THREE.Material) => (look.broken.includes(h) ? M.broken : look.strained.includes(h) ? M.strain : base)
  const l = podLengths(design)
  const r = sensorDiameter(design) / 2

  // The pod: the nose fairing and the tail cone (cobalt, shaped) either side of the sensor's middle.
  const sections = (from: number, to: number) => {
    const n = Math.max(2, Math.ceil((to - from) * DRAW.perMetre))
    const out = []
    for (let i = 0; i <= n; i++) {
      const x = from + ((to - from) * i) / n
      const rad = Math.max(0.004, podRadius(design, x))
      out.push({ x: podX(design, x), top: rad, bottom: rad, half: rad })
    }
    return out
  }
  const lift = (m: THREE.Mesh) => {
    m.position.y = B.axis
    g.add(m)
    return m
  }
  lift(loft(sections(0, l.nose), 1, tint('nose', M.part)))
  lift(loft(sections(l.nose, l.nose + l.middle), 1, M.white, false))
  lift(loft(sections(l.nose + l.middle, l.total), 1, tint('boat-tail', M.part)))

  // The sensor's window, underneath the middle.
  const win = new THREE.Mesh(new THREE.CircleGeometry(r * DRAW.window, 28).rotateX(Math.PI / 2), M.glass)
  win.position.set(podX(design, l.nose + l.middle / 2), B.axis - r * DRAW.windowDrop, 0)
  g.add(win)

  if (look.alone) return g

  // The pylon from the pod's top up to the wing's underside, over the pod's middle.
  const top = B.axis + r * 0.9
  const wingY = B.axis + wingBelow(design)
  const pylonH = Math.max(0.01, wingY - top + 0.02)
  const pylon = surface(B.pylonChord, pylonH, B.pylonThick / B.pylonChord, tint('pylon', M.part))
  pylon.rotation.x = -Math.PI / 2
  pylon.position.set(podMiddleX(design) + B.pylonChord / 2, top, 0)
  g.add(pylon)

  // The stretch of wing above: a white slab of foil, its thickest part at x = 0.
  const thick = B.chord * B.wingThick
  const wing = surface(B.chord, B.wingSpan, B.wingThick, M.grey)
  wing.position.set(B.chord * B.thickestAt, wingY + thick / 2, -B.wingSpan / 2)
  g.add(wing)
  return g
}
