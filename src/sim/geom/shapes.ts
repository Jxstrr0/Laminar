/**
 * Builders for simple bodies: the reference shapes the tests and the
 * calibration runs use, and the pieces later sectors build from. Each takes
 * a few parameters and returns a BodySpec of cross-sections.
 */
import { detCos, detPow, PI } from '../det'
import type { BodySpec, Station } from './body'

/** Default number of cross-sections along a body. */
export const STATIONS = 97

/**
 * x positions packed closer at the nose and tail (cosine spacing), where the
 * surface turns fastest.
 */
export function cosineXs(length: number, n = STATIONS): number[] {
  const xs: number[] = []
  for (let i = 0; i < n; i++) xs.push((length * (1 - detCos((PI * i) / (n - 1)))) / 2)
  return xs
}

function circleHalf(x: number, radius: number, centre: number): number {
  const d = x - centre
  const v = radius * radius - d * d
  return v > 0 ? Math.sqrt(v) : 0
}

/** A smooth sphere. */
export function sphere(id: string, diameter: number, roughness = 0): BodySpec {
  const r = diameter / 2
  const stations: Station[] = cosineXs(diameter).map((x) => {
    const h = circleHalf(x, r, r)
    return { x, top: h, bottom: h, half: h }
  })
  return { id, stations, roughness }
}

/** An ellipsoid: length along the flow, width and height across it. */
export function ellipsoid(id: string, length: number, width: number, height: number, roughness = 0): BodySpec {
  const stations: Station[] = cosineXs(length).map((x) => {
    const f = circleHalf(x, length / 2, length / 2) / (length / 2)
    return { x, top: (f * height) / 2, bottom: (f * height) / 2, half: (f * width) / 2 }
  })
  return { id, stations, roughness }
}

/**
 * A round cylinder lying across the flow (an arm, a leg, a frame tube):
 * circular in the flow direction, `span` long across it.
 */
export function crossCylinder(id: string, diameter: number, span: number, roughness = 0): BodySpec {
  const r = diameter / 2
  const stations: Station[] = cosineXs(diameter).map((x) => {
    const h = circleHalf(x, r, r)
    return { x, top: h, bottom: h, half: span / 2 }
  })
  return { id, stations, squareness: 1, roughness }
}

/**
 * A round cylinder standing upright in the flow (a leg, a seat tube): round
 * seen from above, `height` tall.
 */
export function upright(id: string, diameter: number, height: number, roughness = 0): BodySpec {
  const r = diameter / 2
  const stations: Station[] = cosineXs(diameter).map((x) => ({
    x,
    top: height / 2,
    bottom: height / 2,
    half: circleHalf(x, r, r),
  }))
  return { id, stations, squareness: 1, roughness }
}

/**
 * A streamlined body with an elliptical cross-section (a torso, a helmet):
 * like streamlined() but wider than it is tall, or the other way round.
 */
export function streamlinedOval(
  id: string,
  length: number,
  width: number,
  height: number,
  maxAt = 0.35,
  tailEnd = 0,
  roughness = 0,
): BodySpec {
  const round = streamlined(id, length, 1, maxAt, tailEnd, roughness)
  return {
    ...round,
    stations: round.stations.map((p) => ({ x: p.x, top: p.top * height, bottom: p.bottom * height, half: p.half * width })),
  }
}

/**
 * A streamlined body of revolution: an elliptical nose up to its widest point
 * (at `maxAt`, a fraction of the length), then a smooth tail. `tailEnd` is
 * the tail's end diameter as a fraction of the widest: 0 closes to a point,
 * more than 0 cuts it off flat (a Kamm tail).
 */
export function streamlined(
  id: string,
  length: number,
  diameter: number,
  maxAt = 0.35,
  tailEnd = 0,
  roughness = 0,
): BodySpec {
  const R = diameter / 2
  const xm = length * maxAt
  const stations: Station[] = cosineXs(length).map((x) => {
    let r: number
    if (x <= xm) {
      r = R * Math.sqrt(Math.max(0, 1 - ((xm - x) / xm) * ((xm - x) / xm)))
    } else {
      // Smooth fall from R to the tail: a cubic with zero slope at the crest,
      // and a 1.5-power fade so a closed tail ends in a gentle point.
      const u = (x - xm) / (length - xm)
      const fall = u * u * (3 - 2 * u)
      const base = 1 - detPow(fall, 1.5)
      r = R * (tailEnd + (1 - tailEnd) * Math.max(0, base))
    }
    return { x, top: r, bottom: r, half: r }
  })
  return { id, stations, roughness }
}

/**
 * A box (a truck trailer, a van): flat front with its edges rounded to
 * `edgeRadius`, flat sides and a flat, cut-off back.
 */
export function box(
  id: string,
  length: number,
  width: number,
  height: number,
  edgeRadius: number,
  roughness = 0,
): BodySpec {
  const e = Math.max(0, Math.min(edgeRadius, width / 2, height / 2, length / 2))
  const xs = cosineXs(length)
  const stations: Station[] = xs.map((x) => {
    const round = x < e ? circleHalf(x, e, e) - e : 0
    return { x, top: height / 2 + round, bottom: height / 2 + round, half: width / 2 + round }
  })
  return { id, stations, squareness: 1, roughness }
}

/**
 * An upright tube with a teardrop profile seen from above (a Kamm-tail frame
 * tube): `chord` long in the flow, `thickness` wide, cut off at `tailEnd`.
 */
export function uprightProfile(
  id: string,
  chord: number,
  thickness: number,
  height: number,
  tailEnd = 0.35,
  roughness = 0,
): BodySpec {
  const plan = streamlined(id, chord, thickness, 0.3, tailEnd, roughness)
  return {
    ...plan,
    squareness: 1,
    stations: plan.stations.map((p) => ({ x: p.x, top: height / 2, bottom: height / 2, half: p.half })),
  }
}
