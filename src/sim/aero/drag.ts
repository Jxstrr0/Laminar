/**
 * Drag (plan section 6.2): D = ½ρV² · CdA, where CdA adds up
 *
 * - skin friction on the attached surface, laminar then turbulent;
 * - wake (pressure) drag behind the line where the flow separates;
 * - front-corner drag where a sharp nose makes the flow trip over its edge;
 * - interference where parts meet, and cavity drag in gaps, wells and spokes.
 *
 * Induced drag from lifting parts comes with lift (PR 1b).
 *
 * How it finds separation: each body has three surface lines (top, bottom,
 * side). Past the widest point the surface turns back towards the axis, and
 * the air has to slow down and climb a pressure hill. A laminar layer gives
 * up after about 10° of turning; a turbulent one after about 25°. Whether the
 * layer has gone turbulent by then depends on the Reynolds number, the air's
 * turbulence, roughness and trip strips. That is the drag crisis: past a
 * certain speed a sphere's layer goes turbulent first, separates later, its
 * wake shrinks and its drag drops by two thirds.
 */
import { CAVITY, FOREBODY, FRICTION, INTERFERENCE, SEPARATION, SPOKES, TRANSITION, WAKE } from '../../data/aero'
import { detPow } from '../det'
import type { BodyDescriptor, Cavity, Line, ShapeDescriptor } from '../geom/body'
import { sectionFill } from '../geom/body'
import { DEG, clamp01, interp, lerp, smoothstep } from '../num'
import type { Flow } from './flow'
import { mixedCf, roughCf, transitionDistance, tripEffect } from './friction'

/** What happened along one surface line. */
export interface LineResult {
  /** x where the layer goes turbulent (beyond the body's length if it never does). */
  transitionX: number
  /** x where the flow separates (the body's length if it holds on to the tail). */
  separationX: number
  /** True if the flow left the surface before the tail. */
  separated: boolean
  /** How turbulent the layer is where it separates: 0 laminar, 1 turbulent. */
  turbulent: number
  /** How sharp the front corner on this line is: 0 rounded, 1 a sharp edge. */
  corner: number
  /** Skin friction on this line's share of the surface, as CdA (m²). */
  frictionCdA: number
}

export type Regime = 'laminar' | 'mixed' | 'turbulent'

export interface BodyDrag {
  id: string
  /** Reynolds number on the body's length. */
  reynolds: number
  frictionCdA: number
  pressureCdA: number
  forebodyCdA: number
  /** Total, m². */
  cdA: number
  /** Drag coefficient on the body's frontal area. */
  cd: number
  /** Cross-section of the wake where the flow separates, m². */
  wakeArea: number
  /** Laminar or turbulent separation, for the report and the smoke. */
  regime: Regime
  lines: { top: LineResult; bottom: LineResult; side: LineResult }
}

export interface ShapeDrag {
  bodies: BodyDrag[]
  interferenceCdA: number
  cavityCdA: number
  /** Total, m². */
  cdA: number
  /** On the shape's summed frontal area. */
  cd: number
}

/**
 * Each line's share of the surface, from the biggest section: the top and
 * bottom lines cover its width, the two sides its height. A sphere splits a
 * quarter, a quarter and a half; a long cylinder across the flow is nearly
 * all top and bottom.
 */
function lineShares(body: BodyDescriptor): { top: number; bottom: number; side: number } {
  const sum = body.width + body.height
  if (!(sum > 0)) return { top: 0.25, bottom: 0.25, side: 0.5 }
  const tb = body.width / (2 * sum)
  return { top: tb, bottom: tb, side: body.height / sum }
}
/** Stand-in for "never" so sums stay finite. */
const NEVER = 1e9

/** First point past the crest where the surface has turned back by `turnRad`. */
function findTurn(line: Line, xs: number[], turnRad: number): { x: number; s: number } | null {
  for (let i = line.crest + 1; i < xs.length; i++) {
    const tau = -(line.slope[i] as number)
    if (tau >= turnRad) {
      const prev = -(line.slope[i - 1] as number)
      const t = tau > prev ? clamp01((turnRad - prev) / (tau - prev)) : 1
      return {
        x: lerp(xs[i - 1] as number, xs[i] as number, t),
        s: lerp(line.s[i - 1] as number, line.s[i] as number, t),
      }
    }
  }
  return null
}

