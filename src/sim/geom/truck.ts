/**
 * The truck as a body the drag model reads (PR 9a): one long box from the
 * cab's front to the boat-tail's end, as the air flowing round the outside
 * sees it.
 *
 * - The front: the cab face, always well rounded here (RIG.bodyNose): the
 *   cab's real corners are a drag term in sim/truck.ts, so a sharper or
 *   rounder nose changes the drag smoothly.
 * - The roof: the cab roof, then a smooth rise to the trailer's roof (the
 *   fairing's job). Whether the fairing really meets the trailer is a drag
 *   term of its own in sim/truck.ts, as are the gap, the underside, the
 *   skirts and the boat-tail's panels.
 * - The back: the trailer's doors, or a boat-tail folding the top and
 *   sides in. The drag model finds whether the air stays on its panels,
 *   and how small the wake left behind is.
 *
 * The body's bottom is the bumper and chassis line all the way back; what
 * hangs below it (wheels, axles, tanks) is the underside term.
 */
import { RIG, type TruckDesign } from '../../data/truck'
import { DEG } from '../num'
import { detCos, detSin, PI } from '../det'
import type { ShapeSpec, Station } from './body'

/** The rig's whole length, cab front to boat-tail end, m. */
export function truckLength(design: TruckDesign): number {
  return RIG.cab + design.gap.length + RIG.trailer + design.trailer.tail
}

/** Where the trailer's back doors are, m from the cab's front. */
export function doorsAt(design: TruckDesign): number {
  return RIG.cab + design.gap.length + RIG.trailer
}

/** The body's axis height above the road: halfway up the trailer's side. */
export function axisHeight(design: TruckDesign): number {
  return (design.trailerTop + RIG.bodyBottom) / 2
}

/** How far a rounded corner of radius e is set back at x from the front face (0 past the corner). */
function cornerDrop(x: number, e: number): number {
  if (x >= e || e <= 0) return 0
  const d = e - x
  return Math.sqrt(Math.max(0, e * e - d * d)) - e
}

function tan(deg: number): number {
  return detSin(deg * DEG) / detCos(deg * DEG)
}

/** The x positions: close together round the nose and on the boat-tail, sparse along the trailer. */
function stationXs(design: TruckDesign): number[] {
  const e = RIG.bodyNose
  const front = RIG.cab + design.gap.length
  const doors = doorsAt(design)
  const end = truckLength(design)
  const xs: number[] = []
  for (let i = 0; i <= 12; i++) xs.push(e * (1 - detCos((i / 12) * (PI / 2))))
  for (let x = RIG.fairingFrom; x < front; x += 0.25) xs.push(x)
  for (let x = front; x < doors; x += 1) xs.push(x)
  xs.push(doors)
  const tailSteps = Math.max(0, Math.ceil(design.trailer.tail / 0.05))
  for (let i = 1; i <= tailSteps; i++) xs.push(doors + (design.trailer.tail * i) / tailSteps)
  const sorted = [...new Set(xs.map((x) => Math.round(x * 1e6) / 1e6))].filter((x) => x >= 0 && x <= end + 1e-9)
  return sorted.sort((a, b) => a - b)
}

/** One cross-section of the rig's outside at x. */
export function truckStation(design: TruckDesign, x: number): Station {
  const axis = axisHeight(design)
  const e = RIG.bodyNose
  const front = RIG.cab + design.gap.length
  const doors = doorsAt(design)
  const trailerR = design.trailerTop - axis
  const cabR = RIG.cabTop - axis
  const round = cornerDrop(x, e)
  let top: number
  if (x <= RIG.fairingFrom) top = cabR
  else if (x < front) top = cabR + ((trailerR - cabR) * (x - RIG.fairingFrom)) / (front - RIG.fairingFrom)
  else top = trailerR
  let half = RIG.width / 2
  // The boat-tail folds the top and the sides in; the floor runs straight back.
  const inTail = Math.max(0, x - doors)
  const fold = inTail * tan(design.trailer.tailAngle)
  top -= fold
  half -= fold
  return { x, top: top + round, bottom: axis - RIG.bodyBottom + round, half: half + round }
}

export function truckShape(design: TruckDesign): ShapeSpec {
  const stations = stationXs(design).map((x) => truckStation(design, x))
  return {
    bodies: [{ id: 'rig', stations, squareness: 1, roughness: RIG.roughness }],
    elements: [],
    junctions: [],
    cavities: [],
  }
}
