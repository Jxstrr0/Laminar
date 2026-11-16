/**
 * The rider and bike (or the skater, PR 8b) as a three.js group, drawn from
 * a design and its pose. A truck (PR 9b) is drawn by truckFigure.ts, a car (PR 9j) by carFigure.ts, a record car (PR 9q) by recordFigure.ts.
 * Shared by the Shape screen and the tunnel (where it stands on the mount at
 * model scale). Limbs come from the pose (src/sim/geom/pose.ts); the aero
 * helmet's outline is the very cross-section stack the aero model reads, so a
 * longer tail on screen is a longer tail in the sim. Parts that break the
 * rules glow red; the part of the posture that strains the rider most glows
 * amber.
 */
import * as THREE from 'three'
import { BIKE, HELMET, type CyclistDesign } from '../data/cyclist'
import { BOB_SKELETON, FRAME, JUMPER_SKELETON, SKATER_SKELETON, SKELETON } from '../data/pose'
import type { SkaterDesign } from '../data/skater'
import { JUMP_SKIS, type JumperDesign } from '../data/jumper'
import type { JumperPose } from '../sim/geom/jumperPose'
import { SLED, type BobsledDesign } from '../data/bobsled'
import { sledShape } from '../sim/geom/bobsled'
import type { BobsledPose } from '../sim/geom/bobsledPose'
import type { Design } from '../data/sport'
import { cyclistShape } from '../sim/geom/cyclist'
import { skaterShape } from '../sim/geom/skater'
import type { BodySpec } from '../sim/geom/body'
import type { Point, Pose } from '../sim/geom/pose'
import { buildTruck } from './truckFigure'
import { buildCar } from './carFigure'
import { buildRecord } from './recordFigure'

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
  blade: 0xb8c2cb,
  cap: 0x5d6873,
  ski: 0xe6ebef,
  skiStripe: 0x2456e8,
  sled: 0x2456e8,
  broken: 0xd2462b,
  strain: 0xe08a00,
}

/** Which drawn groups a rule break or a strained posture lights up. */
export type Highlight = 'helmet' | 'hands' | 'front-wheel' | 'frame' | 'torso' | 'head' | 'arms' | 'legs' | 'fairing' | 'skirts' | 'boat-tail' | 'floor' | 'rear-wing' | 'front-wing' | 'inlet' | 'nose' | 'canopy' | 'fin' | 'fairings' | 'waist'

export interface RiderState {
  design: Design
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
  blade: mat(COLOURS.blade, 0.25, 0.8),
  cap: mat(COLOURS.cap, 0.95),
  ski: mat(COLOURS.ski, 0.3, 0.1),
  skiStripe: mat(COLOURS.skiStripe, 0.4),
  sled: new THREE.MeshStandardMaterial({ color: COLOURS.sled, roughness: 0.3, metalness: 0.1, side: THREE.DoubleSide }),
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
  return latheMesh(cyclistShape(design).bodies.find((b) => b.id === 'helmet'), material)
}

