/**
 * The skater's joints for a design (PR 8b), from the same posture numbers
 * the aero model reads: the gliding leg's knee bend, the trunk's lean, the
 * head drop and the arms. Fills the same Pose the rider uses, so the flow
 * visuals and the renderer can share their tools.
 */
import { SK_HEAD, type SkaterDesign } from '../../data/skater'
import { SKATER_SKELETON as S } from '../../data/pose'
import { detCos, detSin, PI } from '../det'
import { DEG } from '../num'
import { twoBone, type Point, type Pose } from './pose'

const p = (x: number, y: number, z: number): Point => ({ x, y, z })

export function skaterPose(design: SkaterDesign): Pose {
  const post = design.posture
  // The gliding leg: the shin leans forward and the thigh back by the same
  // angle, half the knee's bend each, so the hip sits over the ankle.
  const lean = ((180 - post.kneeDeg) / 2) * DEG
  const a = S.ankle
  const kneeG = p(a.x + S.shin * detSin(lean), a.y + S.shin * detCos(lean), a.z)
  const hipG = p(kneeG.x - S.thigh * detSin(lean), kneeG.y + S.thigh * detCos(lean), a.z)
  const hw = S.hipWidth / 2
  const hipC = { x: hipG.x, y: hipG.y, z: 0 }
  const hip: [Point, Point] = [p(hipC.x, hipC.y, -hw), p(hipC.x, hipC.y, hw)]

  // The pushing leg reaches back and out; its knee barely bends.
  const footP = p(hipC.x - S.pushFoot.back, a.y, S.pushFoot.out)
  const kneeP = twoBone(hip[1], footP, S.thigh, S.shin, 1)
  const knee: [Point, Point] = [kneeG, kneeP]
  const foot: [Point, Point] = [p(a.x, a.y, a.z), footP]

  const back = post.trunkDeg * DEG
  const shC = { x: hipC.x + S.torso * detCos(back), y: hipC.y + S.torso * detSin(back) }
  const sw = S.shoulderWidth / 2
  const shoulder: [Point, Point] = [p(shC.x, shC.y, -sw), p(shC.x, shC.y, sw)]
  const neckAngle = back + (S.neckUpDeg - S.neckDropDeg * post.headDrop) * DEG
  const neck = p(shC.x + S.neck * detCos(neckAngle), shC.y + S.neck * detSin(neckAngle), 0)
  const head = p(neck.x + S.headRadius * detCos(neckAngle - PI / 4), neck.y + S.headRadius * detSin(neckAngle - PI / 4), 0)
  const headPitchDeg = (neckAngle - PI / 4) / DEG + S.hoodPitchDeg

  // Hood or cap: mounted on the head, its tail lying back along the neck.
  const helmet = p(head.x + S.hoodOffset.x, head.y + S.hoodOffset.y, 0)
  const length = design.hood === 'hood' ? SK_HEAD.hood.length : SK_HEAD.cap.length
  const pitch = headPitchDeg * DEG
  const behind = (1 - S.hoodNose) * length
  const helmetTail = p(helmet.x - behind * detCos(pitch), helmet.y - behind * detSin(pitch), 0)

  // Arms: folded on the small of the back, or the near arm swinging forward and the far one back.
  const onBack = { x: hipC.x + S.handsOnBack * detCos(back), y: hipC.y + S.handsOnBack * detSin(back) + S.handsLift }
  let hand: [Point, Point]
  let elbow: [Point, Point]
  if (design.arms === 'back') {
    hand = [p(onBack.x, onBack.y, -S.handsGap), p(onBack.x, onBack.y, S.handsGap)]
    elbow = shoulder.map((s, i) => {
      const h = hand[i]!
      return p((s.x + h.x) / 2, Math.max(s.y, h.y) + S.elbowLift, s.z * S.elbowOut)
    }) as [Point, Point]
  } else {
    const reach = S.upperArm + S.forearm
    const sw1 = S.swingDeg * DEG
    const fore = p(shoulder[0].x + reach * detSin(sw1), shoulder[0].y - reach * detCos(sw1), shoulder[0].z - S.swingOut)
    const aft = p(shoulder[1].x - reach * detSin(sw1 * S.swingBack), shoulder[1].y - reach * detCos(sw1 * S.swingBack) + S.swingBackLift, shoulder[1].z + S.swingOut)
    hand = [fore, aft]
    elbow = shoulder.map((s, i) => {
      const h = hand[i]!
      return p((s.x + h.x) / 2, (s.y + h.y) / 2, (s.z + h.z) / 2)
    }) as [Point, Point]
  }

  return { hip, shoulder, neck, head, headPitchDeg, helmet, helmetTail, elbow, hand, knee, foot }
}
