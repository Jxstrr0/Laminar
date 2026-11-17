/**
 * The two rival firms (plan section 9.5, named by Kelbo on 16 November 2026).
 * Both put in sealed bids against you. Their reputation and correlation
 * scores are public, like yours, and drift a little from week to week.
 */
import type { CountryId } from './export'

export type RivalId = 'bystro' | 'vysota' | 'vershina' | 'bereg'

export interface RivalTemplate {
  name: string
  /** One line for the Jobs screen. */
  blurb: string
  /** Its usual reputation, and how far it drifts either way from week to week. */
  reputation: number
  drift: number
  /** It promises the client's ask plus this many points (uniform). */
  promise: { min: number; max: number }
  /** Its price, as a share of the way through the fee range (uniform). */
  price: { min: number; max: number }
  /** How far off its declared CdA comes in on a job (a fraction, uniform): sets its correlation score. */
  readError: { min: number; max: number }
  /** It only bids for briefs whose top fee is at least this, ₽. */
  minFee: number
  /** A foreign firm (PR 11f): it bids only for its own country's briefs, and only they. */
  country?: CountryId
}

export const RIVALS: Record<RivalId, RivalTemplate> = {
  bystro: {
    name: 'Bystro Aero',
    blurb: 'Cheap and quick. Promises big; the real day doesn’t always agree.',
    reputation: 26,
    drift: 4,
    // PR 14d (Kelbo): bolder rivals, so bidding is a contest (the balance bot beat most asks by 5 to 25 points).
    promise: { min: 3, max: 8 },
    price: { min: 0.3, max: 0.85 },
    readError: { min: 0.03, max: 0.09 },
    minFee: 0,
  },
  vysota: {
    name: 'Vysota Aerolab',
    blurb: 'A big tunnel, a big name and big prices. Only takes the big jobs.',
    reputation: 62,
    drift: 4,
    promise: { min: 2, max: 6 },
    price: { min: 0.85, max: 1 },
    readError: { min: 0.004, max: 0.025 },
    minFee: 120000,
  },
  // Export (PR 11f): each country's own firm, at home in its air.
  vershina: {
    name: 'Vershina Aero',
    blurb: 'Gornova’s firm: a tunnel up in the mountains and careful, steady numbers.',
    reputation: 58,
    drift: 3,
    promise: { min: 2, max: 5 },
    price: { min: 0.55, max: 0.9 },
    readError: { min: 0.01, max: 0.035 },
    minFee: 0,
    country: 'gornova',
  },
  bereg: {
    name: 'Bereg Windworks',
    blurb: 'Zelenia’s firm: a seaside tunnel, quick work and bold promises.',
    reputation: 54,
    drift: 5,
    promise: { min: 3, max: 7 },
    price: { min: 0.4, max: 0.8 },
    readError: { min: 0.02, max: 0.07 },
    minFee: 0,
    country: 'zelenia',
  },
}

/** The Tarnovian firms, who bid for home briefs. */
export const RIVAL_IDS = (Object.keys(RIVALS) as RivalId[]).filter((id) => !RIVALS[id].country)
/** The foreign firms (PR 11f), one for each export country. */
export const FOREIGN_RIVAL_IDS = (Object.keys(RIVALS) as RivalId[]).filter((id) => RIVALS[id].country)

/** Rivals' public records move once a week. */
export const RIVAL_WEEK_DAYS = 7
