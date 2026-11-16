/**
 * The bobsled crew's joints (PR 8m), for the Shape screen and the tunnel.
 * The driver's pose fills the usual Pose; the crew behind sit in the same
 * fold, each `seats` metres along x from the driver. The helmet's top is
 * the sim's own (`helmetTop`), so a deeper tuck on screen hides the same
 * share of the crew behind the cowling as it does in the drag.
 */
import { SLED, type BobsledDesign } from '../../data/bobsled'
import { BOB_SKELETON as S } from '../../data/pose'
import { helmetTop } from '../bobsled'
import { twoBone, type Point, type Pose } from './pose'

const p = (x: number, y: number, z: number): Point => ({ x, y, z })

export interface BobsledPose extends Pose {
  /** Each crew member's offset along x from the driver, m (0 first, then negative: behind). */
  seats: number[]
}

export function bobsledPose(design: BobsledDesign): BobsledPose {
  const top = helmetTop(design)
  const hipX = SLED.body[design.crew] / 2 - S.driverBack
  // The trunk leans forward until the head sits at the helmet's height.
  const rise = Math.max(0, Math.min(S.torso, top - S.shoulderBelowTop - S.hipY))
  const lean = Math.sqrt(S.torso * S.torso - rise * rise)
  const shC = p(hipX + lean, S.hipY + rise, 0)
  const head = p(shC.x + S.headAhead, top - S.headBelowTop, 0)
  const neck = p((shC.x + head.x) / 2, (shC.y + head.y) / 2, 0)

  const hw = S.hipWidth / 2
  const sw = S.shoulderWidth / 2
  const hip: [Point, Point] = [p(hipX, S.hipY, -hw), p(hipX, S.hipY, hw)]
  const shoulder: [Point, Point] = [p(shC.x, shC.y, -sw), p(shC.x, shC.y, sw)]
  const foot: [Point, Point] = [p(hipX + S.feetAhead, S.footY, -hw), p(hipX + S.feetAhead, S.footY, hw)]
  const knee = hip.map((h, i) => twoBone(h, foot[i]!, S.thigh, S.shin, 1)) as [Point, Point]
  const hand: [Point, Point] = [p(shC.x + S.handsAhead, S.hipY + S.handsUp, -S.handsOut), p(shC.x + S.handsAhead, S.hipY + S.handsUp, S.handsOut)]
  const elbow = shoulder.map((s, i) => twoBone(s, hand[i]!, S.upperArm, S.forearm, -1)) as [Point, Point]

  const seats: number[] = []
  for (let i = 0; i < design.crew; i++) seats.push(-i * S.spacing)
  return {
    hip,
    shoulder,
    neck,
    head,
    headPitchDeg: S.helmetPitchDeg,
    helmet: p(head.x, head.y + 0.02, 0),
    helmetTail: p(head.x - 0.1, head.y, 0),
    elbow,
    hand,
    knee,
    foot,
    seats,
  }
}
