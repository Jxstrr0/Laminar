/**
 * The ski jumper's joints in flight (PR 8d), from the same numbers the sim
 * flies: the skis at their angle of attack, the body leaning off them by
 * the design's lean, the skis spread to its V. Fills the same Pose the
 * rider uses, plus where the skis lie.
 */
import { FLIGHT_ATTITUDE, JUMP_BODY, JUMP_SKIS, type JumperDesign } from '../../data/jumper'
import { JUMPER_SKELETON as S } from '../../data/pose'
import { detCos, detSin } from '../det'
import { DEG } from '../num'
import type { Point, Pose } from './pose'

const p = (x: number, y: number, z: number): Point => ({ x, y, z })

export interface JumperPose extends Pose {
  /** Each ski's tip and tail, near (z < 0) then far. */
  skis: [{ tip: Point; tail: Point }, { tip: Point; tail: Point }]
}

/**
 * Where every joint sits at an angle of attack (degrees; the settled
 * flight angle if left out). The hips are the centre of mass, as in the sim.
 */
export function jumperPose(design: JumperDesign, alphaDeg: number = FLIGHT_ATTITUDE.hold): JumperPose {
  const alpha = alphaDeg * DEG
  const body = (alphaDeg - design.posture.leanDeg) * DEG
  const bx = detCos(body)
  const by = detSin(body)
  const hipC = p(0, S.hipY, 0)
  const along = (d: number, lift = 0, z = 0): Point => p(hipC.x + d * bx - lift * by, hipC.y + d * by + lift * bx, z)

  const hw = S.hipWidth / 2
  const sw = S.shoulderWidth / 2
  const hip: [Point, Point] = [along(0, 0, -hw), along(0, 0, hw)]
  const shoulder: [Point, Point] = [along(S.shoulderAhead, 0, -sw), along(S.shoulderAhead, 0, sw)]
  const neck = along(S.neckAhead, S.headLift / 2)
  const head = along(S.headAhead, S.headLift)
  const headPitchDeg = body / DEG + S.helmetPitchDeg
  const helmet = along(S.headAhead + S.helmetAt.ahead, S.headLift + S.helmetAt.lift)
  const helmetTail = along(S.headAhead - S.helmetTail.behind, S.headLift + S.helmetTail.lift)
  const hand: [Point, Point] = [along(-S.handsBehind, -S.handsBelow, -S.handsOut), along(-S.handsBehind, -S.handsBelow, S.handsOut)]
  const elbow = shoulder.map((s, i) => {
    const h = hand[i]!
    return p((s.x + h.x) / 2, (s.y + h.y) / 2 - S.elbowDrop, ((s.z + h.z) / 2) * S.elbowOut)
  }) as [Point, Point]

  // The skis: the V opens from the tails, and each boot sits on its ski.
  const half = (design.posture.vAngleDeg / 2) * DEG
  const sx = detCos(alpha) * detCos(half)
  const sy = detSin(alpha) * detCos(half)
  const sz = detSin(half)
  const tailBack = JUMP_SKIS.length - JUMP_SKIS.tipAhead
  const centreBoot = along(-JUMP_BODY.hipToBoot)
  const skiFor = (side: -1 | 1) => {
    // Tails meet near the middle; the ski runs forward and out from there.
    const tail = p(centreBoot.x - tailBack * sx, centreBoot.y - tailBack * sy, side * S.tailGap)
    const tip = p(tail.x + JUMP_SKIS.length * sx, tail.y + JUMP_SKIS.length * sy, tail.z + side * JUMP_SKIS.length * sz)
    const boot = p(tail.x + tailBack * sx, tail.y + tailBack * sy + S.skiThick, tail.z + side * tailBack * sz)
    return { tip, tail, boot }
  }
  const near = skiFor(-1)
  const far = skiFor(1)
  const foot: [Point, Point] = [near.boot, far.boot]
  const knee = hip.map((h, i) => {
    const f = foot[i]!
    return p((h.x + f.x) / 2 + S.kneeDrop * by, (h.y + f.y) / 2 - S.kneeDrop * bx, (h.z + f.z) / 2)
  }) as [Point, Point]

  return {
    hip,
    shoulder,
    neck,
    head,
    headPitchDeg,
    helmet,
    helmetTail,
    elbow,
    hand,
    knee,
    foot,
    skis: [
      { tip: near.tip, tail: near.tail },
      { tip: far.tip, tail: far.tail },
    ],
  }
}
