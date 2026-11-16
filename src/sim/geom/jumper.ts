/**
 * The ski jumper's small bluff parts (helmet and boots) as bodies the drag
 * model reads, the same way geom/skater.ts builds a skater. The body and
 * skis fly as plates; sim/jumper.ts works out their lift and drag.
 */
import { JUMP_PARTS, type JumperDesign } from '../../data/jumper'
import type { ShapeSpec } from './body'
import { ellipsoid, upright } from './shapes'

export function jumperParts(design: JumperDesign): ShapeSpec {
  void design
  const h = JUMP_PARTS.helmet
  const b = JUMP_PARTS.boot
  return {
    bodies: [
      ellipsoid('helmet', h.length, h.width, h.height, h.roughness),
      { ...upright('boot-1', b.diameter, b.height), x: 1.2 },
      { ...upright('boot-2', b.diameter, b.height), x: 1.2 },
    ],
    elements: [],
    junctions: [],
    cavities: [],
  }
}
