/**
 * Keeping the model in step with the design (Kelbo, PR 5d): the model on
 * the mount is a solid thing built of one design. Bolt-on parts (helmet,
 * suit, bars, wheels, frame; a skater's hood and suit) can be swapped on it for a small fee and no
 * days; a new position needs a new model from the shop. A ski jumper's suit
 * is cut into the model's body, so any change to a jumper is a new model;
 * a bobsled model is one moulded shell with its crew, so the same goes for it.
 * A truck model (PR 9c) is a cab and trailer with parts bolted on: the
 * fairing, extenders, gap filler, skirts and boat-tail swap like a rider's
 * helmet. The cab's corners, the gap's length and the trailer's height are
 * the model's body, so changing them needs a new one.
 * A car model (PR 9j) is one piece for now, like a bobsled: any change is a
 * new model, until its tunnel work decides which parts bolt on.
 */
import { MODEL_SHOP } from '../data/model'
import type { Design } from './design'
import { isBobsled, isCar, isJumper, isSkater, isTruck } from './design'
import type { TruckDesign } from '../data/truck'

export type PartName = 'helmet' | 'suit' | 'bars' | 'frontWheel' | 'rearWheel' | 'frame' | 'hood' | TruckPart

/** A truck's bolt-on parts. */
export type TruckPart = 'fairing' | 'extenders' | 'gapFill' | 'skirts' | 'boatTail'

function truckPartChanges(model: TruckDesign, bench: TruckDesign): TruckPart[] {
  const out: TruckPart[] = []
  if (model.cab.fairing !== bench.cab.fairing) out.push('fairing')
  if (model.cab.extenders !== bench.cab.extenders) out.push('extenders')
  if (model.gap.fill !== bench.gap.fill) out.push('gapFill')
  if (model.trailer.skirts !== bench.trailer.skirts) out.push('skirts')
  if (model.trailer.tail !== bench.trailer.tail || model.trailer.tailAngle !== bench.trailer.tailAngle) out.push('boatTail')
  return out
}

/** The bolt-on parts that differ between the model and the bench design. */
export function partChanges(model: Design, bench: Design): PartName[] {
  const out: PartName[] = []
  if (isTruck(model) && isTruck(bench)) return truckPartChanges(model, bench)
  if (isJumper(model) || isJumper(bench) || isBobsled(model) || isBobsled(bench) || isTruck(model) || isTruck(bench) || isCar(model) || isCar(bench)) return out
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
  if (isSkater(model) !== isSkater(bench) || isJumper(model) !== isJumper(bench) || isBobsled(model) !== isBobsled(bench) || isTruck(model) !== isTruck(bench)) return true
  if (isTruck(model) && isTruck(bench)) return model.cab.nose !== bench.cab.nose || model.gap.length !== bench.gap.length || model.trailerTop !== bench.trailerTop
  if (isTruck(model) || isTruck(bench)) return true
  if (isCar(model) || isCar(bench)) return !isCar(model) || !isCar(bench) || JSON.stringify(model) !== JSON.stringify(bench)
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
  // A truck takes the bench's bolt-ons and keeps its own cab corners, gap and trailer.
  if (isTruck(model) && isTruck(bench)) {
    return structuredClone({ ...bench, trailerTop: model.trailerTop, cab: { ...bench.cab, nose: model.cab.nose }, gap: { ...bench.gap, length: model.gap.length } })
  }
  if (isJumper(model) || isJumper(bench) || isBobsled(model) || isBobsled(bench) || isTruck(model) || isTruck(bench) || isCar(model) || isCar(bench)) return structuredClone(model)
  if (isSkater(bench)) return isSkater(model) ? structuredClone({ ...bench, posture: model.posture, arms: model.arms }) : structuredClone(model)
  return isSkater(model) ? structuredClone(model) : structuredClone({ ...bench, posture: model.posture })
}

/** What swapping these parts costs, ₽ (no days). */
export function swapCost(parts: readonly PartName[]): number {
  return parts.length * MODEL_SHOP.partSwap
}