/** A body from the aero model's cross-sections, as a solid of revolution laid nose forward. */
function latheMesh(body: BodySpec | undefined, material: THREE.Material): THREE.Object3D {
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

function wheel(axleX: number, kind: CyclistDesign['wheels']['front'], material?: THREE.Material, spokes = 16): THREE.Group {
  const g = new THREE.Group()
  const r = FRAME.wheelRadius
  const tyre = new THREE.Mesh(new THREE.TorusGeometry(r - 0.012, 0.013, 10, 48), material ?? M.tyre)
  g.add(tyre)
  if (kind === 'disc') {
    g.add(new THREE.Mesh(new THREE.CircleGeometry(r - 0.02, 48), material ?? M.disc))
  } else {
    const rimDepth = kind === 'deep' ? BIKE.wheelDiameter * BIKE.deepChord * 0.5 : 0.022
    g.add(new THREE.Mesh(new THREE.RingGeometry(r - 0.02 - rimDepth, r - 0.02, 48), material ?? (kind === 'deep' ? M.disc : M.rim)))
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

/** The lab's reference wheel on its own, at the front axle, as a fresh group (dispose it with disposeGroup). */
export function buildReferenceWheel(spokes: number): THREE.Group {
  const g = new THREE.Group()
  g.add(wheel(FRAME.frontAxleX, 'spoked', undefined, spokes))
  return g
}

/** The rider and bike for a design, as a fresh group (dispose it with disposeGroup). */
export function buildRider(state: RiderState): THREE.Group {
  const { pose } = state
  if (state.design.sport === 'skating') return buildSkater(state.design, state)
  if (state.design.sport === 'skijump') return buildJumper(state.design, state)
  if (state.design.sport === 'bobsled') return buildBobsled(state.design, state)
  if (state.design.sport === 'truck') return buildTruck(state.design, state)
  if (state.design.sport === 'car') return buildCar(state.design, state)
  if (state.design.sport === 'record') return buildRecord(state.design, state)
  const design = state.design
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
  // Named so a break in the tunnel can find them (PR 6b).
  const rearWheel = wheel(FRAME.rearAxleX, design.wheels.rear)
  rearWheel.name = 'wheel-rear'
  g.add(rearWheel)
  const frontWheel = wheel(FRAME.frontAxleX, design.wheels.front, isBroken('front-wheel') ? M.broken : undefined)
  frontWheel.name = 'wheel-front'
  g.add(frontWheel)
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
  helmet.name = 'helmet'
  g.add(helmet)
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 8, -0.9, 1.8, 1.2, 0.7), M.visor)
  visor.rotation.y = Math.PI / 2
  visor.position.copy(head).add(new THREE.Vector3(0.02, 0, 0))
  visor.rotation.z = (pose.headPitchDeg * Math.PI) / 180
  g.add(visor)

  return g
}

/** The skater for a design (PR 8b): crouched on the gliding leg, the other pushing out to the side. */
function buildSkater(design: SkaterDesign, state: RiderState): THREE.Group {
  const { pose } = state
  const g = new THREE.Group()
  const S = SKATER_SKELETON
  const isBroken = (h: Highlight) => state.broken.includes(h)
  const isStrained = (h: Highlight) => state.strained.includes(h)
  const tint = (h: Highlight, base: THREE.Material) => (isBroken(h) ? M.broken : isStrained(h) ? M.strain : base)
  const suit = design.suit.fabric === 'textured' ? M.suitTextured : M.suit
  const legMat = tint('legs', suit)

  for (let i = 0; i < 2; i++) {
    const hip = v3(pose.hip[i]!)
    const knee = v3(pose.knee[i]!)
    const ankle = v3(pose.foot[i]!)
    g.add(rod(hip, knee, 0.075, legMat))
    g.add(rod(knee, ankle, 0.055, legMat))
    if (design.suit.legTrips) g.add(rod(knee.clone().lerp(ankle, 0.3), knee.clone().lerp(ankle, 0.38), 0.058, M.trip))
    // Boot and blade, along the ice.
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.11, 0.09), M.tyre)
    boot.position.set(ankle.x + 0.03, ankle.y - 0.06, ankle.z)
    g.add(boot)
    const blade = new THREE.Mesh(new THREE.BoxGeometry(S.blade.length, S.blade.height * 0.25, 0.006), M.blade)
    blade.position.set(ankle.x + S.blade.ahead - S.blade.length / 2 + 0.1, S.blade.height * 0.125, ankle.z)
    g.add(blade)
    for (const dx of [-0.08, 0.1]) g.add(rod(new THREE.Vector3(ankle.x + dx, S.blade.height * 0.25, ankle.z), new THREE.Vector3(ankle.x + dx, ankle.y - 0.11, ankle.z), 0.006, M.blade))
  }

  const hipC = v3(pose.hip[0]).add(v3(pose.hip[1])).multiplyScalar(0.5)
  const shC = v3(pose.shoulder[0]).add(v3(pose.shoulder[1])).multiplyScalar(0.5)
  const width = S.shoulderWidth / 0.2
  const torso = rod(hipC, shC, 0.11, tint('torso', suit))
  torso.scale.set(1, 1, width)
  g.add(torso)
  const stripe = rod(hipC.clone().setZ(0.001), shC.clone().setZ(0.001), 0.112, M.panel)
  stripe.scale.set(0.35, 0.98, width * 1.01)
  g.add(stripe)

  const armMat = tint('arms', suit)
  for (let i = 0; i < 2; i++) {
    const sh = v3(pose.shoulder[i]!)
    const el = v3(pose.elbow[i]!)
    const hand = v3(pose.hand[i]!)
    g.add(rod(sh, el, 0.048, armMat))
    g.add(rod(el, hand, 0.042, armMat))
    g.add(ball(hand, 0.038, M.tyre))
  }
  const neck = v3(pose.neck)
  g.add(rod(shC, neck, 0.05, tint('head', suit)))
  const head = v3(pose.head)
  g.add(ball(head, S.headRadius * 0.85, M.skin))

  // A smooth hood (the aero model's own sections) or a knitted cap.
  const headMat = tint('helmet', design.hood === 'hood' ? suit : M.cap)
  const cover = design.hood === 'hood' ? latheMesh(skaterShape(design).bodies.find((b) => b.id === 'head'), headMat) : roadHelmet(headMat)
  cover.position.copy(v3(pose.helmet))
  cover.rotation.z = (pose.headPitchDeg * Math.PI) / 180
  cover.name = 'helmet'
  g.add(cover)
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 8, -0.9, 1.8, 1.2, 0.7), M.visor)
  visor.rotation.y = Math.PI / 2
  visor.position.copy(head).add(new THREE.Vector3(0.02, 0, 0))
  visor.rotation.z = (pose.headPitchDeg * Math.PI) / 180
  g.add(visor)
  return g
}

