/**
 * Keeping the model in step with the design (Kelbo, PR 5d): the model on
 * the mount is a solid thing built of one design. Bolt-on parts (helmet,
 * suit, bars, wheels, frame; a skater's hood and suit) can be swapped on it for a small fee and no
 * days; a new position needs a new model from the shop. A ski jumper's suit
 * is cut into the model's body, so any change to a jumper is a new model;
 * a bobsled model is one moulded shell with its crew, so the same goes for it.
 */
import { MODEL_SHOP } from '../data/model'
import type { Design } from './design'
import { isBobsled, isJumper, isSkater } from './design'

export type PartName = 'helmet' | 'suit' | 'bars' | 'frontWheel' | 'rearWheel' | 'frame' | 'hood'

/** The bolt-on parts that differ between the model and the bench design. */
export function partChanges(model: Design, bench: Design): PartName[] {
  const out: PartName[] = []
  if (isJumper(model) || isJumper(bench) || isBobsled(model) || isBobsled(bench)) return out
  if (isSkater(model) || isSkater(bench)) {
    if (!isSkater(model) || !isSkater(bench)) return out
    if (model.hood !== bench.hood) out.push('hood')
    if (model.suit.fabric !== bench.suit.fabric || model.suit.legTrips !== bench.suit.legTrips) out.push('suit')
    return out
  }
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

/**
 * Has the athlete's position moved since the model was built? A skater's
 * arms are part of the body; a design for another sport is a new model.
 */
export function postureChanged(model: Design, bench: Design): boolean {
  if (isSkater(model) !== isSkater(bench) || isJumper(model) !== isJumper(bench) || isBobsled(model) !== isBobsled(bench)) return true
  if (isBobsled(model) || isBobsled(bench)) {
    if (!isBobsled(model) || !isBobsled(bench)) return true
    const a = model.sled
    const b = bench.sled
    return model.crew !== bench.crew || model.tuck !== bench.tuck || a.nose !== b.nose || a.tail !== b.tail || a.cowl !== b.cowl
  }
  if (isJumper(model) && isJumper(bench) && model.suit.bagginess !== bench.suit.bagginess) return true
  if (isSkater(model) && isSkater(bench) && model.arms !== bench.arms) return true
  const a = model.posture as Record<string, number>
  const b = bench.posture as Record<string, number>
  return Object.keys(a).some((k) => a[k] !== b[k])
}

/** The model with the bench design's parts bolted on, its position unchanged (same sport only). */
export function swapParts(model: Design, bench: Design): Design {
  if (isJumper(model) || isJumper(bench) || isBobsled(model) || isBobsled(bench)) return structuredClone(model)
  if (isSkater(bench)) return isSkater(model) ? structuredClone({ ...bench, posture: model.posture, arms: model.arms }) : structuredClone(model)
  return isSkater(model) ? structuredClone(model) : structuredClone({ ...bench, posture: model.posture })
}

/** What swapping these parts costs, ₽ (no days). */
export function swapCost(parts: readonly PartName[]): number {
  return parts.length * MODEL_SHOP.partSwap
}
