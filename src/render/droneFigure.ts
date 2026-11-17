/**
 * The racing quad as a three.js group (PR 10b), drawn from the design at
 * full size. The pod is lofted from the very cross-sections its outline
 * gives the drag model (src/sim/geom/drone.ts) and tipped up on the frame by
 * its rake. The parts the firm shapes are drawn in the model shop's teal
 * so they read at a glance: the pod and the arm fairings; the vents are dark
 * slots down the pod's sides, more of them the more are open.
 *
 * Built nose along +x, +z to the right, the frame plate's middle at the
 * origin, lifted to its hover height. With a `tilt` the whole quad leans
 * nose-down by it, as it flies flat out, and streaks of oncoming air are
 * drawn ahead of it. A part behind a warning (too much
 * twist, closed vents) glows amber.
 */
import * as THREE from 'three'
import { MODEL } from './theme'
import { DRONE_AERO, DRONE_BODY, type DroneDesign } from '../data/drone'
import { podEnds, podHeight, podStation } from '../sim/geom/drone'
import type { Highlight } from './riderFigure'

const COLOURS = {
  carbon: 0x2a3a47,
  motor: 0x8c97a1,
  prop: 0x5a6875,
  lens: 0x13202b,
  part: MODEL.panel,
  broken: MODEL.broken,
  strain: MODEL.strain,
}

const mat = (color: number, roughness = 0.6, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness, side: THREE.DoubleSide })
const M = {
  carbon: mat(COLOURS.carbon, 0.5, 0.2),
  motor: mat(COLOURS.motor, 0.35, 0.6),
  prop: new THREE.MeshStandardMaterial({ color: COLOURS.prop, roughness: 0.5, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  wind: new THREE.LineBasicMaterial({ color: COLOURS.part, transparent: true, opacity: 0.45 }),
  lens: mat(COLOURS.lens, 0.15, 0.5),
  blade: mat(COLOURS.prop, 0.5),
  part: mat(COLOURS.part, 0.4, 0.1),
  broken: new THREE.MeshStandardMaterial({ color: COLOURS.broken, emissive: COLOURS.broken, emissiveIntensity: 0.35, roughness: 0.5, side: THREE.DoubleSide }),
  strain: new THREE.MeshStandardMaterial({ color: COLOURS.strain, emissive: COLOURS.strain, emissiveIntensity: 0.25, roughness: 0.6, side: THREE.DoubleSide }),
}

/** Fixed sizes for the drawing only (the sim doesn't read these). */
const DRAW = {
  /** Ring points round each lofted section of the pod, and sections along it. */
  ring: 20,
  steps: 16,
  /** How square the pod's sections are drawn: 1 round, smaller squarer. */
  squarePow: 0.45,
  /** The vent slots: their length along the pod and height, m. */
  slot: 0.014,
  slotHeight: 0.006,
  /** The wind streaks drawn ahead of a quad shown flying: how far ahead they start and end, m, their heights round the quad's middle, and the arrowheads' size. */
  windFrom: 0.33,
  windTo: 0.17,
  windAt: [-0.05, 0, 0.05],
  arrow: 0.018,
  /** A prop blade's width and thickness, m. */
  blade: 0.009,
  bladeThick: 0.0012,
}

export interface DroneLook {
  broken: Highlight[]
  strained: Highlight[]
  /** Lean the quad nose-down by this, radians (as it flies flat out); level if left out. */
  tilt?: number
  /**
   * How the props are drawn: a faint blur disc as it flies (the default), or
   * two-bladed props for the tunnel, still or spinning. Spinning ones are
   * named 'rotor' for the tunnel scene to turn each frame (PR 10e).
   */
  props?: 'disc' | 'stopped' | 'spinning'
}

/** A rounded-box ring point: cos and sin pushed towards the corners. */
const squarish = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), DRAW.squarePow)

/** The pod, lofted along its own axis from its back end, then tipped up by its rake. */
function buildPod(design: DroneDesign, material: THREE.Material): THREE.Mesh {
  const n = DRAW.ring
  const len = design.pod.length
  const positions: number[] = []
  const index: number[] = []
  // Sections from the back (x = 0 here) to the nose; the sim's stations run from the nose.
  for (let i = 0; i <= DRAW.steps; i++) {
    const along = (len * i) / DRAW.steps
    const st = podStation(design, len - along)
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2
      positions.push(along, st.top * squarish(Math.sin(a)), st.half * squarish(Math.cos(a)))
    }
  }
  for (let i = 0; i < DRAW.steps; i++) {
    for (let k = 0; k < n; k++) {
      const a = i * n + k
      const c = i * n + ((k + 1) % n)
      index.push(a, a + n, c, c, a + n, c + n)
    }
  }
  // Close both ends with a fan to their middle.
  for (const end of [0, DRAW.steps]) {
    const centre = positions.length / 3
    positions.push((len * end) / DRAW.steps, 0, 0)
    for (let k = 0; k < n; k++) index.push(centre, end * n + k, end * n + ((k + 1) % n))
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(index)
  geo.computeVertexNormals()
  return new THREE.Mesh(geo, material)
}