/**
 * The ski jumper in flight (PR 8d): lying out over the skis, arms back along
 * the sides, skis spread in a V. A baggier suit draws fatter limbs and a
 * wider body. The body glows amber when the flight is short of the
 * stability floor, red when it would pitch over.
 */
function buildJumper(design: JumperDesign, state: RiderState): THREE.Group {
  const pose = state.pose as JumperPose
  const g = new THREE.Group()
  const S = JUMPER_SKELETON
  const isBroken = (h: Highlight) => state.broken.includes(h)
  const isStrained = (h: Highlight) => state.strained.includes(h)
  const tint = (h: Highlight, base: THREE.Material) => (isBroken(h) ? M.broken : isStrained(h) ? M.strain : base)
  const bag = 1 + JUMPER_BAG_DRAW * Math.min(1, Math.max(0, design.suit.bagginess))
  const suit = M.suit
  const along = new THREE.Vector3(1, 0, 0)

  // Skis: long thin boards from tail to tip, a cobalt stripe down the middle, tips turned up.
  for (const ski of pose.skis) {
    const tail = v3(ski.tail)
    const tip = v3(ski.tip)
    const len = tail.distanceTo(tip)
    const dir = tip.clone().sub(tail).normalize()
    const board = new THREE.Mesh(new THREE.BoxGeometry(len, S.skiThick, JUMP_SKIS.width), M.ski)
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(len * 0.96, S.skiThick * 1.1, JUMP_SKIS.width * 0.3), M.skiStripe)
    for (const m of [board, stripe]) {
      m.quaternion.setFromUnitVectors(along, dir)
      m.position.copy(tail).add(tip).multiplyScalar(0.5)
      g.add(m)
    }
    g.add(rod(tip, tip.clone().addScaledVector(dir, 0.06).add(new THREE.Vector3(0, 0.03, 0)), S.skiThick / 2, M.ski))
  }

  const legMat = tint('legs', suit)
  for (let i = 0; i < 2; i++) {
    const hip = v3(pose.hip[i]!)
    const knee = v3(pose.knee[i]!)
    const foot = v3(pose.foot[i]!)
    g.add(rod(hip, knee, 0.07 * bag, legMat))
    g.add(rod(knee, foot, 0.055 * bag, legMat))
    const ski = pose.skis[i]!
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.11), M.tyre)
    boot.quaternion.setFromUnitVectors(along, v3(ski.tip).sub(v3(ski.tail)).normalize())
    boot.position.copy(foot).add(new THREE.Vector3(0, 0.05, 0))
    g.add(boot)
  }

  const hipC = v3(pose.hip[0]).add(v3(pose.hip[1])).multiplyScalar(0.5)
  const shC = v3(pose.shoulder[0]).add(v3(pose.shoulder[1])).multiplyScalar(0.5)
  const width = (S.shoulderWidth / 0.2) * bag
  const torso = rod(hipC, shC, 0.11, tint('torso', suit))
  torso.scale.set(0.85, 1, width)
  g.add(torso)
  const stripe = rod(hipC.clone().setZ(0.001), shC.clone().setZ(0.001), 0.112, M.panel)
  stripe.scale.set(0.3, 0.98, width * 1.01)
  g.add(stripe)

  const armMat = tint('arms', suit)
  for (let i = 0; i < 2; i++) {
    const sh = v3(pose.shoulder[i]!)
    const el = v3(pose.elbow[i]!)
    const hand = v3(pose.hand[i]!)
    g.add(rod(sh, el, 0.05 * bag, armMat))
    g.add(rod(el, hand, 0.045 * bag, armMat))
    g.add(ball(hand, 0.04, M.tyre))
  }
  const neck = v3(pose.neck)
  g.add(rod(shC, neck, 0.05, tint('head', suit)))
  const head = v3(pose.head)
  g.add(ball(head, S.headRadius * 0.85, M.skin))
  const helmet = roadHelmet(tint('helmet', M.helmet))
  helmet.position.copy(v3(pose.helmet))
  helmet.rotation.z = (pose.headPitchDeg * Math.PI) / 180
  helmet.name = 'helmet'
  g.add(helmet)
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 8, -0.9, 1.8, 1.2, 0.7), M.visor)
  visor.rotation.y = Math.PI / 2
  visor.position.copy(head).add(new THREE.Vector3(0.02, 0, 0))
  visor.rotation.z = (pose.headPitchDeg * Math.PI) / 180
  g.add(visor)
  return g
}

