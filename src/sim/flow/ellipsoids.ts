/**
 * The rider and bike as a handful of ellipsoids, for the flow the visuals
 * show (plan section 6.7). Each one is fitted to a part the Shape screen
 * draws (src/render/shapeScene.ts: capsules for the limbs and torso, a ball
 * for the head, the helmet's own cross-sections) and linked to the aero
 * body it stands for, so the smoke and tufts can follow that body's
 * separation lines.
 *
 * Coordinates are the pose's: metres at full scale, x forward along the
 * road, y up, z to the rider's right, the ground at y = 0.
 */
import { BIKE, HELMET, type CyclistDesign } from '../../data/cyclist'
import { ELLIPSOID_FIT as FIT } from '../../data/flowViz'
import { BOB_SKELETON, FRAME, HELMET_MOUNT, SKATER_SKELETON, SKELETON } from '../../data/pose'
import { SK_HEAD, type SkaterDesign } from '../../data/skater'
import { JUMP_PARTS, JUMP_SKIS, type JumperDesign } from '../../data/jumper'
import { SLED, type BobsledDesign } from '../../data/bobsled'
import { isBobsled, isJumper, isSkater, isTruck, type Design } from '../design'
import { RIG, type TruckDesign } from '../../data/truck'
import { truckLength } from '../geom/truck'
import { sledLength } from '../geom/bobsled'
import type { BobsledPose } from '../geom/bobsledPose'
import { bodySpan } from '../jumper'
import type { JumperPose } from '../geom/jumperPose'
import { detAtan2, detCos, detSin } from '../det'
import { DEG } from '../num'
import { cyclistShape } from '../geom/cyclist'
import type { Point, Pose } from '../geom/pose'

/**
 * Which of the aero body's surface lines a part of the ellipsoid follows.
 * - `oval`: a body lying along the flow (torso, helmet, an aero-bar
 *   forearm). Its top, bottom and side lines map onto the ellipsoid's top,
 *   bottom and sides.
 * - `cross`: a round limb or tube standing across the flow. The air wraps
 *   round it, so its side line (the round one) rules everywhere.
 * - `none`: a thin disc wheel edge-on to the air; it keeps the smoke out
 *   but has no separation line of its own.
 */
export type Wrap = 'oval' | 'cross' | 'none'

export interface Ellipsoid {
  id: string
  /** The aero body (from cyclistShape) whose drag result drives this part. */
  bodyId: string
  centre: Point
  /** Semi-axes along the ellipsoid's own forward, up and side directions. */
  axes: { a: number; b: number; c: number }
  /** Tilt of the forward axis in the x–y plane, radians (nose up is positive). */
  pitchRad: number
  wrap: Wrap
  /** Rider parts carry tufts; bike parts only steer the smoke. */
  part: 'rider' | 'bike'
}

const mid = (p: Point, q: Point): Point => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, z: (p.z + q.z) / 2 })

/**
 * An ellipsoid round a capsule from p to q (radius r): its forward axis runs
 * from p to q, tilted in the x–y plane only (limbs barely lean sideways).
 */
function capsule(
  id: string,
  bodyId: string,
  p: Point,
  q: Point,
  r: number,
  wrap: Wrap,
  part: Ellipsoid['part'] = 'rider',
  side: { up?: number; side?: number } = {},
): Ellipsoid {
  const dx = q.x - p.x
  const dy = q.y - p.y
  const dz = q.z - p.z
  const half = Math.sqrt(dx * dx + dy * dy + dz * dz) / 2
  const radius = r * FIT.capsuleRadius
  return {
    id,
    bodyId,
    centre: mid(p, q),
    axes: { a: (half + r) * FIT.capsuleLength, b: radius * (side.up ?? 1), c: radius * (side.side ?? 1) },
    pitchRad: detAtan2(dy, dx),
    wrap,
    part,
  }
}