export function buildDrone(design: DroneDesign, look: DroneLook): THREE.Group {
  const outer = new THREE.Group()
  const g = new THREE.Group()
  outer.add(g)
  g.position.y = DRONE_BODY.hover
  g.rotation.z = -(look.tilt ?? 0)
  const tint = (h: Highlight, base: THREE.Material) => (look.broken.includes(h) ? M.broken : look.strained.includes(h) ? M.strain : base)
  const B = DRONE_BODY

  // The frame plate.
  g.add(new THREE.Mesh(new THREE.BoxGeometry(B.plate, B.plateThick, B.plateWidth), M.carbon))

  // The arms out to the motors on the diagonals, each with its fairing over the outer share it covers.
  const reach = B.span / 2
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
    const angle = Math.atan2(sz, sx)
    const arm = new THREE.Group()
    arm.rotation.y = -angle
    const bar = new THREE.Mesh(new THREE.BoxGeometry(reach, B.armDepth, B.armWidth), tint('arms', M.carbon))
    bar.position.set(reach / 2, -B.plateThick / 2 - B.armDepth / 2, 0)
    arm.add(bar)
    if (design.arms >= 0.05) {
      // A thin wing-shaped sleeve, as far in from the motor as it covers. Its chord stands up and down:
      // that's the way the props' downwash runs past the arm, and, tilted flat out, the way the oncoming air meets it too.
      const cover = (reach - B.motor * 1.2) * design.arms
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, cover, 16).rotateZ(Math.PI / 2), tint('arms', M.part))
      sleeve.scale.set(1, B.fairChord / 2, B.armWidth * 0.75)
      sleeve.position.set(reach - B.motor * 1.2 - cover / 2, bar.position.y - B.fairChord * 0.2, 0)
      arm.add(sleeve)
    }
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(B.motor, B.motor, B.motorHeight, 16), M.motor)
    motor.position.set(reach, -B.plateThick / 2 + B.motorHeight / 2 - B.armDepth, 0)
    arm.add(motor)
    const propY = motor.position.y + B.motorHeight / 2 + 0.003
    const props = look.props ?? 'disc'
    // Flying, or spinning in the tunnel, the props show as a faint disc.
    if (props !== 'stopped') {
      const prop = new THREE.Mesh(new THREE.CircleGeometry(B.prop, 32).rotateX(-Math.PI / 2), M.prop)
      prop.position.set(reach, propY, 0)
      arm.add(prop)
    }
    // In the tunnel, two blades across each motor: still, or turned by the scene.
    if (props !== 'disc') {
      const rotor = new THREE.Group()
      rotor.name = props === 'spinning' ? 'rotor' : 'blades'
      rotor.position.set(reach, propY, 0)
      rotor.rotation.y = sx * sz * 0.6
      rotor.add(new THREE.Mesh(new THREE.BoxGeometry(B.prop * 2, DRAW.bladeThick, DRAW.blade), M.blade))
      arm.add(rotor)
    }
    g.add(arm)
  }

  // The pod, tipped up by its rake, its back over the plate's middle.
  const { back } = podEnds(design)
  const rake = (design.pod.rake * Math.PI) / 180
  const podGroup = new THREE.Group()
  podGroup.position.set(back.x, back.y, back.z)
  podGroup.rotation.z = rake
  podGroup.add(buildPod(design, tint('pod', M.part)))
  // The camera's lens at the nose.
  const lens = new THREE.Mesh(new THREE.CircleGeometry(podHeight() * 0.28, 20).rotateY(Math.PI / 2), M.lens)
  lens.position.set(design.pod.length + 0.0015, 0, 0)
  podGroup.add(lens)
  // The vents: dark slots down each side, as many as are open, from the front back.
  const slots = Math.round(design.pod.vents * B.ventSlots)
  const ventMat = tint('vents', M.lens)
  for (let i = 0; i < slots; i++) {
    const x = design.pod.length * 0.75 - i * DRAW.slot * 1.6
    for (const side of [-1, 1]) {
      const slot = new THREE.Mesh(new THREE.PlaneGeometry(DRAW.slot, DRAW.slotHeight), ventMat)
      slot.position.set(x, 0, side * (DRONE_AERO.podWidth / 2 + 0.0008))
      podGroup.add(slot)
    }
  }
  g.add(podGroup)

  // Flying, a few streaks of oncoming air ahead of the nose, so the lean reads as flight and the pod's angle to the air shows.
  if (look.tilt !== undefined) {
    const pts: number[] = []
    for (const y of DRAW.windAt) {
      const h = DRONE_BODY.hover + y
      pts.push(DRAW.windFrom, h, 0, DRAW.windTo, h, 0)
      pts.push(DRAW.windTo, h, 0, DRAW.windTo + DRAW.arrow, h + DRAW.arrow * 0.6, 0)
      pts.push(DRAW.windTo, h, 0, DRAW.windTo + DRAW.arrow, h - DRAW.arrow * 0.6, 0)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    outer.add(new THREE.LineSegments(geo, M.wind))
  }
  return outer
}
