/**
 * Truck routes (PR 9a): the highway a fleet's trucks run, as legs with a
 * length, a grade and a heading. The wind on the day comes from one
 * direction, so it meets each leg at its own angle: a headwind on one leg
 * is a crosswind on the next.
 *
 * Lengths in metres, grades in per cent (climb per 100 m), headings in
 * degrees clockwise from north, speeds m/s.
 */

export interface RouteLeg {
  length: number
  grade: number
  heading: number
}

export interface Route {
  id: 'stavren-mostograd'
  legs: readonly RouteLeg[]
  /** The road's height above the sea, m. */
  altitude: number
  /** The truck speed limit on it, m/s (90 km/h). */
  speed: number
  /** A usual day: air temperature °C and wind speed m/s. */
  temperature: number
  wind: number
}

const leg = (km: number, grade: number, heading: number): RouteLeg => ({ length: km * 1000, grade, heading })

export const ROUTES: Record<Route['id'], Route> = {
  /** Out of Stavren, across the open plain and up over a low ridge to Mostograd's ring road. */
  'stavren-mostograd': {
    id: 'stavren-mostograd',
    altitude: 250,
    speed: 25,
    temperature: 12,
    wind: 5,
    legs: [
      leg(12, 0.5, 70),
      leg(30, 0, 95),
      leg(18, 1, 110),
      leg(12, -1.5, 120),
      leg(40, 0, 80),
      leg(10, 2, 60),
      leg(10, -2, 60),
      leg(25, 0.3, 100),
      leg(8, 0, 145),
    ],
  },
}