function helmetEllipsoid(design: CyclistDesign, pose: Pose): Ellipsoid {
  const pitch = pose.headPitchDeg * DEG
  if (design.helmet.kind === 'aero') {
    // The renderer lathes the aero model's own helmet sections: its nose sits a
    // fraction (HELMET_MOUNT.noseFraction) of the length ahead of the mount.
    const body = cyclistShape(design).bodies.find((b) => b.id === 'helmet')
    const st = body ? body.stations : []
    const length = st.length > 0 ? st[st.length - 1]!.x : HELMET.aero.lengthBase
    let maxHalf = 1e-6
    let maxTop = 1e-6
    for (const s of st) {
      if (s.half > maxHalf) maxHalf = s.half
      if (s.top > maxTop) maxTop = s.top
    }
    const back = length / 2 - HELMET_MOUNT.noseFraction * length
    const dir = { x: detCos(pitch), y: detSin(pitch) }
    return {
      id: 'helmet',
      bodyId: 'helmet',
      centre: { x: pose.helmet.x - back * dir.x, y: pose.helmet.y - back * dir.y, z: 0 },
      axes: { a: length / 2, b: maxTop, c: maxHalf },
      pitchRad: pitch,
      wrap: 'oval',
      part: 'rider',
    }
  }
  const r = HELMET.road
  return {
    id: 'helmet',
    bodyId: 'helmet',
    centre: { ...pose.helmet },
    axes: { a: r.length / 2, b: (r.height * FIT.roadHelmetHeight) / 2, c: r.width / 2 },
    pitchRad: pitch,
    wrap: 'oval',
    part: 'rider',
  }
}

/**
 * Ellipsoids for a design in a pose: torso, head and helmet, both upper
 * arms, forearms, thighs and shins, the frame's four main tubes and any
 * disc wheels. Spoked and deep wheels are left out: the air goes through
 * their spokes.
 */
export function riderEllipsoids(design: CyclistDesign, pose: Pose): Ellipsoid[] {
  const out: Ellipsoid[] = []
  const hipC = mid(pose.hip[0], pose.hip[1])
  const shC = mid(pose.shoulder[0], pose.shoulder[1])
  const halfWidth = (FIT.torsoWidthBase + FIT.torsoWidthPerArm * design.posture.armWidth) / 2
  out.push(capsule('torso', 'torso', hipC, shC, FIT.torsoRadius, 'oval', 'rider', { side: halfWidth / FIT.torsoRadius }))
  const headR = SKELETON.headRadius * FIT.headBall
  out.push({
    id: 'head',
    bodyId: 'helmet',
    centre: { ...pose.head },
    axes: { a: headR, b: headR, c: headR },
    pitchRad: pose.headPitchDeg * DEG,
    wrap: 'oval',
    part: 'rider',
  })
  out.push(helmetEllipsoid(design, pose))

  const forearmWrap: Wrap = design.bars === 'aero' ? 'oval' : 'cross'
  for (let i = 0; i < 2; i++) {
    const n = i + 1
    out.push(capsule(`upper-arm-${n}`, `upper-arm-${n}`, pose.shoulder[i]!, pose.elbow[i]!, FIT.upperArmRadius, 'cross'))
    out.push(capsule(`forearm-${n}`, `forearm-${n}`, pose.elbow[i]!, pose.hand[i]!, FIT.forearmRadius, forearmWrap))
    out.push(capsule(`thigh-${n}`, `thigh-${n}`, pose.hip[i]!, pose.knee[i]!, FIT.thighRadius, 'cross'))
    out.push(capsule(`shin-${n}`, `shin-${n}`, pose.knee[i]!, pose.foot[i]!, FIT.shinRadius, 'cross'))
  }

  // Frame: the aero model has a head tube and a seat tube; the down tube and
  // top tube share their round (or Kamm) profile, so they borrow those lines.
  const bb = { x: SKELETON.bottomBracket.x, y: SKELETON.bottomBracket.y, z: 0 }
  const ht = { x: FRAME.headTop.x, y: FRAME.headTop.y, z: 0 }
  const hb = { x: FRAME.headBottom.x, y: FRAME.headBottom.y, z: 0 }
  const st = { x: FRAME.seatTop.x, y: FRAME.seatTop.y, z: 0 }
  const kamm = design.frame === 'kamm' ? { up: FIT.kammDeep, side: FIT.kammThin } : {}
  const tr = FRAME.tubeRadius
  out.push(capsule('seat-tube', 'seat-tube', bb, st, tr, 'cross', 'bike', kamm))
  out.push(capsule('top-tube', 'seat-tube', st, ht, tr, 'cross', 'bike', kamm))
  out.push(capsule('down-tube', 'head-tube', bb, hb, tr, 'cross', 'bike', kamm))
  out.push(capsule('head-tube', 'head-tube', hb, ht, tr, 'cross', 'bike', kamm))

  for (const id of ['front', 'rear'] as const) {
    if (design.wheels[id] !== 'disc') continue
    const r = FRAME.wheelRadius
    out.push({
      id: `${id}-disc`,
      bodyId: `${id}-tyre`,
      centre: { x: id === 'front' ? FRAME.frontAxleX : FRAME.rearAxleX, y: r, z: 0 },
      axes: { a: r, b: r, c: (BIKE.discThickness * BIKE.wheelDiameter) / 2 },
      pitchRad: 0,
      wrap: 'none',
      part: 'bike',
    })
  }
  return out
}

