/**
 * Turns a cyclist design (src/data/cyclist.ts) into a shape the aero model
 * reads: the parameter vector in, bodies, sails, joints and spoke drag out.
 * The renderer draws the same bodies, so what you see is what the sim tests.
 */
import {
  ARMS,
  BIKE,
  HELMET,
  LEGS,
  LEG_SWING,
  SUIT,
  TORSO,
  TUCK,
  type CyclistDesign,
  type WheelKind,
} from '../../data/cyclist'
import { REFERENCE_WHEEL } from '../../data/tunnel'
import { detCos, detSin, PI } from '../det'
import { clamp, clamp01, DEG, lerp } from '../num'
import type { BodySpec, Cavity, LiftingElement, ShapeSpec } from './body'
import { ellipsoid, streamlinedOval, upright, uprightProfile } from './shapes'

/** 0 in a full tuck, 1 sitting upright (can run a little past either end). */
export function tuckFactor(torsoDeg: number): number {
  const lo = detSin(TUCK.tuckDeg * DEG)
  const hi = detSin(TUCK.uprightDeg * DEG)
  return clamp((detSin(torsoDeg * DEG) - lo) / (hi - lo), TUCK.min, TUCK.max)
}

const pos = (b: BodySpec, x: number, wake = 0): BodySpec => ({ ...b, x, ...(wake > 0 ? { inWake: clamp01(wake) } : {}) })

/** Helmet length, m (the rule box checks it). */
export function helmetLength(design: CyclistDesign): number {
  return design.helmet.kind === 'aero'
    ? HELMET.aero.lengthBase + HELMET.aero.lengthPerTail * design.helmet.tail
    : HELMET.road.length
}

/** Frame tube length-to-width ratio (the rule box checks it). */
export function tubeAspect(design: CyclistDesign): number {
  return design.frame === 'kamm' ? BIKE.kammChord : 1
}

/** How much the legs' frontal height swells at a crank angle (1 on average over a stroke). */
export function legFactor(crankDeg: number): number {
  return 1 + LEG_SWING.amp * detCos(2 * (crankDeg - LEG_SWING.peakDeg) * DEG)
}

export interface CyclistShapeOptions {
  /**
   * Fix the legs at this crank angle, as on a tunnel model. Leave it out for
   * a pedalling rider, whose legs' drag averages over the stroke.
   */
  crankDeg?: number
  /** Hold the wheels still, as on a tunnel model with no wheel drive. Leave it out for wheels that spin. */
  staticWheels?: boolean
}

