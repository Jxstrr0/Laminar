/**
 * Tarnovian records (PR 11a; Kelbo, 16 November 2026: "Tarnovian records").
 * A standing board of national records, each held by a fictional name. A
 * job whose result on the day beats one puts the client's name, and the
 * firm's, on the board. Defence jobs never do (they're secret).
 *
 * The standing marks are set so a client's old setup falls short of them and
 * a well-shaped design can beat them on a good day. Every name here is
 * fictional and listed in docs/NAMES.md.
 */

export type RecordId = 'hour' | 'timeTrial' | 'skiJump' | 'landSpeed' | 'truckFuel'

/** The board's order. */
export const RECORD_IDS: readonly RecordId[] = ['hour', 'timeTrial', 'skiJump', 'landSpeed', 'truckFuel']

/** What a record is counted in: km in an hour, km/h, metres, or litres per 100 km. */
export type RecordUnit = 'km' | 'kmh' | 'm' | 'per100'

export interface StandingRecord {
  /** Who holds it now (a rider, a jumper, a driver or a fleet). */
  holder: string
  /** The mark, in `unit`. */
  value: number
  /** The year it was set (before the career's first year). */
  year: number
  unit: RecordUnit
  /** Whether a bigger number beats it (a fuel figure is beaten by a smaller one). */
  better: 'higher' | 'lower'
}

export const RECORDS: Record<RecordId, StandingRecord> = {
  // The hour on the Stavren boards: distance ridden in 60 minutes.
  hour: { holder: 'Anton Zimin', value: 51.3, year: 2006, unit: 'km', better: 'higher' },
  // The fastest time trial of 40 km or more on the road: average speed.
  timeTrial: { holder: 'Oksana Rudakova', value: 49.2, year: 2008, unit: 'kmh', better: 'higher' },
  // The longest ski jump measured on a Tarnovian hill.
  skiJump: { holder: 'Fyodor Shirokov', value: 131.5, year: 2009, unit: 'm', better: 'higher' },
  // The land-speed record: the two-way mean through the timed kilometre.
  landSpeed: { holder: 'Mikhail Avdeev', value: 1180, year: 1997, unit: 'kmh', better: 'higher' },
  // The best wind-averaged fuel figure from a fleet's fuel trial.
  truckFuel: { holder: 'Dubrova Transport', value: 32.6, year: 2009, unit: 'per100', better: 'lower' },
}

/** Rules for which results count. */
export const RECORD_RULES = {
  /** A road time trial counts for the time-trial record only if it is at least this long, m. */
  timeTrialMin: 40000,
  /**
   * Each unit is measured to one part in this (100: hundredths). A new mark
   * must beat the old one at this precision (a record isn't broken by a
   * thousandth nobody can time).
   */
  scale: { km: 100, kmh: 10, m: 10, per100: 10 } as Record<RecordUnit, number>,
  /** A record attempt's bonus when the record falls (PR 11c): this share of the fee, rounded to `bonusRound` ₽. */
  bonus: 0.4,
  bonusRound: 1000,
}