/**
 * Ellipsoids for a skater (PR 8b): trunk, head with its cap or hood, both
 * arms (whole, shoulder to hand), thighs and shins. Blades are too thin to
 * steer the smoke.
 */
export function skaterEllipsoids(design: SkaterDesign, pose: Pose): Ellipsoid[] {
  const out: Ellipsoid[] = []
  const hipC = mid(pose.hip[0], pose.hip[1])
  const shC = mid(pose.shoulder[0], pose.shoulder[1])
  out.push(capsule('torso', 'torso', hipC, shC, FIT.torsoRadius, 'oval', 'rider', { side: FIT.skaterTorsoHalfWidth / FIT.torsoRadius }))
  const headR = SKATER_SKELETON.headRadius * FIT.headBall
  out.push({ id: 'head', bodyId: 'head', centre: { ...pose.head }, axes: { a: headR, b: headR, c: headR }, pitchRad: pose.headPitchDeg * DEG, wrap: 'oval', part: 'rider' })
  if (design.hood === 'hood') {
    const h = SK_HEAD.hood
    out.push({
      id: 'hood',
      bodyId: 'head',
      centre: mid(pose.helmet, pose.helmetTail),
      axes: { a: h.length / 2, b: h.height / 2, c: h.width / 2 },
      pitchRad: pose.headPitchDeg * DEG,
      wrap: 'oval',
      part: 'rider',
    })
  }
  for (let i = 0; i < 2; i++) {
    const n = i + 1
    out.push(capsule(`arm-${n}`, `arm-${n}`, pose.shoulder[i]!, pose.hand[i]!, FIT.upperArmRadius, 'cross'))
    out.push(capsule(`thigh-${n}`, `thigh-${n}`, pose.hip[i]!, pose.knee[i]!, FIT.thighRadius, 'cross'))
    out.push(capsule(`shin-${n}`, `shin-${n}`, pose.knee[i]!, pose.foot[i]!, FIT.shinRadius, 'cross'))
  }
  return out
}

/**
 * The ski jumper in flight (PR 8d): the body as one flat plate from boots to
 * head, the helmet, and the skis as thin plates that only steer the smoke.
 */
