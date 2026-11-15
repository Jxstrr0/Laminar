/**
 * The rule box in 3D (plan section 5): the brief's legal envelope as
 * see-through volumes on the Shape screen. The hands must stay inside one
 * box, the helmet inside another. The rules themselves are checked in
 * src/sim/cyclist.ts; this only says where to draw them.
 */
import type { CyclistDesign } from '../../data/cyclist'
import { RULE_BOX } from '../../data/handles'
import { HELMET_MOUNT, SKELETON } from '../../data/pose'
import type { CyclingRules } from '../../data/rules'
import { detCos, detSin } from '../det'
import { DEG } from '../num'
import { PARAM_RANGE } from './handles'
import { helmetLength } from './cyclist'
import type { Point, Pose } from './pose'

export interface RuleVolume {
  /** Which part it limits; matches the Shape view's highlight names. */
  id: 'hands' | 'helmet'
  centre: Point
  /** Full size along x (forward), y (up) and z (right) before tilting, m. */
  size: Point
  /** Tilt about z, degrees, nose up. */
  pitchDeg: number
}

export function ruleVolumes(design: CyclistDesign, pose: Pose, rules: CyclingRules): RuleVolume[] {
  const bb = SKELETON.bottomBracket
  const seatY = bb.y + SKELETON.saddle.y
  const m = RULE_BOX.margin
  // Hands: back and down to past anything the sliders reach, forward and up to the limits.
  const x0 = bb.x + PARAM_RANGE.handReach.min - m
  const x1 = bb.x + rules.maxHandReach
  const y0 = seatY + PARAM_RANGE.handHeight.min - m
  const y1 = seatY + rules.maxHandHeight
  const z = PARAM_RANGE.armWidth.max + 2 * m
  const hands: RuleVolume = {
    id: 'hands',
    centre: { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: 0 },
    size: { x: x1 - x0, y: y1 - y0, z },
    pitchDeg: 0,
  }
  // Helmet: as long as the rules allow, starting at the helmet's nose.
  const pitch = pose.headPitchDeg * DEG
  const nose = HELMET_MOUNT.noseFraction * helmetLength(design)
  const along = nose - rules.maxHelmetLength / 2
  const helmet: RuleVolume = {
    id: 'helmet',
    centre: { x: pose.helmet.x + along * detCos(pitch), y: pose.helmet.y + along * detSin(pitch), z: 0 },
    size: { x: rules.maxHelmetLength, y: RULE_BOX.helmetHeight, z: RULE_BOX.helmetWidth },
    pitchDeg: pose.headPitchDeg,
  }
  return [hands, helmet]
}