/**
 * How sharp the front corner on a line is. Looks at how much the surface
 * turns inside a short window (a fraction of the body's height) anywhere on
 * the forebody. A flat face counts as 90°.
 */
function cornerSeverity(line: Line, size: number): number {
  const ss: number[] = []
  const deg: number[] = []
  if (line.faceArc > 1e-9) {
    ss.push(0, line.faceArc)
    deg.push(90, 90)
  }
  for (let i = 0; i < line.s.length; i++) {
    ss.push(line.s[i] as number)
    deg.push((line.slope[i] as number) / DEG)
  }
  const window = FOREBODY.window * size
  const starts = (line.faceArc > 1e-9 ? 2 : 0) + line.crest + 1
  let worst = 0
  for (let j = 0; j < starts && j < ss.length; j++) {
    const start = deg[j] as number
    // Just past the window, so a sharp edge (two points at the same arc) is caught.
    const end = interp(ss, deg, (ss[j] as number) + window)
    const turn = start - end
    const sev = clamp01((turn - FOREBODY.safeTurnDeg) / (90 - FOREBODY.safeTurnDeg))
    if (sev > worst) worst = sev
  }
  return worst * worst
}

function formFactor(fineness: number): number {
  const f = Math.max(fineness, 0.5)
  const ff = 1 + FRICTION.formA / detPow(f, 1.5) + FRICTION.formB / (f * f * f)
  return Math.min(ff, FRICTION.formMax)
}

function walkLine(
  body: BodyDescriptor,
  line: Line,
  weight: number,
  size: number,
  flow: Flow,
  unit: number,
): LineResult {
  const { xs, length } = body
  const n = xs.length
  const sEnd = line.s[n - 1] as number

  // Where does the layer go turbulent?
  let sTr = Math.min(transitionDistance(flow, body.roughness), NEVER)
  if (body.trip) {
    const sTrip = interp(xs, line.s, body.trip.at * length)
    const e = tripEffect(flow, body.trip.height)
    sTr = lerp(sTr, Math.min(sTr, sTrip), e)
  }
  const band = TRANSITION.band
  const turbulentAt = (s: number) => smoothstep(1 - band, 1 + band, s / sTr)

  // Where does it separate? Laminar first, turbulent if it got that far turbulent.
  const lam = findTurn(line, xs, SEPARATION.laminarTurnDeg * DEG)
  const turb = findTurn(line, xs, SEPARATION.turbulentTurnDeg * DEG)
  let sepX = length
  let sepS = sEnd
  let phi: number
  if (lam) {
    phi = turbulentAt(lam.s)
    sepX = lerp(lam.x, turb ? turb.x : length, phi)
    sepS = lerp(lam.s, turb ? turb.s : sEnd, phi)
  } else {
    phi = turbulentAt(sEnd)
  }
  const separated = sepX < length - 1e-9

  // Friction over the attached run only; the wake has none.
  const reL = unit * sepS
  const reTr = unit * Math.min(sTr, sepS)
  const cf = mixedCf(reL, reTr, roughCf(sepS, body.roughness))
  const attached = sEnd > 0 ? sepS / sEnd : 1
  const frictionCdA = cf * formFactor(body.fineness) * body.wettedArea * weight * attached

  return {
    transitionX: sTr >= NEVER ? NEVER : interp(line.s, xs, sTr) + Math.max(0, sTr - sEnd),
    separationX: sepX,
    separated,
    turbulent: phi,
    corner: cornerSeverity(line, size),
    frictionCdA,
  }
}

