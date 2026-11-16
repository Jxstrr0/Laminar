/**
 * Where record cars run (PR 9p): a salt flat, a dry lake bed baked hard and
 * flat. A course is marked with a black line down the middle: a run-up,
 * the timed kilometre, then room to stop. The record is the mean of a run
 * each way within the hour, so a steady wind mostly cancels.
 *
 * Heights in metres, temperatures °C, winds m/s.
 */

export interface SaltFlat {
  id: 'sukhoye'
  /** Height above the sea, m, and a usual record day's air, °C. */
  altitude: number
  temperature: number
  /** How a day varies (standard deviations): the air's temperature, the wind along the course and across it. */
  spread: { temperature: number; along: number; cross: number }
}

export const SALT_FLATS: Record<SaltFlat['id'], SaltFlat> = {
  /** Lake Sukhoye, in Tarnovia's dry south: a salt pan some 20 km long, hot by mid-morning. */
  sukhoye: {
    id: 'sukhoye',
    altitude: 420,
    temperature: 28,
    spread: { temperature: 4, along: 2.5, cross: 1.5 },
  },
}
