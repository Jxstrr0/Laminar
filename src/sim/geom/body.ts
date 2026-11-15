/**
 * Shape descriptors (plan section 6.1). Shaping makes a parameter vector;
 * builders in shapes.ts turn it into body specs (cross-sections along the
 * flow), and describe() measures them: frontal and side area, wetted area,
 * fineness, rear closure, and three streamwise lines (over the top, under
 * the bottom, round the side) that the drag model walks to find where the
 * flow goes turbulent and where it separates.
 *
 * The sim never reads the GPU mesh: everything here is plain numbers.
 * Units are metres. x runs downstream from the body's nose.
 */
import { detAtan2, PI } from '../det'
import type { CavityKind, JunctionKind } from '../../data/aero'

/** One cross-section across the flow. */
export interface Station {
  /** Distance downstream from the nose. */
  x: number
  /** Height of the top surface above the body's axis. */
  top: number
  /** Depth of the bottom surface below the axis (positive downwards). */
  bottom: number
  /** Half the width. */
  half: number
}

/** A single body: a stack of cross-sections plus its surface. */
export interface BodySpec {
  id: string
  /** Sections from nose (x = 0) to tail, x ascending. */
  stations: Station[]
  /** Section shape: 0 is an ellipse, 1 a rectangle. */
  squareness?: number
  /** Surface roughness as an equivalent sand-grain height, in metres. */
  roughness?: number
  /** A trip strip: where it sits (fraction of length) and how tall it is (m). */
  trip?: { at: number; height: number }
  /** Where the body's nose sits along the shape's axis (m), for moments. Default 0. */
  x?: number
  /**
   * Fraction of dynamic pressure lost because the body sits in another
   * part's wake (a rider's thighs behind the arms). 0 to 1.
   */
  inWake?: number
}

/**
 * A wing, fin, disc wheel or diffuser: something that makes lift (or side
 * force) on purpose. Horizontal ones make lift or downforce; vertical ones
 * make side force in a crosswind.
 */
export interface LiftingElement {
  id: string
  plane: 'horizontal' | 'vertical'
  /** Span and chord, metres. */
  span: number
  chord: number
  /** Maximum camber as a fraction of chord (0.04 is 4 %); negative turns it upside down. */
  camber: number
  /** Thickness as a fraction of chord. */
  thickness: number
  /** Set angle in degrees: nose up for horizontal, toe for vertical. */
  angleDeg: number
  /** Endplate height over span (0 for none). */
  endplates?: number
  /** 0 stalls softly, 1 stalls sharply. */
  stallSharpness?: number
  /** Height above the ground in metres (horizontal only); leave out for free air. */
  rideHeight?: number
  /** Fraction of dynamic pressure lost to another part's wake (0 to 1). */
  inWake?: number
  /** Where its quarter-chord sits along the shape's axis (m), for moments. */
  x: number
  /** Surface roughness (sand-grain height, m). */
  roughness?: number
}

/** Where two parts meet (adds interference drag). */
export interface Junction {
  kind: JunctionKind
  /** Thickness of the thinner part at the joint, in metres. */
  thickness: number
  /** 0 is a bare joint, 1 a full fillet. */
  fillet?: number
}

/** A gap, well or spinning-spoke disc the air churns in. */
export interface Cavity {
  kind: CavityKind
  /** Opening area in m² (disc area for spokes). */
  area: number
  /** Depth over opening width (spoke count over 32 for spokes). */
  depth: number
  /** Spokes only: false for a wheel held still, as on a tunnel model without a wheel drive. */
  spinning?: boolean
}

/** A whole shape: bodies plus the joints and cavities between them. */
export interface ShapeSpec {
  bodies: BodySpec[]
  elements?: LiftingElement[]
  junctions?: Junction[]
  cavities?: Cavity[]
}

