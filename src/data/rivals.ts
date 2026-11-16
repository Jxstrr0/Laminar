/**
 * The two rival firms (plan section 9.5, named by Kelbo on 16 November 2026).
 * Both put in sealed bids against you. Their reputation and correlation
 * scores are public, like yours, and drift a little from week to week.
 */
export type RivalId = 'bystro' | 'vysota'

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
}

export const RIVALS: Record<RivalId, RivalTemplate> = {
  bystro: {
    name: 'Bystro Aero',
    blurb: 'Cheap and quick. Promises big; the road doesn’t always agree.',
    reputation: 26,
    drift: 4,
    promise: { min: 0, max: 2.5 },
    price: { min: 0.3, max: 0.85 },
    readError: { min: 0.03, max: 0.09 },
    minFee: 0,
  },
  vysota: {
    name: 'Vysota Aerolab',
    blurb: 'A big tunnel, a big name and big prices. Only takes the big jobs.',
    reputation: 62,
    drift: 4,
    promise: { min: -0.5, max: 1.5 },
    price: { min: 0.85, max: 1 },
    readError: { min: 0.004, max: 0.025 },
    minFee: 120000,
  },
}

export const RIVAL_IDS = Object.keys(RIVALS) as RivalId[]

/** Rivals' public records move once a week. */
export const RIVAL_WEEK_DAYS = 7
