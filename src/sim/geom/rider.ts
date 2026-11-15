/**
 * Builds the reference rider and bike (src/data/rider.ts) as a shape. A plain
 * cyclist for checking the aero model against known numbers; the shaped
 * cyclist with posture morphs replaces it in PR 2.
 */
import { REFERENCE_BIKE, SKINSUIT_ROUGHNESS, type RiderPart, type RiderPosition } from '../../data/rider'
import { PI } from '../det'
import type { BodySpec, ShapeSpec } from './body'
import { ellipsoid, streamlinedOval, upright } from './shapes'

function build(part: RiderPart, n: number): BodySpec {
  const id = part.count && part.count > 1 ? `${part.id}-${n + 1}` : part.id
  let spec: BodySpec
  if (part.kind === 'upright') spec = upright(id, part.length, part.height, SKINSUIT_ROUGHNESS)
  else if (part.kind === 'ellipsoid') spec = ellipsoid(id, part.length, part.width, part.height, SKINSUIT_ROUGHNESS)
  else spec = streamlinedOval(id, part.length, part.width, part.height, part.maxAt, part.tailEnd, SKINSUIT_ROUGHNESS)
  return { ...spec, x: part.x, ...(part.wake ? { inWake: part.wake } : {}) }
}

/** The reference rider in a position, on the reference bike. */
export function referenceRider(position: RiderPosition): ShapeSpec {
  const bodies: BodySpec[] = []
  for (const part of position.parts) {
    for (let n = 0; n < (part.count ?? 1); n++) bodies.push(build(part, n))
  }
  const bike = REFERENCE_BIKE
  for (const tube of bike.tubes) bodies.push({ ...upright(tube.id, tube.diameter, tube.height), x: tube.x, inWake: tube.wake })
  for (const wheel of bike.wheels) {
    bodies.push({ ...upright(`${wheel.id}-tyre`, bike.tyre.diameter, bike.tyre.height), x: wheel.x, inWake: wheel.wake })
  }
  const disc = (PI * bike.wheelDiameter * bike.wheelDiameter) / 4
  return {
    bodies,
    junctions: [
      { kind: 'arm-torso', thickness: position.armJoint },
      { kind: 'arm-torso', thickness: position.armJoint },
      { kind: 'wheel-frame', thickness: bike.forkThickness },
      { kind: 'wheel-frame', thickness: bike.forkThickness },
    ],
    cavities: bike.wheels.map((w) => ({ kind: 'spokes' as const, area: disc * (1 - w.wake), depth: w.spokes / 32 })),
  }
}
