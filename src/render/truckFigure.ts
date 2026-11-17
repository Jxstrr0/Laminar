/**
 * The truck as a three.js group (PR 9b), drawn from the design at full
 * size: the cab with its corners rounded to the design's nose radius, the
 * box trailer, the wheels and chassis, and the add-on parts in the
 * model shop's teal so they read at a glance: the roof fairing, the side
 * extenders, the gap filler, the skirts and the boat-tail's panels.
 *
 * Built nose along +x, wheels on y = 0, +z to the right, centred on the
 * rig's middle (src/sim/geom/truckPose.ts). A part the road code forbids
 * glows red; a fairing that misses the trailer's roof glows amber.
 */
import * as THREE from 'three'
import { MODEL } from './theme'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RIG, type TruckDesign } from '../data/truck'
import { doorsAt, truckLength } from '../sim/geom/truck'
import { truckX } from '../sim/geom/truckPose'
import type { Highlight } from './riderFigure'

const COLOURS = {
  cab: 0xf2f4f6,
  trailer: 0xe6ebef,
  chassis: 0x3d4f5c,
  tyre: MODEL.tyre,
  hub: 0x8c97a1,
  glass: 0x2a3a47,
  part: MODEL.panel,
  broken: MODEL.broken,
  strain: MODEL.strain,
}

const mat = (color: number, roughness = 0.6, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })
const M = {
  cab: mat(COLOURS.cab, 0.4, 0.05),
  trailer: mat(COLOURS.trailer, 0.55),
  chassis: mat(COLOURS.chassis, 0.7, 0.2),
  tyre: mat(COLOURS.tyre, 0.9),
  hub: mat(COLOURS.hub, 0.35, 0.5),
  glass: mat(COLOURS.glass, 0.15, 0.4),
  part: new THREE.MeshStandardMaterial({ color: COLOURS.part, roughness: 0.4, metalness: 0.1, side: THREE.DoubleSide }),
  broken: new THREE.MeshStandardMaterial({ color: COLOURS.broken, emissive: COLOURS.broken, emissiveIntensity: 0.35, roughness: 0.5, side: THREE.DoubleSide }),
  strain: new THREE.MeshStandardMaterial({ color: COLOURS.strain, emissive: COLOURS.strain, emissiveIntensity: 0.25, roughness: 0.6, side: THREE.DoubleSide }),
}

/** Fixed sizes for the drawing only (the sim doesn't read these). */
const DRAW = {
  wheelRadius: 0.5,
  tyreWidth: 0.55,
  /** Wheels sit this far out from the middle, m. */
  track: 0.95,
  frontAxle: 1.35,
  /** The drive axle sits this far behind the trailer's front (under the kingpin). */
  driveAxle: 1.4,
  /** The trailer's three axles, m ahead of its doors. */
  bogie: [4.6, 3.3, 2],
  /** Skirts run from this far behind the trailer's front to this far ahead of its doors. */
  skirtFrom: 3.4,
  skirtTo: 5.3,
  /** Panel thickness for skirts, extenders and the boat-tail, m. */
  panel: 0.04,
  /** The gap filler's width across the trailer's front. */
  fillWidth: 1.7,
}

/** A box between two x positions (sim x, downstream), heights and a centre across, in the drawing's frame. */
function slab(design: TruckDesign, x0: number, x1: number, y0: number, y1: number, width: number, z: number, material: THREE.Material): THREE.Mesh {
  const len = Math.max(0.001, x1 - x0)
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, Math.max(0.001, y1 - y0), width), material)
  mesh.position.set(truckX(design, (x0 + x1) / 2), (y0 + y1) / 2, z)
  return mesh
}

/** A quad from four corners (in the drawing's frame), seen from both sides. */
function quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, material: THREE.Material): THREE.Mesh {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute([a, b, c, a, c, d].flatMap((v) => [v.x, v.y, v.z]), 3))
  geo.computeVertexNormals()
  return new THREE.Mesh(geo, material)
}

function wheelPair(design: TruckDesign, x: number): THREE.Group {
  const g = new THREE.Group()
  for (const side of [-1, 1]) {
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(DRAW.wheelRadius, DRAW.wheelRadius, DRAW.tyreWidth, 24).rotateX(Math.PI / 2), M.tyre)
    tyre.position.set(truckX(design, x), DRAW.wheelRadius, side * DRAW.track)
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(DRAW.wheelRadius * 0.45, DRAW.wheelRadius * 0.45, DRAW.tyreWidth + 0.02, 16).rotateX(Math.PI / 2), M.hub)
    hub.position.copy(tyre.position)
    g.add(tyre, hub)
  }
  return g
}

export interface TruckLook {
  broken: Highlight[]
  strained: Highlight[]
}