/** Drag of one body in a flow. */
export function bodyDrag(body: BodyDescriptor, flow: Flow): BodyDrag {
  const unit = flow.speed > 0 ? (flow.density * flow.speed) / flow.viscosity : 0
  const { top, bottom, side } = body.lines
  const WEIGHT = lineShares(body)
  const lines = {
    top: walkLine(body, top, WEIGHT.top, body.height, flow, unit),
    bottom: walkLine(body, bottom, WEIGHT.bottom, body.height, flow, unit),
    side: walkLine(body, side, WEIGHT.side, body.width, flow, unit),
  }

  // The wake's cross-section where the flow leaves each line.
  const h =
    interp(body.xs, top.r, lines.top.separationX) + interp(body.xs, bottom.r, lines.bottom.separationX)
  const w = 2 * interp(body.xs, side.r, lines.side.separationX)
  const wakeArea = sectionFill(body.squareness) * h * w
  const big = Math.max(h, w)
  const small = Math.min(h, w)
  const ratio = small > 1e-9 ? big / small : 1e3
  const flat = (ratio - 1) / (ratio - 1 + WAKE.flatnessHalf)

  // How turbulent the separating layers are, from the lines that separated
  // (or all of them, for a cut-off tail the flow reaches everywhere).
  const all = [
    [lines.top, WEIGHT.top],
    [lines.bottom, WEIGHT.bottom],
    [lines.side, WEIGHT.side],
  ] as const
  const used = all.some(([l]) => l.separated) ? all.filter(([l]) => l.separated) : all
  let wsum = 0
  let phi = 0
  for (const [l, wt] of used) {
    phi += l.turbulent * wt
    wsum += wt
  }
  phi = wsum > 0 ? phi / wsum : 0

  const drop = lerp(lerp(WAKE.laminarRound, WAKE.laminarFlat, flat), lerp(WAKE.turbulentRound, WAKE.turbulentFlat, flat), phi)
  const pressureCdA = flow.speed > 0 ? drop * wakeArea : 0

  const corner = lines.top.corner * WEIGHT.top + lines.bottom.corner * WEIGHT.bottom + lines.side.corner * WEIGHT.side
  const forebodyCdA = FOREBODY.sharpCornerCd * corner * body.frontalArea

  // A body sitting in another part's wake sees less dynamic pressure.
  const shelter = 1 - body.inWake
  const frictionCdA = (lines.top.frictionCdA + lines.bottom.frictionCdA + lines.side.frictionCdA) * shelter
  const cdA = frictionCdA + (pressureCdA + forebodyCdA) * shelter
  return {
    id: body.id,
    reynolds: unit * body.length,
    frictionCdA,
    pressureCdA: pressureCdA * shelter,
    forebodyCdA: forebodyCdA * shelter,
    cdA,
    cd: body.frontalArea > 0 ? cdA / body.frontalArea : 0,
    wakeArea,
    regime: phi < 1 / 3 ? 'laminar' : phi > 2 / 3 ? 'turbulent' : 'mixed',
    lines,
  }
}

/**
 * Drag area of one cavity. Spokes held still churn less air than spinning
 * ones (each spoke's top half meets the air at up to twice the road speed),
 * so a static wheel reads low.
 */
export function cavityDrag(c: Cavity): number {
  const k = CAVITY[c.kind]
  const still = c.kind === 'spokes' && c.spinning === false ? SPOKES.staticFactor : 1
  return c.area * k.peak * (c.depth / (c.depth + k.half)) * still
}

/** Drag of a whole shape: its bodies plus joints and cavities. */
export function shapeDrag(shape: ShapeDescriptor, flow: Flow): ShapeDrag {
  const bodies = shape.bodies.map((b) => bodyDrag(b, flow))
  let interferenceCdA = 0
  for (const j of shape.junctions) {
    interferenceCdA += INTERFERENCE[j.kind] * j.thickness * j.thickness * (1 - INTERFERENCE.filletCut * clamp01(j.fillet ?? 0))
  }
  const cavityCdA = shape.cavities.reduce((sum, c) => sum + cavityDrag(c), 0)
  const cdA = bodies.reduce((s, b) => s + b.cdA, 0) + interferenceCdA + cavityCdA
  return {
    bodies,
    interferenceCdA,
    cavityCdA,
    cdA,
    cd: shape.frontalArea > 0 ? cdA / shape.frontalArea : 0,
  }
}
