/**
 * The survey drone's flight (plan section 6, PR 10i): drag at survey speed,
 * range on a charge, how firmly it holds its nose (the static margin), and
 * whether a gust on a turn stalls it.
 *
 * The plane flies its survey lines at a fixed speed (the camera's overlap
 * sets it), so its range is the battery's usable energy, turned into push,
 * divided by the drag at that speed. Drag is the wing's own, the drag of
 * making lift (less with winglets and a lighter plane), the fuselage, the
 * camera pod, the tail, and the trim drag of holding the nose up.
 *
 * At each line's end it banks round, needing more lift. A gust lifts the
 * wing further; a plane held loosely in pitch noses up into the gust and
 * takes more. Past the wing's most lift, it stalls, spins and lands in the
 * field. Nobody is hurt; the drone breaks (plan section 7).
 */
import { PLANE_AERO as A, PLANE_CLASS, PLANE_GUST as G, type PlaneDesign, type SurveySite } from '../data/plane'
import { ATMOSPHERE } from '../data/field'
import { detCos, PI } from './det'
import { densityAt } from './field/atmosphere'

const DEG = PI / 180

/** The wing's span, m: the maker's, stretched or cut by the span slider (PR 10w). */
export function wingSpan(design: PlaneDesign): number {
  return PLANE_CLASS[design.class].span * design.span
}

/** The wing's area, m²: the maker's, plus the tapered tips' share of the chord for each metre of span added (less for each cut). */
export function wingArea(design: PlaneDesign): number {
  const c = PLANE_CLASS[design.class]
  return c.wingArea + (c.wingArea / c.span) * A.tipArea * (wingSpan(design) - c.span)
}

/** What the span slider adds to the plane's mass, kg (negative for a cut): the tips, and a stiffer spar for a longer wing. */
function spanMassAdded(design: PlaneDesign): number {
  const added = wingSpan(design) - PLANE_CLASS[design.class].span
  return A.spanMass * added + A.spanBend * Math.max(0, added) * Math.max(0, added)
}

/** The plane's all-up mass, kg: the maker's, plus the fairing, the longer nose, the winglets and any span added (less any cut). */
export function planeMass(design: PlaneDesign): number {
  const c = PLANE_CLASS[design.class]
  return (
    c.mass +
    A.fairingMass * design.camera.fairing +
    A.noseMass * (design.fuselage.nose - A.noseStock) +
    A.wingletMass * design.winglets +
    spanMassAdded(design)
  )
}

/** The camera pod as it hangs: the client's rule pulls it down to where the camera sees past the belly. */
export function cameraDrop(design: PlaneDesign): number {
  return Math.max(design.camera.drop, PLANE_CLASS[design.class].cameraMinDrop)
}

/** Whether the camera sits higher than the client allows (Shape flags it; the client lowers it before flying). */
export function cameraTooHigh(design: PlaneDesign): boolean {
  return design.camera.drop < PLANE_CLASS[design.class].cameraMinDrop
}

/** How firmly the plane holds its nose: the static margin, a share of the wing's chord (bigger is steadier). */
export function staticMargin(design: PlaneDesign): number {
  return A.margin + A.tailMargin * (design.tail - 1) + A.podMargin * design.camera.at - A.noseMargin * (design.fuselage.nose - A.noseStock)
}

/** The wing's span efficiency with these winglets. */
export function spanEfficiency(design: PlaneDesign): number {
  const c = PLANE_CLASS[design.class]
  return c.oswald * (1 + (A.wingletGain * design.winglets) / wingSpan(design))
}

/** Where the drag comes from at one speed, each a drag area, m², and the lift coefficient flown. */
export interface PlaneDrag {
  wing: number
  induced: number
  body: number
  pod: number
  tail: number
  winglets: number
  trim: number
  misc: number
  cdA: number
  cl: number
}

/** The drag at this speed and air, in level flight carrying its weight (or `load` times it, as in a banked turn). */
export function planeDrag(design: PlaneDesign, speed: number, density: number, load = 1): PlaneDrag {
  const q = 0.5 * density * speed * speed
  return dragAtLift(design, (planeMass(design) * ATMOSPHERE.gravity * load) / (q * wingArea(design)))
}

