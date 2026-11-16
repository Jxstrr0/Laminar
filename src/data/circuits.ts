/**
 * Racing circuits (PR 9i): a lap as straights and corners. A corner has a
 * radius and how far it turns, left or right; the turns add up to one full
 * circle. The lap is driven flat out where the car can be: corners at the
 * speed the tyres (helped by downforce) hold, straights to the top speed or
 * the next braking point.
 *
 * Lengths and radii in metres, angles in degrees.
 */

export type CircuitSegment = { kind: 'straight'; length: number } | { kind: 'corner'; radius: number; angle: number; dir: 'L' | 'R' }

export interface Circuit {
  id: 'dolgo-ring' | 'stavren-park'
  segments: readonly CircuitSegment[]
  /** Height above the sea, m, and a usual race day's air, °C. */
  altitude: number
  temperature: number
}

const S = (length: number): CircuitSegment => ({ kind: 'straight', length })
const R = (radius: number, angle: number): CircuitSegment => ({ kind: 'corner', radius, angle, dir: 'R' })
const L = (radius: number, angle: number): CircuitSegment => ({ kind: 'corner', radius, angle, dir: 'L' })

export const CIRCUITS: Record<Circuit['id'], Circuit> = {
  /** By Lake Dolgo: a long main straight, fast sweepers and one tight hairpin. Drag counts here. */
  'dolgo-ring': {
    id: 'dolgo-ring',
    altitude: 180,
    temperature: 18,
    segments: [S(1000), R(60, 90), S(350), R(110, 60), S(500), L(35, 70), S(250), R(180, 80), S(700), R(20, 150), S(450), L(90, 60), S(300), R(70, 110), S(200)],
  },
  /** Round Stavren's park: short straights and slow corners one after another. Downforce counts here. */
  'stavren-park': {
    id: 'stavren-park',
    altitude: 240,
    temperature: 16,
    segments: [S(500), R(25, 90), S(200), L(40, 60), S(150), R(30, 120), S(300), R(60, 45), S(250), L(20, 90), S(180), R(45, 135), S(220), R(35, 75), S(150), R(80, 45), S(120)],
  },
}

/** A segment's length along the racing line, m. */
export function segmentLength(seg: CircuitSegment): number {
  return seg.kind === 'straight' ? seg.length : (seg.radius * seg.angle * 3.141592653589793) / 180
}

/** The lap's length, m. */
export function lapLength(circuit: Circuit): number {
  return circuit.segments.reduce((sum, seg) => sum + segmentLength(seg), 0)
}