export function buildTruck(design: TruckDesign, look: TruckLook): THREE.Group {
  const g = new THREE.Group()
  const tint = (h: Highlight) => (look.broken.includes(h) ? M.broken : look.strained.includes(h) ? M.strain : M.part)
  const front = RIG.cab + design.gap.length
  const doors = doorsAt(design)
  const halfW = RIG.width / 2

  // Chassis rails under everything, from the bumper to the bogie.
  g.add(slab(design, 0.2, doors - 1, 0.55, 1.05, 0.9, 0, M.chassis))

  // The cab: a box with its corners rounded to the design's nose radius.
  const cabH = RIG.cabTop - RIG.bodyBottom
  const radius = Math.min(design.cab.nose, 0.45)
  const cab = new THREE.Mesh(new RoundedBoxGeometry(RIG.cab, cabH, RIG.width - 0.05, 5, radius), M.cab)
  cab.position.set(truckX(design, RIG.cab / 2), RIG.bodyBottom + cabH / 2, 0)
  g.add(cab)
  // The windscreen, just proud of the face.
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(RIG.width - 0.5 - radius, 0.85), M.glass)
  glass.rotation.y = Math.PI / 2
  glass.position.set(truckX(design, 0) + 0.005, RIG.cabTop - 0.65, 0)
  g.add(glass)
  // Mirrors on arms at the front corners.
  for (const side of [-1, 1]) g.add(slab(design, 0.25, 0.4, 1.8, 2.3, 0.08, side * (halfW + 0.22), M.chassis))

  // The roof fairing: a curved ramp from the cab roof up to its top at the cab's back wall.
  if (design.cab.fairing > 0.01) {
    const run = RIG.cab - RIG.fairingFrom
    const shape = new THREE.Shape()
    shape.moveTo(0, 0)
    shape.quadraticCurveTo(run * 0.55, design.cab.fairing * 0.95, run, design.cab.fairing)
    shape.lineTo(run, 0)
    shape.lineTo(0, 0)
    const geo = new THREE.ExtrudeGeometry(shape, { depth: RIG.width - 0.2, bevelEnabled: false, curveSegments: 10 })
    geo.translate(0, 0, -(RIG.width - 0.2) / 2)
    const fairing = new THREE.Mesh(geo, tint('fairing'))
    // The shape runs +x from its start; the drawing's +x points forward, so turn it round.
    fairing.rotation.y = Math.PI
    fairing.position.set(truckX(design, RIG.fairingFrom), RIG.cabTop, 0)
    g.add(fairing)
  }

  // Side extenders: panels reaching back from the cab's back corners into the gap.
  if (design.cab.extenders > 0.01) {
    const top = Math.max(RIG.cabTop, RIG.cabTop + design.cab.fairing) - 0.05
    for (const side of [-1, 1]) g.add(slab(design, RIG.cab - 0.02, RIG.cab + design.cab.extenders, 1.1, top, DRAW.panel, side * (halfW - DRAW.panel / 2), M.part))
  }

  // The trailer's box.
  g.add(slab(design, front, doors, RIG.floor, design.trailerTop, RIG.width, 0, M.trailer))
  // The gap filler: a panel on the trailer's front, as deep as it closes the gap.
  if (design.gap.fill > 0.01) g.add(slab(design, front - design.gap.length * design.gap.fill, front, RIG.floor + 0.2, design.trailerTop - 0.1, DRAW.fillWidth, 0, M.part))

  // Skirts down the trailer's sides.
  if (design.trailer.skirts > 0.01) {
    const skirt = tint('skirts')
    for (const side of [-1, 1]) g.add(slab(design, front + DRAW.skirtFrom, doors - DRAW.skirtTo, RIG.floor - design.trailer.skirts, RIG.floor, DRAW.panel, side * (halfW - DRAW.panel / 2), skirt))
  }

  // The boat-tail: top and side panels folding in from the doors (the floor stays open).
  if (design.trailer.tail > 0.01) {
    const tailMat = tint('boat-tail')
    const fold = design.trailer.tail * Math.tan((design.trailer.tailAngle * Math.PI) / 180)
    const x0 = truckX(design, doors)
    const x1 = truckX(design, truckLength(design))
    const top0 = design.trailerTop
    const top1 = design.trailerTop - fold
    const w0 = halfW
    const w1 = halfW - fold
    const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
    g.add(quad(v(x0, top0, -w0), v(x0, top0, w0), v(x1, top1, w1), v(x1, top1, -w1), tailMat))
    for (const side of [-1, 1]) g.add(quad(v(x0, RIG.floor, side * w0), v(x0, top0, side * w0), v(x1, top1, side * w1), v(x1, RIG.floor, side * w1), tailMat))
  }

  // Wheels: the steer axle, the drive axle under the trailer's front, the trailer's bogie.
  g.add(wheelPair(design, DRAW.frontAxle), wheelPair(design, front + DRAW.driveAxle))
  for (const ahead of DRAW.bogie) g.add(wheelPair(design, doors - ahead))
  return g
}