export function cyclistShape(design: CyclistDesign, options: CyclistShapeOptions = {}): ShapeSpec {
  const p = design.posture
  const aero = design.bars === 'aero'
  const sine = detSin(p.torsoDeg * DEG)
  const skin = SUIT.smooth
  const armSkin = SUIT[design.suit.fabric]
  const bodies: BodySpec[] = []
  const elements: LiftingElement[] = []
  const cavities: Cavity[] = []

  // Torso.
  const tuck = tuckFactor(p.torsoDeg)
  const narrow = Math.max(0, ARMS.shelterFrom - p.armWidth)
  const torsoWake =
    lerp(TORSO.wakeTuck, TORSO.wakeUpright, tuck) + (aero ? TORSO.wakeAeroBars : 0) + TORSO.wakePerHeadDrop * p.headDrop + TORSO.wakePerNarrowArm * narrow
  bodies.push(
    pos(
      streamlinedOval(
        'torso',
        TORSO.lengthBase - TORSO.lengthPerSine * sine,
        TORSO.widthBase + TORSO.widthPerArm * p.armWidth,
        TORSO.heightBase + TORSO.heightPerSine * sine,
        TORSO.maxAt,
        TORSO.tailEndBase + TORSO.tailEndPerSine * sine,
        skin,
      ),
      TORSO.x,
      torsoWake,
    ),
  )

  // Helmet.
  const handShield = aero ? HELMET.wakePerHandHeight * Math.max(0, p.handHeight) : 0
  const helmetWake = HELMET.wakePerHeadDrop * p.headDrop + handShield
  if (design.helmet.kind === 'aero') {
    const a = HELMET.aero
    const tailUp = a.tailLift * design.helmet.tail * (1 - p.headDrop)
    bodies.push(
      pos(
        streamlinedOval(
          'helmet',
          helmetLength(design),
          a.width,
          a.height + tailUp,
          a.maxAt,
          Math.max(0, a.tailEndBase - a.tailEndPerTail * design.helmet.tail),
        ),
        HELMET.x,
        helmetWake,
      ),
    )
    if (design.helmet.vents > 0) cavities.push({ kind: 'well', area: a.ventArea * design.helmet.vents, depth: HELMET.ventDepth })
  } else {
    const r = HELMET.road
    bodies.push(pos(ellipsoid('helmet', r.length, r.width, r.height), HELMET.x, helmetWake))
    if (design.helmet.vents > 0) cavities.push({ kind: 'well', area: r.ventArea * design.helmet.vents, depth: HELMET.ventDepth })
  }

  // Arms, with the suit's fabric and trip strips.
  const trip = design.suit.armTrips ? { trip: { at: SUIT.tripAt, height: SUIT.tripHeight } } : {}
  const arm = aero ? ARMS.aero : ARMS.drops
  for (const side of [1, 2]) {
    if (aero) {
      const f = ARMS.aero.forearm
      const tilt = Math.max(0, p.handHeight) / f.length
      bodies.push(
        pos(
          streamlinedOval(`forearm-${side}`, f.length, f.width, f.height + f.length * Math.min(0.6, tilt), f.maxAt, f.tailEnd, armSkin),
          f.x,
        ),
      )
    } else {
      const f = ARMS.drops.forearm
      bodies.push(pos({ ...upright(`forearm-${side}`, f.diameter, f.height, armSkin), ...trip }, f.x, f.wake))
    }
    const upperWake = arm.upper.wake + (aero ? ARMS.upperShelterPerMetre * narrow : 0)
    bodies.push(pos({ ...upright(`upper-arm-${side}`, arm.upper.diameter, arm.upper.height, armSkin), ...trip }, arm.upper.x, upperWake))
    const t = LEGS.thigh
    const s = LEGS.shin
    const swell = options.crankDeg === undefined ? 1 : legFactor(options.crankDeg)
    bodies.push(pos(upright(`thigh-${side}`, t.diameter, t.height * swell, skin), t.x, lerp(t.wakeTuck, t.wakeUpright, tuck)))
    bodies.push(pos(upright(`shin-${side}`, s.diameter, s.height * swell, skin), s.x, lerp(s.wakeTuck, s.wakeUpright, tuck)))
  }

  // Frame.
  for (const tube of BIKE.tubes) {
    const b =
      design.frame === 'kamm'
        ? uprightProfile(tube.id, tube.diameter * BIKE.kammChord, tube.diameter, tube.height, BIKE.kammTailEnd)
        : upright(tube.id, tube.diameter, tube.height)
    bodies.push(pos(b, tube.x, tube.wake))
  }

  // Wheels: tyre, spokes, and the sail a deep rim or disc makes.
  const disc = (PI * BIKE.wheelDiameter * BIKE.wheelDiameter) / 4
  const wheel = (id: 'front' | 'rear', kind: WheelKind) => {
    const w = BIKE.wheels[id]
    bodies.push(pos(upright(`${id}-tyre`, BIKE.tyre.diameter, BIKE.tyre.height), w.x, w.wake))
    const open = kind === 'spoked' ? 1 : kind === 'deep' ? 1 - BIKE.deepSpokeCover : 0
    if (open > 0) cavities.push(spokeDisc(disc * open * (1 - w.wake), w.spokes, !options.staticWheels))
    if (kind !== 'spoked') {
      elements.push({
        id: `${id}-wheel`,
        plane: 'vertical',
        span: BIKE.wheelDiameter,
        chord: kind === 'disc' ? BIKE.wheelDiameter : BIKE.wheelDiameter * BIKE.deepChord,
        camber: 0,
        thickness: BIKE.discThickness,
        angleDeg: 0,
        x: w.x,
        ...(w.wake > 0 ? { inWake: w.wake } : {}),
      })
    }
  }
  wheel('front', design.wheels.front)
  wheel('rear', design.wheels.rear)

  return {
    bodies,
    elements,
    junctions: [
      { kind: 'arm-torso', thickness: arm.joint },
      { kind: 'arm-torso', thickness: arm.joint },
      { kind: 'wheel-frame', thickness: BIKE.forkThickness },
      { kind: 'wheel-frame', thickness: BIKE.forkThickness },
    ],
    cavities,
  }
}

/** A wheel's spokes as the drag model sees them: a disc of churning air. */
function spokeDisc(area: number, spokes: number, spinning: boolean): Cavity {
  return { kind: 'spokes', area, depth: spokes / 32, ...(spinning ? {} : { spinning: false }) }
}

/**
 * The lab's reference wheel (plan section 7.2): a plain spoked wheel on its
 * own, whose spinning drag is in the book. Full size; scale it like a model.
 */
export function referenceWheel(spinning: boolean): ShapeSpec {
  const disc = (PI * BIKE.wheelDiameter * BIKE.wheelDiameter) / 4
  return {
    bodies: [upright('reference-tyre', BIKE.tyre.diameter, BIKE.tyre.height)],
    cavities: [spokeDisc(disc, REFERENCE_WHEEL.spokes, spinning)],
  }
}