/**
 * The bobsled (PR 8m): the hull from the sim's own cross-sections (the
 * same stations the drag model reads), open over the cockpit, on four
 * runners, with the crew folded inside. The hull glows red when it breaks
 * the rule box; the driver's helmet glows amber when they can't see over
 * the cowling.
 */
function buildBobsled(design: BobsledDesign, state: RiderState): THREE.Group {
  const pose = state.pose as BobsledPose
  const g = new THREE.Group()
  const isBroken = (h: Highlight) => state.broken.includes(h)
  const isStrained = (h: Highlight) => state.strained.includes(h)
  const hullMat = isBroken('frame') ? M.broken : M.sled
  g.add(sledHull(design, hullMat))

  // Runners: a pair at the front of the cockpit (they steer) and a pair at its back.
  const body = SLED.body[design.crew]
  const runnerLen = 0.62
  for (const x of [body / 2 - runnerLen / 2, -body / 2 + runnerLen / 2]) {
    for (const z of [-1, 1]) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(runnerLen, SLED.floor * 0.7, 0.014), M.blade)
      blade.position.set(x, SLED.floor * 0.35, z * SLED.width * 0.42)
      g.add(blade)
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.06, SLED.floor * 0.5, 0.02), M.frame)
      strut.position.set(x, SLED.floor * 0.8, z * SLED.width * 0.42)
      g.add(strut)
    }
  }

  // The crew: the same fold at each seat, the driver first.
  pose.seats.forEach((dx, i) => {
    const at = (p: Point) => v3(p).add(new THREE.Vector3(dx, 0, 0))
    const S = BOB_SKELETON
    for (let k = 0; k < 2; k++) {
      g.add(rod(at(pose.hip[k]!), at(pose.knee[k]!), 0.065, M.suit))
      g.add(rod(at(pose.knee[k]!), at(pose.foot[k]!), 0.05, M.suit))
      g.add(rod(at(pose.shoulder[k]!), at(pose.elbow[k]!), 0.045, M.suit))
      g.add(rod(at(pose.elbow[k]!), at(pose.hand[k]!), 0.04, M.suit))
      g.add(ball(at(pose.hand[k]!), 0.035, M.tyre))
    }
    const hipC = at(pose.hip[0]).add(at(pose.hip[1])).multiplyScalar(0.5)
    const shC = at(pose.shoulder[0]).add(at(pose.shoulder[1])).multiplyScalar(0.5)
    const torso = rod(hipC, shC, 0.11, M.suit)
    torso.scale.set(0.9, 1, S.shoulderWidth / 0.22)
    g.add(torso)
    g.add(rod(shC, at(pose.neck), 0.05, M.suit))
    const driver = i === 0
    const helmetMat = driver && isBroken('helmet') ? M.broken : driver && isStrained('helmet') ? M.strain : M.helmet
    const helmet = ball(at(pose.head), S.helmetRadius, helmetMat)
    helmet.scale.set(1.1, 1, 0.92)
    g.add(helmet)
    const visor = new THREE.Mesh(new THREE.SphereGeometry(S.helmetRadius * 1.02, 16, 8, -0.9, 1.8, 1.3, 0.6), M.visor)
    visor.rotation.y = Math.PI / 2
    visor.rotation.z = (pose.headPitchDeg * Math.PI) / 180
    visor.position.copy(at(pose.head))
    g.add(visor)
  })
  return g
}