/** One streamwise surface line, as the drag model walks it. */
export interface Line {
  /** Distance from the body's axis outwards at each station. */
  r: number[]
  /** Surface angle to the flow at each station, in radians (+ = growing). */
  slope: number[]
  /** Arc length from the stagnation point at each station. */
  s: number[]
  /** Arc across a flat front face before the first station (0 for a round or pointed nose). */
  faceArc: number
  /** Index of the widest point (first one, if the line runs flat). */
  crest: number
}

export interface BodyDescriptor {
  id: string
  /** Where the nose sits along the shape's axis. */
  x: number
  /** Fraction of dynamic pressure lost to another part's wake. */
  inWake: number
  stations: Station[]
  /** x of each station (handy for interpolation). */
  xs: number[]
  length: number
  squareness: number
  roughness: number
  trip: { at: number; height: number } | null
  /** Largest cross-section area, m². */
  frontalArea: number
  /** Silhouette seen from the side, m². */
  sideArea: number
  /** x of the side silhouette's centroid (where a side force acts, roughly). */
  sideCentroidX: number
  /** Total surface area, m². */
  wettedArea: number
  /** Length over the diameter of a circle with the frontal area. */
  fineness: number
  /** Steepest closing angle of the equivalent radius over the back half, degrees. */
  closureDeg: number
  /** Height and width at the biggest section. */
  height: number
  width: number
  lines: { top: Line; bottom: Line; side: Line }
}

export interface ShapeDescriptor {
  bodies: BodyDescriptor[]
  elements: LiftingElement[]
  junctions: Junction[]
  cavities: Cavity[]
  /** Sum of the bodies' frontal areas (overlaps aren't removed). */
  frontalArea: number
}

/** Fraction of the bounding rectangle a section fills: π/4 for an ellipse, 1 for a rectangle. */
export function sectionFill(squareness: number): number {
  return PI / 4 + (1 - PI / 4) * squareness
}

export function sectionArea(st: Station, squareness: number): number {
  return (st.top + st.bottom) * 2 * st.half * sectionFill(squareness)
}

/** Perimeter of a section: Ramanujan's ellipse blended towards a rectangle. */
export function sectionPerimeter(st: Station, squareness: number): number {
  const a = st.half
  const b = (st.top + st.bottom) / 2
  const ellipse = PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)))
  const rect = 4 * (a + b)
  return ellipse + (rect - ellipse) * squareness
}

function buildLine(xs: number[], r: number[], faceArc: number): Line {
  const n = r.length
  const slope: number[] = []
  for (let i = 0; i < n; i++) {
    const i0 = i > 0 ? i - 1 : 0
    const i1 = i < n - 1 ? i + 1 : n - 1
    slope.push(detAtan2((r[i1] as number) - (r[i0] as number), (xs[i1] as number) - (xs[i0] as number)))
  }
  const s: number[] = [faceArc]
  for (let i = 1; i < n; i++) {
    const dx = (xs[i] as number) - (xs[i - 1] as number)
    const dr = (r[i] as number) - (r[i - 1] as number)
    s.push((s[i - 1] as number) + Math.sqrt(dx * dx + dr * dr))
  }
  let crest = 0
  for (let i = 1; i < n; i++) if ((r[i] as number) > (r[crest] as number) + 1e-12) crest = i
  return { r, slope, s, faceArc, crest }
}

