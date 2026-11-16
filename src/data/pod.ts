/**
 * Defence sensor pods (plan sections 2 and 9.7, PR 10y). The Tarnovian
 * Ministry of Defence flies the Gorlitsa P-4, a twin-engined patrol plane;
 * its new sensor is bigger than the old one, and hangs in a pod on a pylon
 * under the left wing. The firm shapes the pod round the sensor. Kelbo
 * chose (16 November 2026):
 * - The promise is **hours on station**: how long the plane can stay on
 *   patrol on a tank with the new pod, against the ministry's plane with
 *   its old pod. Drag at slow patrol speed decides it.
 * - The tunnel's trap (a later PR) is **the pod tested alone**: on its own
 *   a pod model reads less drag than it makes under the wing, where the
 *   pylon's gap to the wing adds interference drag. A pod on a wing model
 *   reads the truth.
 * - On the range, **the pod buffets**: a blunt tail sheds a shaking wake,
 *   worse when the pod hangs close to the wing; the sensor's picture blurs
 *   and the ministry rejects the run. Nobody is hurt.
 *
 * What the firm shapes:
 * - The nose fairing ahead of the sensor: 0 (a round dome) to 1 (a long
 *   fine point). Finer pushes less air aside but is longer and heavier.
 * - The tail cone behind it: 0 (cut off flat) to 1 (a long fine taper). A
 *   blunt base drags hard and its wake shakes the pod.
 * - The pylon's gap between the pod and the wing, m: close, the air
 *   squeezed between them drags (interference) and the wake shakes the
 *   wing; far, the pylon is longer, heavier and drags itself.
 * - The stagger: how far the pod sits forward of the wing, −1 (its middle
 *   under the wing's thickest part) to 1 (well ahead). Ahead, its thickest
 *   part is clear of the wing's (less interference), but the weight forward
 *   costs trim drag.
 *
 * Lengths in metres, areas m², masses kg, speeds m/s, energies J.
 */

export type PodClass = 'patrol'

export interface PodDesign {
  sport: 'pod'
  /** The ministry's plane: set by the brief, not shaped. */
  class: PodClass
  /** The nose fairing: 0 (a round dome) to 1 (a long fine point). */
  nose: number
  /** The tail cone: 0 (cut off flat) to 1 (a long fine taper). */
  tail: number
  /** The pylon's gap between the pod's top and the wing, m. */
  gap: number
  /** The stagger: −1 (under the wing's thickest part) to 1 (well forward of it). */
  at: number
}

/** Slider ranges. */
export const POD_RANGE = {
  patrol: {
    nose: { min: 0, max: 1, step: 0.05 },
    tail: { min: 0, max: 1, step: 0.05 },
    gap: { min: 0.1, max: 0.6, step: 0.02 },
    at: { min: -1, max: 1, step: 0.1 },
  },
}

/**
 * The new sensor as the ministry's workshop would hang it: in the old pod's
 * shape scaled up (a round nose, a short blunt tail), tight under the wing,
 * in the middle. A new job starts from it.
 */
export const STOCK_POD: Record<PodClass, PodDesign> = {
  patrol: { sport: 'pod', class: 'patrol', nose: 0.2, tail: 0.15, gap: 0.2, at: 0 },
}

/** The old pod's shape, round its smaller sensor: the ministry's plane as it flies now. */
export const OLD_POD: Record<PodClass, PodDesign> = {
  patrol: { sport: 'pod', class: 'patrol', nose: 0.2, tail: 0.15, gap: 0.2, at: 0 },
}

export interface PodClassSpec {
  /** The plane on patrol with half its fuel, without the pod, kg; wing area, m², span, m, and span efficiency. */
  mass: number
  wingArea: number
  span: number
  oswald: number
  /** The rest of the plane's drag area (fuselage, engines, tail and the rest), m². */
  airframeCdA: number
  /** The patrol speed, m/s (the sensor's sweep sets it), and the patrol height, m. */
  patrol: number
  /** Fuel for the patrol leg (after getting there and back, and the reserve), kg; its energy, J/kg; the share that becomes push (engines and props). */
  fuel: number
  fuelEnergy: number
  efficiency: number
  /** The sensors: the new one's diameter and the old one's, m. */
  newDiameter: number
  oldDiameter: number
  /** The sensor's own length inside the pod, m, and its mass with the pod's middle, kg (the old one is lighter). */
  sensorLength: number
  sensorMass: number
  oldSensorMass: number
}

export const POD_CLASS: Record<PodClass, PodClassSpec> = {
  patrol: {
    mass: 4000,
    wingArea: 30,
    span: 18,
    oswald: 0.8,
    airframeCdA: 0.42,
    patrol: 60,
    fuel: 380,
    fuelEnergy: 43e6,
    efficiency: 0.26,
    newDiameter: 0.6,
    oldDiameter: 0.46,
    sensorLength: 1.6,
    sensorMass: 140,
    oldSensorMass: 110,
  },
}

