/**
 * The rider and bike as a three.js group, drawn from a design and its pose.
 * Shared by the Shape screen and the tunnel (where it stands on the mount at
 * model scale). Limbs come from the pose (src/sim/geom/pose.ts); the aero
 * helmet's outline is the very cross-section stack the aero model reads, so a
 * longer tail on screen is a longer tail in the sim. Parts that break the
 * rules glow red; the part of the posture that strains the rider most glows
 * amber.
 */
import * as THREE from 'three'
import { BIKE, HELMET, type CyclistDesign } from '../data/cyclist'
import { FRAME, SKELETON } from '../data/pose'
import { cyclistShape } from '../sim/geom/cyclist'
import type { Point, Pose } from '../sim/geom/pose'

const COLOURS = {
  suit: 0x2b3a4a,
  suitPanel: 0x2456e8,
  skin: 0xc99a7a,
  helmet: 0xf5f7f9,
  visor: 0x3c4650,
  frame: 0x3c4650,
  tyre: 0x1d242b,
  rim: 0x8c97a1,
  disc: 0x5d6873,
  bars: 0x5d6873,
  trip: 0xe08a00,
  broken: 0xd2462b,
  strain: 0xe08a00,
}

/** Which drawn groups a rule break or a strained posture lights up. */
export type Highlight = 'helmet' | 'hands' | 'front-wheel' | 'frame' | 'torso' | 'head' | 'arms'

export interface RiderState {
  design: CyclistDesign
  pose: Pose
  broken: Highlight[]
  strained: Highlight[]
}

export const v3 = (p: Point) => new THREE.Vector3(p.x, p.y, p.z)
const UP = new THREE.Vector3(0, 1, 0)

// --- Materials, shared and reused across rebuilds.
const mat = (color: number, roughness = 0.6, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })
const M = {
  suit: mat(COLOURS.suit, 0.55),
  suitTextured: mat(COLOURS.suit, 0.95),
  panel: mat(COLOURS.suitPanel, 0.5),
  skin: mat(COLOURS.skin, 0.7),
  helmet: mat(COLOURS.helmet, 0.35),
  visor: mat(COLOURS.visor, 0.2, 0.3),
  frame: mat(COLOURS.frame, 0.4, 0.3),
  tyre: mat(COLOURS.tyre, 0.9),
  rim: mat(COLOURS.rim, 0.35, 0.5),
  disc: new THREE.MeshStandardMaterial({ color: COLOURS.disc, roughness: 0.4, metalness: 0.2, side: THREE.DoubleSide }),
  bars: mat(COLOURS.bars, 0.4, 0.3),
  trip: mat(COLOURS.trip, 0.6),
  broken: new THREE.MeshStandardMaterial({ color: COLOURS.broken, emissive: COLOURS.broken, emissiveIntensity: 0.35, roughness: 0.5 }),
  strain: new THREE.MeshStandardMaterial({ color: COLOURS.strain, emissive: COLOURS.strain, emissiveIntensity: 0.25, roughness: 0.6 }),
}

/** A rounded rod from a to b. */
export function rod(a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material, squash?: { deep: number; thin: number }) {
  const len = a.distanceTo(b)
  const geo = new THREE.CapsuleGeometry(radius, Math.max(0.001, len), 4, 12)
  const mesh = new THREE.Mesh(geo, material)
  if (squash) mesh.scale.set(squash.deep, 1, squash.thin)
  const dir = b.clone().sub(a).normalize()
  mesh.quaternion.setFromUnitVectors(UP, dir)
  mesh.position.copy(a).add(b).multiplyScalar(0.5)
  return mesh
}

export function ball(at: THREE.Vector3, radius: number, material: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), material)
  mesh.position.copy(at)
  return mesh
}

/** The helmet from the aero model's own cross-sections, as a solid of revolution. */
function helmetMesh(design: CyclistDesign, material: THREE.Material): THREE.Object3D {
  const body = cyclistShape(design).bodies.find((b) => b.id === 'helmet')
  if (!body) return new THREE.Group()
  const st = body.stations
  const length = st[st.length - 1]!.x
  const maxHalf = Math.max(...st.map((s) => s.half), 1e-6)
  const maxTop = Math.max(...st.map((s) => s.top), 1e-6)
  const pts = st.map((s) => new THREE.Vector2(Math.max(0.0005, s.half / maxHalf), s.x))
  const geo = new THREE.LatheGeometry(pts, 24)
  const mesh = new THREE.Mesh(geo, material)
  // Lathe runs along +y; lay it along −x (nose forward), then size it.
  const g = new THREE.Group()
  mesh.rotation.z = Math.PI / 2
  mesh.scale.set(maxTop, 1, maxHalf)
  mesh.position.x = length * 0.3
  g.add(mesh)
  return g
}