/** Measure a body spec. */
export function describeBody(spec: BodySpec): BodyDescriptor {
  const st = spec.stations
  if (st.length < 3) throw new RangeError(`body ${spec.id}: needs at least 3 stations`)
  const sq = spec.squareness ?? 0
  const xs = st.map((p) => p.x)
  const n = st.length
  const length = (xs[n - 1] as number) - (xs[0] as number)

  let frontal = 0
  let big = 0
  let side = 0
  let sideMoment = 0
  let wetted = 0
  for (let i = 0; i < n; i++) {
    const a = sectionArea(st[i] as Station, sq)
    if (a > frontal) { frontal = a; big = i }
    if (i > 0) {
      const p = st[i - 1] as Station
      const q = st[i] as Station
      const dx = q.x - p.x
      const h = (p.top + p.bottom + q.top + q.bottom) / 2
      side += h * dx
      sideMoment += h * dx * ((p.x + q.x) / 2)
      // Lateral surface of the frustum between the two sections.
      const per = (sectionPerimeter(p, sq) + sectionPerimeter(q, sq)) / 2
      const dr = Math.sqrt(sectionArea(q, sq) / PI) - Math.sqrt(sectionArea(p, sq) / PI)
      wetted += per * Math.sqrt(dx * dx + dr * dr)
    }
  }
  // Flat front and back faces count as wetted too.
  wetted += sectionArea(st[0] as Station, sq) + sectionArea(st[n - 1] as Station, sq)

  // Rear closure: steepest drop of the equivalent radius over the back half.
  let closure = 0
  for (let i = 1; i < n; i++) {
    const p = st[i - 1] as Station
    const q = st[i] as Station
    if (q.x < (xs[0] as number) + length / 2) continue
    const dr = Math.sqrt(sectionArea(p, sq) / PI) - Math.sqrt(sectionArea(q, sq) / PI)
    const ang = (detAtan2(dr, q.x - p.x) * 180) / PI
    if (ang > closure) closure = ang
  }

  // A flat front face (a box nose) is where the flow starts: the stagnation
  // point sits in its middle and the air runs out across it to the edge. A
  // section with no height or no width isn't a face.
  const first = st[0] as Station
  const faceHeight = first.top + first.bottom
  const vFace = first.half > 0 ? faceHeight / 2 : 0
  const hFace = faceHeight > 0 ? first.half : 0
  const lines = {
    top: buildLine(xs, st.map((p) => p.top), vFace),
    bottom: buildLine(xs, st.map((p) => p.bottom), vFace),
    side: buildLine(xs, st.map((p) => p.half), hFace),
  }
  const widest = st[big] as Station
  const eqD = Math.sqrt((4 * frontal) / PI)

  return {
    id: spec.id,
    x: spec.x ?? 0,
    inWake: Math.min(1, Math.max(0, spec.inWake ?? 0)),
    stations: st,
    xs,
    length,
    squareness: sq,
    roughness: spec.roughness ?? 0,
    trip: spec.trip ?? null,
    frontalArea: frontal,
    sideArea: side,
    sideCentroidX: side > 0 ? sideMoment / side : length / 2,
    wettedArea: wetted,
    fineness: eqD > 0 ? length / eqD : 0,
    closureDeg: closure,
    height: widest.top + widest.bottom,
    width: 2 * widest.half,
    lines,
  }
}

export function describeShape(spec: ShapeSpec): ShapeDescriptor {
  const bodies = spec.bodies.map(describeBody)
  return {
    bodies,
    elements: spec.elements ?? [],
    junctions: spec.junctions ?? [],
    cavities: spec.cavities ?? [],
    frontalArea: bodies.reduce((sum, b) => sum + b.frontalArea, 0),
  }
}

/**
 * The same shape at another scale (a 1:4 model is scale 0.25). Geometry
 * scales; roughness and trip-strip height don't, because a model's paint and
 * tape are real-size on the model.
 */
export function scaleShape(spec: ShapeSpec, scale: number): ShapeSpec {
  return {
    bodies: spec.bodies.map((b) => ({
      ...b,
      ...(b.x !== undefined ? { x: b.x * scale } : {}),
      stations: b.stations.map((p) => ({ x: p.x * scale, top: p.top * scale, bottom: p.bottom * scale, half: p.half * scale })),
    })),
    elements: (spec.elements ?? []).map((e) => ({
      ...e,
      span: e.span * scale,
      chord: e.chord * scale,
      x: e.x * scale,
      ...(e.rideHeight !== undefined ? { rideHeight: e.rideHeight * scale } : {}),
    })),
    junctions: (spec.junctions ?? []).map((j) => ({ ...j, thickness: j.thickness * scale })),
    cavities: (spec.cavities ?? []).map((c) => ({ ...c, area: c.area * scale * scale })),
  }
}