/**
 * The drag making a lift coefficient `cl` (PR 10k: the tunnel sets the
 * wing's angle instead of its weight). `wingCd` scales the wing's own
 * profile drag (a small model's wing, at a low Reynolds number, drags more).
 */
export function dragAtLift(design: PlaneDesign, cl: number, wingCd = 1): PlaneDrag {
  const area = wingArea(design)
  const span = wingSpan(design)
  const aspect = (span * span) / area
  const induced = ((cl * cl) / (PI * spanEfficiency(design) * aspect)) * area
  const f = design.fuselage
  const body = A.bodyFront * (A.bodySkin + A.noseBluff / f.nose + A.bodyBase * (1 - f.taper)) + A.noseSkin * f.nose
  const pod = A.podFront * A.podCd * (1 - A.podFaired * design.camera.fairing) * (A.podFlush + (1 - A.podFlush) * cameraDrop(design))
  const tail = A.tailCdA * design.tail
  const winglets = A.wingletCdA * design.winglets
  const trim = A.trimCdA * Math.max(0, staticMargin(design))
  const wing = A.wingCd0 * area * wingCd
  return { wing, induced, body, pod, tail, winglets, trim, misc: A.miscCdA, cdA: wing + induced + body + pod + tail + winglets + trim + A.miscCdA, cl }
}

/** The air at a survey site on a day, kg/m³. */
export function siteDensity(site: SurveySite, temperature = site.temperature): number {
  return densityAt(temperature, site.altitude)
}

/** Range on a charge at survey speed, km. */
export function planeRange(design: PlaneDesign, site: SurveySite, temperature = site.temperature, opts: { drag?: number } = {}): number {
  const c = PLANE_CLASS[design.class]
  const density = siteDensity(site, temperature)
  const d = planeDrag(design, c.survey, density)
  const drag = 0.5 * density * c.survey * c.survey * d.cdA * (opts.drag ?? 1)
  return (c.battery * c.usable * c.propulsive) / drag / 1000
}

/** A turn at a line's end in a gust: the lift it needs, the gust's share, and whether it stalls. */
export interface GustTurn {
  /** Lift coefficient the banked turn needs, what the gust adds (after any pitch-up), and the total. */
  turn: number
  gust: number
  total: number
  /** How much the loose pitch grew the gust's lift (1: held firmly). */
  amplified: number
  /** The wing's most lift (the full-size wing's, unless given), and whether the total passes it. */
  clMax: number
  stalls: boolean
}

/**
 * A turn at survey speed in a gust of `gust` m/s, against the wing's most
 * lift `clMax` (the full-size wing's by default), with the plane's static
 * margin (or `margin`, as the tunnel measured it).
 */
export function gustTurn(design: PlaneDesign, site: SurveySite, gust = site.gust, temperature = site.temperature, clMax = PLANE_CLASS[design.class].clMax, margin = staticMargin(design)): GustTurn {
  const c = PLANE_CLASS[design.class]
  const density = siteDensity(site, temperature)
  const turn = planeDrag(design, c.survey, density, 1 / detCos(c.bank * DEG)).cl
  const amplified = 1 + G.gain * Math.max(0, (G.steady - margin) / G.steady)
  const lift = c.liftSlope * (gust / c.survey) * amplified
  const total = turn + lift
  return { turn, gust: lift, total, amplified, clMax, stalls: total > clMax }
}

/**
 * The strongest gust it rides out on a turn, m/s, against `clMax` (the
 * full-size wing's by default): 0 if it can't even make the turn.
 */
export function gustLimit(design: PlaneDesign, site: SurveySite, temperature = site.temperature, clMax = PLANE_CLASS[design.class].clMax, margin = staticMargin(design)): number {
  const c = PLANE_CLASS[design.class]
  const t = gustTurn(design, site, 0, temperature, clMax, margin)
  if (t.turn >= clMax) return 0
  return ((clMax - t.turn) * c.survey) / (c.liftSlope * t.amplified)
}