function wheel(axleX: number, kind: CyclistDesign['wheels']['front'], material?: THREE.Material): THREE.Group {
  const g = new THREE.Group()
  const r = FRAME.wheelRadius
  const tyre = new THREE.Mesh(new THREE.TorusGeometry(r - 0.012, 0.013, 10, 48), material ?? M.tyre)
  g.add(tyre)
  if (kind === 'disc') {
    g.add(new THREE.Mesh(new THREE.CircleGeometry(r - 0.02, 48), material ?? M.disc))
  } else {
    const rimDepth = kind === 'deep' ? BIKE.wheelDiameter * BIKE.deepChord * 0.5 : 0.022
    g.add(new THREE.Mesh(new THREE.RingGeometry(r - 0.02 - rimDepth, r - 0.02, 48), material ?? (kind === 'deep' ? M.disc : M.rim)))
    const spokes = 16
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2
      const inner = new THREE.Vector3(0, 0, 0)
      const outer = new THREE.Vector3(Math.cos(a) * (r - 0.02 - rimDepth), Math.sin(a) * (r - 0.02 - rimDepth), 0)
      g.add(rod(inner, outer, 0.0015, M.rim))
    }
  }
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 12).rotateX(Math.PI / 2), M.rim))
  g.position.set(axleX, r, 0)
  return g
}