/** Sides of each hull ring. */
const HULL_SIDES = 28

/**
 * The hull as a shell through the sim's stations: each a rounded-square
 * ring (as square as the drag model reads it), laid nose forward with the
 * cockpit's middle at x = 0. Over the cockpit the top of each ring is left
 * open, so the crew sit in it.
 */
function sledHull(design: BobsledDesign, material: THREE.Material): THREE.Mesh {
  const body = sledShape(design).bodies[0]!
  const half = (design.sled.cowl - SLED.floor) / 2
  const centreY = SLED.floor + half
  const toX = (x: number) => design.sled.nose + SLED.body[design.crew] / 2 - x
  const exp = 2 / (2 + 6 * SLED.squareness)
  const sgnPow = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), exp)
  const positions: number[] = []
  for (const st of body.stations) {
    for (let k = 0; k < HULL_SIDES; k++) {
      const a = (k / HULL_SIDES) * Math.PI * 2
      positions.push(toX(st.x), centreY + st.top * sgnPow(Math.sin(a)), st.half * sgnPow(Math.cos(a)))
    }
  }
  // The cockpit opening: from just behind the nose to the tail's start, the top third of the ring.
  const openFrom = design.sled.nose + 0.08
  const openTo = design.sled.nose + SLED.body[design.crew] + 0.1
  const index: number[] = []
  const n = body.stations.length
  for (let i = 0; i < n - 1; i++) {
    const x = body.stations[i]!.x
    const open = x >= openFrom && x <= openTo
    for (let k = 0; k < HULL_SIDES; k++) {
      const k2 = (k + 1) % HULL_SIDES
      const mid = Math.sin(((k + 0.5) / HULL_SIDES) * Math.PI * 2)
      if (open && mid > 0.55) continue
      const a = i * HULL_SIDES + k
      const b = i * HULL_SIDES + k2
      const c = (i + 1) * HULL_SIDES + k
      const d = (i + 1) * HULL_SIDES + k2
      index.push(a, c, b, b, c, d)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(index)
  geo.computeVertexNormals()
  return new THREE.Mesh(geo, material)
}

/** The baggiest suit draws limbs and body this much fatter (× 1 + this). */
const JUMPER_BAG_DRAW = 0.45

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
