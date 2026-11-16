/**
 * The sled's hull as a body the drag model reads (PR 8l): a rounded nose
 * that grows to the full cowling section, the cockpit, then a tail that
 * tapers and ends cut off (the open back). The crew sit in it; what of them
 * shows over the cowling is worked out in sim/bobsled.ts.
 */
import { SLED, type BobsledDesign } from '../../data/bobsled'
import { detPow } from '../det'
import type { ShapeSpec, Station } from './body'

/** How many cross-sections along the hull. */
const STATIONS = 61

/** The sled's whole length, nose to tail, m. */
export function sledLength(design: BobsledDesign): number {
  return design.sled.nose + SLED.body[design.crew] + design.sled.tail
}

/** The share of the full section at x along the hull (0 at the nose's tip). */
export function hullSection(design: BobsledDesign, x: number): number {
  const { nose, tail } = design.sled
  const body = SLED.body[design.crew]
  if (x < nose) return x <= 0 ? 0 : detPow(x / nose, SLED.noseExponent)
  if (x <= nose + body) return 1
  const u = Math.min(1, (x - nose - body) / tail)
  return 1 - (1 - SLED.tailCut) * u
}

export function sledShape(design: BobsledDesign): ShapeSpec {
  const length = sledLength(design)
  const half = (design.sled.cowl - SLED.floor) / 2
  const stations: Station[] = []
  for (let i = 0; i < STATIONS; i++) {
    const x = (length * i) / (STATIONS - 1)
    const f = hullSection(design, x)
    stations.push({ x, top: half * f, bottom: half * f, half: (SLED.width / 2) * f })
  }
  return {
    bodies: [{ id: 'hull', stations, squareness: SLED.squareness, roughness: SLED.roughness }],
    elements: [],
    junctions: [],
    cavities: [],
  }
}