/** The rider and bike for a design, as a fresh group (dispose it with disposeGroup). */
export function buildRider(state: RiderState): THREE.Group {
  const { design, pose } = state
  const g = new THREE.Group()
  const isBroken = (h: Highlight) => state.broken.includes(h)
  const isStrained = (h: Highlight) => state.strained.includes(h)
  const tint = (h: Highlight, base: THREE.Material) => (isBroken(h) ? M.broken : isStrained(h) ? M.strain : base)
  const suit = design.suit.fabric === 'textured' ? M.suitTextured : M.suit

  // Bike frame.
  const bb = new THREE.Vector3(SKELETON.bottomBracket.x, SKELETON.bottomBracket.y, 0)
  const ht = new THREE.Vector3(FRAME.headTop.x, FRAME.headTop.y, 0)
  const hb = new THREE.Vector3(FRAME.headBottom.x, FRAME.headBottom.y, 0)
  const st = new THREE.Vector3(FRAME.seatTop.x, FRAME.seatTop.y, 0)
  const rear = new THREE.Vector3(FRAME.rearAxleX, FRAME.wheelRadius, 0)
  const front = new THREE.Vector3(FRAME.frontAxleX, FRAME.wheelRadius, 0)
  const frameMat = tint('frame', M.frame)
  const squash = design.frame === 'kamm' ? { deep: 2.2, thin: 0.75 } : undefined
  const tr = FRAME.tubeRadius
  for (const [a, b] of [
    [bb, st],
    [st, ht],
    [bb, hb],
    [hb, ht],
  ] as const)
    g.add(rod(a, b, tr, frameMat, squash))
  for (const z of [-0.06, 0.06]) {
    const off = new THREE.Vector3(0, 0, z)
    g.add(rod(bb.clone().add(off), rear.clone().add(off), tr * 0.6, frameMat))
    g.add(rod(st.clone().add(off), rear.clone().add(off), tr * 0.55, frameMat))
    g.add(rod(hb.clone().add(off.clone().multiplyScalar(0.8)), front.clone().add(off.clone().multiplyScalar(0.8)), tr * 0.7, frameMat, squash))
  }
  const saddle = new THREE.Vector3(SKELETON.bottomBracket.x + SKELETON.saddle.x, SKELETON.bottomBracket.y + SKELETON.saddle.y, 0)
  g.add(rod(st, saddle, tr * 0.8, frameMat))
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.12), M.tyre)
  seat.position.copy(saddle).add(new THREE.Vector3(0.02, 0.015, 0))
  g.add(seat)
  g.add(wheel(FRAME.rearAxleX, design.wheels.rear))
  g.add(wheel(FRAME.frontAxleX, design.wheels.front, isBroken('front-wheel') ? M.broken : undefined))
  // Cranks.
  for (const f of pose.foot) g.add(rod(bb.clone().setZ(f.z), v3(f), 0.012, M.bars))

  // Bars.
  const barMat = tint('hands', M.bars)
  const stem = ht.clone().add(new THREE.Vector3(0.08, 0.02, 0))
  g.add(rod(ht, stem, 0.016, M.bars))
  if (design.bars === 'aero') {
    g.add(rod(stem.clone().setZ(-0.2), stem.clone().setZ(0.2), 0.013, M.bars))
    pose.hand.forEach((h, i) => {
      const hand = v3(h)
      const elbow = v3(pose.elbow[i]!)
      const start = new THREE.Vector3(stem.x, hand.y - 0.03, hand.z)
      g.add(rod(stem.clone().setZ(hand.z), start, 0.012, barMat))
      g.add(rod(start, hand.clone().add(new THREE.Vector3(0.02, -0.03, 0)), 0.011, barMat))
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.08), M.tyre)
      pad.position.copy(elbow).add(new THREE.Vector3(0.02, -0.06, 0))
      g.add(pad)
      g.add(rod(new THREE.Vector3(pad.position.x, stem.y, hand.z), pad.position, 0.01, M.bars))
    })
  } else {
    const top = stem.clone().add(new THREE.Vector3(0.02, 0, 0))
    g.add(rod(top.clone().setZ(-0.21), top.clone().setZ(0.21), 0.013, barMat))
    pose.hand.forEach((h) => {
      const end = top.clone().setZ(Math.sign(h.z) * 0.21)
      g.add(rod(end, v3(h), 0.013, barMat))
    })
  }

  // Rider: legs, torso, arms, head.
  for (let i = 0; i < 2; i++) {
    g.add(rod(v3(pose.hip[i]!), v3(pose.knee[i]!), 0.07, suit))
    g.add(rod(v3(pose.knee[i]!), v3(pose.foot[i]!), 0.05, suit))
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.05, 0.08), M.tyre)
    shoe.position.copy(v3(pose.foot[i]!)).add(new THREE.Vector3(0.04, 0.01, 0))
    g.add(shoe)
  }
  const hipC = v3(pose.hip[0]).add(v3(pose.hip[1])).multiplyScalar(0.5)
  const shC = v3(pose.shoulder[0]).add(v3(pose.shoulder[1])).multiplyScalar(0.5)
  const torsoWidth = (0.3 + 0.25 * design.posture.armWidth) / 0.22
  const torso = rod(hipC, shC, 0.11, tint('torso', suit))
  torso.scale.set(1, 1, torsoWidth)
  g.add(torso)
  const stripe = rod(hipC.clone().setZ(0.001), shC.clone().setZ(0.001), 0.112, M.panel)
  stripe.scale.set(0.35, 0.98, torsoWidth * 1.01)
  g.add(stripe)

  const armMat = tint('arms', suit)
  for (let i = 0; i < 2; i++) {
    const sh = v3(pose.shoulder[i]!)
    const el = v3(pose.elbow[i]!)
    const hand = v3(pose.hand[i]!)
    g.add(rod(sh, el, 0.05, armMat))
    g.add(rod(el, hand, 0.045, isBroken('hands') ? M.broken : armMat))
    g.add(ball(hand, 0.04, M.tyre))
    if (design.suit.armTrips) {
      const band = rod(sh.clone().lerp(el, 0.35), sh.clone().lerp(el, 0.42), 0.053, M.trip)
      g.add(band)
    }
  }
  const neck = v3(pose.neck)
  g.add(rod(shC, neck, 0.05, tint('head', M.skin)))
  const head = v3(pose.head)
  g.add(ball(head, SKELETON.headRadius * 0.85, M.skin))

  // Helmet, tilted with the head; its centre sits a little above the head's.
  const helmetMat = tint('helmet', M.helmet)
  const helmet = design.helmet.kind === 'aero' ? helmetMesh(design, helmetMat) : roadHelmet(helmetMat)
  helmet.position.copy(v3(pose.helmet))
  helmet.rotation.z = (pose.headPitchDeg * Math.PI) / 180
  g.add(helmet)
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 8, -0.9, 1.8, 1.2, 0.7), M.visor)
  visor.rotation.y = Math.PI / 2
  visor.position.copy(head).add(new THREE.Vector3(0.02, 0, 0))
  visor.rotation.z = (pose.headPitchDeg * Math.PI) / 180
  g.add(visor)

  return g
}

function roadHelmet(material: THREE.Material): THREE.Object3D {
  const r = HELMET.road
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.62), material)
  mesh.scale.set(r.length, r.height * 1.1, r.width)
  return mesh
}

/** Frees the geometry a built group made (materials are shared and kept). */
export function disposeGroup(group: THREE.Object3D) {
  group.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) o.geometry.dispose()
  })
}