export function jumperEllipsoids(design: JumperDesign, pose: Pose): Ellipsoid[] {
  const feet = mid(pose.foot[0], pose.foot[1])
  const head = pose.head
  const out: Ellipsoid[] = [
    capsule('body', 'body', feet, head, FIT.jumperBodyHalfThick, 'oval', 'rider', { side: bodySpan(design) / 2 / FIT.jumperBodyHalfThick }),
  ]
  const h = JUMP_PARTS.helmet
  out.push({ id: 'helmet', bodyId: 'helmet', centre: { ...pose.helmet }, axes: { a: h.length / 2, b: h.height / 2, c: h.width / 2 }, pitchRad: pose.headPitchDeg * DEG, wrap: 'oval', part: 'rider' })
  const skis = (pose as Partial<JumperPose>).skis
  if (skis) {
    skis.forEach((s, i) => out.push(capsule(`ski-${i + 1}`, `ski-${i + 1}`, s.tail, s.tip, JUMP_SKIS.width / 2, 'none', 'bike')))
  }
  return out
}

/**
 * The bobsled (PR 8m): the hull as one long oval, and each crew member's
 * helmet as a ball over the cowling. The crew's drag is a sum in the sim,
 * not a body of its own, so their helmets follow the hull's lines.
 */
export function bobsledEllipsoids(design: BobsledDesign, pose: Pose): Ellipsoid[] {
  const half = (design.sled.cowl - SLED.floor) / 2
  const out: Ellipsoid[] = [
    {
      id: 'hull',
      bodyId: 'hull',
      // The hull's middle, with the cockpit's middle at x = 0.
      centre: { x: (design.sled.nose - design.sled.tail) / 2, y: SLED.floor + half, z: 0 },
      axes: { a: sledLength(design) / 2, b: half, c: SLED.width / 2 },
      pitchRad: 0,
      wrap: 'oval',
      part: 'bike',
    },
  ]
  const seats = (pose as Partial<BobsledPose>).seats ?? [0]
  const r = BOB_SKELETON.helmetRadius
  seats.forEach((dx, i) => {
    out.push({ id: `helmet-${i + 1}`, bodyId: 'hull', centre: { ...pose.head, x: pose.head.x + dx }, axes: { a: r, b: r, c: r }, pitchRad: 0, wrap: 'cross', part: 'rider' })
  })
  return out
}

/**
 * The truck (PR 9b): the whole rig as one long, boxy oval round the drag
 * model's one body, centred where the figure is (the rig's middle at x = 0).
 * Its sides carry tufts.
 */
export function truckEllipsoids(design: TruckDesign): Ellipsoid[] {
  const half = (design.trailerTop - RIG.bodyBottom) / 2
  return [
    {
      id: 'rig',
      bodyId: 'rig',
      centre: { x: 0, y: RIG.bodyBottom + half, z: 0 },
      axes: { a: truckLength(design) / 2, b: half, c: RIG.width / 2 },
      pitchRad: 0,
      wrap: 'oval',
      part: 'rider',
    },
  ]
}

/** The ellipsoids for any design in its pose. */
export function designEllipsoids(design: Design, pose: Pose): Ellipsoid[] {
  if (isJumper(design)) return jumperEllipsoids(design, pose)
  if (isBobsled(design)) return bobsledEllipsoids(design, pose)
  if (isTruck(design)) return truckEllipsoids(design)
  return isSkater(design) ? skaterEllipsoids(design, pose) : riderEllipsoids(design, pose)
}

/**
 * The same ellipsoids at another scale, about the ground under the bottom
 * bracket (a 1:4 model is scale 0.25).
 */
export function scaleEllipsoids(list: readonly Ellipsoid[], scale: number): Ellipsoid[] {
  return list.map((e) => ({
    ...e,
    centre: { x: e.centre.x * scale, y: e.centre.y * scale, z: e.centre.z * scale },
    axes: { a: e.axes.a * scale, b: e.axes.b * scale, c: e.axes.c * scale },
  }))
}
