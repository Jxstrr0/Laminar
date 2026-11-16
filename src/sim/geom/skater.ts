/**
 * Turns a skater design (src/data/skater.ts) into a shape the aero model
 * reads, the same way geom/cyclist.ts does for a rider: trunk, head (cap or
 * hood), arms, legs and blades. The renderer draws the same crouch.
 */
import {
  BLADE,
  CROUCH,
  SK_ARMS,
  SK_HEAD,
  SK_LEGS,
  SK_SUIT,
  SK_TORSO,
  type SkaterDesign,
} from '../../data/skater'
import { detSin } from '../det'
import { clamp, clamp01, DEG, lerp } from '../num'
import type { BodySpec, ShapeSpec } from './body'
import { ellipsoid, streamlinedOval, upright, uprightProfile } from './shapes'

/** 0 in the deepest crouch, 1 standing tall. */
export function standFactor(kneeDeg: number): number {
  return clamp01((kneeDeg - CROUCH.deepDeg) / (CROUCH.tallDeg - CROUCH.deepDeg))
}

const pos = (b: BodySpec, x: number, wake = 0): BodySpec => ({ ...b, x, ...(wake > 0 ? { inWake: clamp01(wake) } : {}) })

export function skaterShape(design: SkaterDesign): ShapeSpec {
  const p = design.posture
  const sine = detSin(clamp(p.trunkDeg, 0, 90) * DEG)
  const stand = standFactor(p.kneeDeg)
  const skin = SK_SUIT[design.suit.fabric]
  const bodies: BodySpec[] = []

  // Head: a rough cap, or a smooth hood that closes onto the back.
  const headWake = SK_HEAD.wakePerHeadDrop * p.headDrop
  if (design.hood === 'hood') {
    const h = SK_HEAD.hood
    bodies.push(pos(streamlinedOval('head', h.length, h.width, h.height, h.maxAt, h.tailEnd, SK_SUIT.smooth), SK_HEAD.x, headWake))
  } else {
    const c = SK_HEAD.cap
    bodies.push(pos(ellipsoid('head', c.length, c.width, c.height, c.roughness), SK_HEAD.x, headWake))
  }

  // Trunk.
  const t = SK_TORSO
  bodies.push(
    pos(
      streamlinedOval(
        'torso',
        t.lengthBase - t.lengthPerSine * sine,
        t.width,
        t.heightBase + t.heightPerSine * sine,
        t.maxAt,
        t.tailEndBase + t.tailEndPerSine * sine,
        skin,
      ),
      t.x,
      t.wakeBase + t.wakePerHeadDrop * p.headDrop,
    ),
  )

  // Arms, legs and blades, both sides.
  const a = SK_ARMS[design.arms]
  const trip = design.suit.legTrips ? { trip: { at: SK_SUIT.tripAt, height: SK_SUIT.tripHeight } } : {}
  for (const side of [1, 2]) {
    bodies.push(pos(upright(`arm-${side}`, a.diameter, a.height, skin), a.x, a.wake))
    const th = SK_LEGS.thigh
    const sh = SK_LEGS.shin
    bodies.push(pos(upright(`thigh-${side}`, th.diameter, lerp(th.heightDeep, th.heightTall, stand), skin), th.x, lerp(th.wakeDeep, th.wakeTall, stand)))
    bodies.push(
      pos({ ...upright(`shin-${side}`, sh.diameter, lerp(sh.heightDeep, sh.heightTall, stand), skin), ...trip }, sh.x, lerp(sh.wakeDeep, sh.wakeTall, stand)),
    )
    const bt = SK_LEGS.boot
    bodies.push(pos(upright(`boot-${side}`, bt.diameter, bt.height, SK_SUIT.smooth), bt.x))
    bodies.push(pos(uprightProfile(`blade-${side}`, BLADE.chord, BLADE.thickness, BLADE.height, BLADE.tailEnd), BLADE.x))
  }

  return {
    bodies,
    elements: [],
    junctions: [
      { kind: 'arm-torso', thickness: SK_ARMS.joint },
      { kind: 'arm-torso', thickness: SK_ARMS.joint },
    ],
    cavities: [],
  }
}
