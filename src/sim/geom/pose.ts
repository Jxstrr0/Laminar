/**
 * The rider's joints for a design: where the shoulders, elbows, hands,
 * hips, knees and feet sit, worked out from the same posture numbers the
 * aero model reads. Pure maths, so the renderer, the rule box and the tests
 * all agree.
 */
import type { CyclistDesign } from '../../data/cyclist'
import { SKELETON } from '../../data/pose'
import { detAtan2, detCos, detSin, PI } from '../det'
import { DEG } from '../num'

export interface Point {
  x: number
  y: number
  z: number
}

export interface Pose {
  hip: [Point, Point]
  shoulder: [Point, Point]
  neck: Point
  head: Point
  /** Helmet tilt, degrees, nose up (its tail lies down along the back). */
  headPitchDeg: number
  elbow: [Point, Point]
  hand: [Point, Point]
  knee: [Point, Point]
  foot: [Point, Point]
}

const p = (x: number, y: number, z: number): Point => ({ x, y, z })

/**
 * Two-bone reach: from `a` to `c` with bones `l1` and `l2`, the middle joint
 * bends towards `bend` (+1 bends forward/up in the x–y plane, −1 back/down).
 * Out of reach, the limb points straight at the target.
 */
export function twoBone(a: Point, c: Point, l1: number, l2: number, bend: 1 | -1): Point {
  const dx = c.x - a.x
  const dy = c.y - a.y
  const d = Math.sqrt(dx * dx + dy * dy)
  const reach = Math.min(d, l1 + l2 - 1e-6)
  const base = detAtan2(dy, dx)
  const cosA = (l1 * l1 + reach * reach - l2 * l2) / (2 * l1 * reach)
  const k = Math.max(-1, Math.min(1, cosA))
  const angle = detAtan2(Math.sqrt(1 - k * k), k)
  const theta = base + bend * angle
  const t = d > 0 ? (c.z - a.z) * (l1 / (l1 + l2)) : 0
  return p(a.x + l1 * detCos(theta), a.y + l1 * detSin(theta), a.z + t)
}

export function riderPose(design: CyclistDesign): Pose {
  const s = SKELETON
  const post = design.posture
  const bb = s.bottomBracket
  const seat = { x: bb.x + s.saddle.x, y: bb.y + s.saddle.y }
  const back = post.torsoDeg * DEG
  const hipC = { x: seat.x, y: seat.y + s.hipAbove }
  const shC = { x: hipC.x + s.torso * detCos(back), y: hipC.y + s.torso * detSin(back) }
  const hw = s.hipWidth / 2
  const sw = s.shoulderWidth / 2
  const hip: [Point, Point] = [p(hipC.x, hipC.y, -hw), p(hipC.x, hipC.y, hw)]
  const shoulder: [Point, Point] = [p(shC.x, shC.y, -sw), p(shC.x, shC.y, sw)]

  const neckAngle = back + (s.neckUpDeg - s.neckDropDeg * post.headDrop) * DEG
  const neck = p(shC.x + s.neck * detCos(neckAngle), shC.y + s.neck * detSin(neckAngle), 0)
  const head = p(neck.x + s.headRadius * detCos(neckAngle - PI / 4), neck.y + s.headRadius * detSin(neckAngle - PI / 4), 0)
  // The helmet's tail follows the back down; a tucked head lays it flatter
  // on the shoulders, a raised head lifts it into the wind (as the sim says).
  const headPitchDeg = s.helmetPitch.base + s.helmetPitch.perTorsoDeg * post.torsoDeg + s.helmetPitch.perHeadDrop * post.headDrop

  const handY = seat.y + post.handHeight
  const aw = post.armWidth / 2
  const hand: [Point, Point] = [p(bb.x + post.handReach, handY, -aw), p(bb.x + post.handReach, handY, aw)]
  const elbow = hand.map((h, i) => {
    const sh = shoulder[i]!
    if (design.bars === 'aero') return p(h.x - s.forearm, h.y, h.z)
    return twoBone(sh, h, s.upperArm, s.forearm, -1)
  }) as [Point, Point]

  const foot = s.crankDeg.map((deg, i) =>
    p(bb.x + s.crank * detCos(-deg * DEG), bb.y + s.crank * detSin(-deg * DEG), i === 0 ? -hw : hw),
  ) as [Point, Point]
  const knee = foot.map((f, i) => twoBone(hip[i]!, f, s.thigh, s.shin, 1)) as [Point, Point]

  return { hip, shoulder, neck, head, headPitchDeg, elbow, hand, knee, foot }
}
