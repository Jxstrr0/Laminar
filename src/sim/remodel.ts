/**
 * Keeping the model in step with the design (Kelbo, PR 5d): the model on
 * the mount is a solid thing built of one design. Bolt-on parts (helmet,
 * suit, bars, wheels, frame) can be swapped on it for a small fee and no
 * days; a new position needs a new model from the shop.
 */
import { MODEL_SHOP } from '../data/model'
import type { CyclistDesign } from '../data/cyclist'

export type PartName = 'helmet' | 'suit' | 'bars' | 'frontWheel' | 'rearWheel' | 'frame'

/** The bolt-on parts that differ between the model and the bench design. */
export function partChanges(model: CyclistDesign, bench: CyclistDesign): PartName[] {
  const out: PartName[] = []
  const h = model.helmet
  const hb = bench.helmet
  if (h.kind !== hb.kind || h.tail !== hb.tail || h.vents !== hb.vents) out.push('helmet')
  if (model.suit.fabric !== bench.suit.fabric || model.suit.armTrips !== bench.suit.armTrips) out.push('suit')
  if (model.bars !== bench.bars) out.push('bars')
  if (model.wheels.front !== bench.wheels.front) out.push('frontWheel')
  if (model.wheels.rear !== bench.wheels.rear) out.push('rearWheel')
  if (model.frame !== bench.frame) out.push('frame')
  return out
}

/** Has the rider's position moved since the model was built? */
export function postureChanged(model: CyclistDesign, bench: CyclistDesign): boolean {
  return (Object.keys(model.posture) as (keyof CyclistDesign['posture'])[]).some((k) => model.posture[k] !== bench.posture[k])
}

/** The model with the bench design's parts bolted on, its position unchanged. */
export function swapParts(model: CyclistDesign, bench: CyclistDesign): CyclistDesign {
  return structuredClone({ ...bench, posture: model.posture })
}

/** What swapping these parts costs, ₽ (no days). */
export function swapCost(parts: readonly PartName[]): number {
  return parts.length * MODEL_SHOP.partSwap
}
