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
import { FRAME, HELMET_MOUNT, SKELETON } from '../../data/pose'
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