/** The pod's aero (gameplay model, tuned to a sensor pod on a pylon). Drag coefficients are on the pod's front (its circle). */
export const POD_AERO = {
  /** The nose: a round dome's pressure drag, and the share a fully fine point takes off (the gain flattens as it gets finer); the fairing's length, diameters, at a dome and at a fine point. */
  noseCd: 0.12,
  noseGain: 0.8,
  noseLen: { dome: 0.5, fine: 1.8 },
  /** The tail: a flat base's drag, and the share a long fine taper takes off (flattening the same way); its length, diameters, cut off and at the finest. */
  baseCd: 0.32,
  baseGain: 0.9,
  tailLen: { blunt: 0.4, fine: 2.4 },
  /** Skin friction on the pod's sides: drag coefficient per diameter of length (on the front). */
  skinPerLength: 0.012,
  /** The nose and tail fairings' mass per metre of their length round the new sensor, kg/m (scaled with the diameter's square). */
  fairingMass: 14,
  /**
   * Interference between pod and wing: a drag coefficient (on the pod's
   * front) of `interference` × (`gapScale` ÷ (`gapScale` + gap))², less
   * `stagger` × the stagger's share forward.
   */
  interference: 0.75,
  gapScale: 0.2,
  stagger: 0.45,
  /** The pylon: its drag area per metre of gap, m²/m, and its mass per metre, kg/m. */
  pylonCdA: 0.035,
  pylonMass: 40,
  /** The pod's weight forward costs trim drag: this drag area × the stagger², m². */
  trimCdA: 0.012,
}

/**
 * The pod's buffet on a sensor run (Kelbo's field failure): the wake behind
 * a blunt tail shakes the pod, `wake` × (1 − tail)², and hanging close to
 * the wing shakes it more, `near` × the share of `clear` m the gap falls
 * short; a smaller pod shakes less, by its front against the new
 * sensor's (the square of their diameters). Past `limit`, the sensor's picture
 * blurs and the run is rejected.
 */
export const POD_BUFFET = {
  wake: 1.25,
  near: 1.5,
  clear: 0.4,
  /** The ministry's limit on the buffet index. */
  limit: 1,
}

export interface TestRange {
  id: 'stepnoy'
  /** The range's height above the sea, m; the patrol height, m, and the air there on a usual day, °C. */
  altitude: number
  patrolAltitude: number
  temperature: number
}

export const TEST_RANGES: Record<TestRange['id'], TestRange> = {
  /** The Stepnoy test range: open steppe in Tarnovia's east, where the ministry tries new kit. */
  stepnoy: { id: 'stepnoy', altitude: 300, patrolAltitude: 1500, temperature: 9 },
}

/**
 * The pod's build, for its outline and its drawing (PR 10z): the pod on its
 * pylon under a stretch of the patrol plane's left wing. The aero above uses
 * its own numbers; these only shape and place the parts. Full size, m.
 */
export const POD_BODY = {
  /** The nose fairing's tip as a share of the sensor's radius, rounded (a dome) and fine (a point). */
  noseTip: { dome: 0.35, fine: 0.04 },
  /** How fully the nose rounds out: 0.5 an ellipse (a dome), larger a slimmer point. */
  noseCurve: { dome: 0.5, fine: 1 },
  /** The tail cone's base as a share of the sensor's radius: cut off flat, and at its finest. */
  base: { blunt: 0.78, fine: 0.04 },
  /** The stretch of wing drawn: its span, m, its chord, m, and its thickness as a share of chord. */
  wingSpan: 2.6,
  chord: 1.9,
  wingThick: 0.16,
  /** How far the pod's middle moves forward of the wing's thickest part per unit of stagger, m (the thickest part is 30 % back from the leading edge). */
  slide: 0.7,
  thickestAt: 0.3,
  /** The pylon's chord and thickness, m. */
  pylonChord: 0.9,
  pylonThick: 0.07,
  /** The pod's axis above the drawing's floor, m. */
  axis: 0.6,
}

/**
 * The sensor pod in the tunnel (PR 10aa). The pod sits on a sting on the
 * balance at 1:2.4 or 1:1.8 (POD_SCALES in model.ts). Kelbo's trap (16
 * November 2026): on its own, the pod reads only its own drag, and the firm
 * adds the pylon from the handbook; the squeezed air between pod and wing
 * never shows, nor the shake it adds. A pod model under a stretch of wing
 * fixed to the walls (MODEL_SHOP.wing), its pylon with it, reads both.
 */
export const POD_TUNNEL = {
  /** The stretch of wing's span at full size, m, for the blockage (its edge-on front with its chord and thickness, POD_BODY). */
  wingSpan: 2.6,
  /** How much a buffet reading scatters from one sample to the next (the shaking is never steady). */
  shakeNoise: 0.06,
}

/** The desk's guess at a pod (PR 10z): how far off its drag can be, shared by a job and per design. */
export const POD_DESK = {
  dragBias: 0.05,
  jitter: 0.015,
  /** A buffet index within this of the limit is an amber warning on the sheet. */
  buffetClose: 0.15,
}
