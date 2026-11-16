/**
 * The firm's career (plan sections 4 and 9): money, the calendar, the brief
 * board and the job in hand. Every step here is a pure function from one
 * state to the next, so the save holds the whole career as plain numbers.
 *
 * - Tunnel runs cost money and no days, with or without a job.
 * - Model orders need a job, cost money and spend days from its budget.
 * - A brief is won with a sealed bid against one rival firm; a lost brief
 *   leaves the board and another takes its place while any are left.
 * - Delivering runs the event, pays the fee, jumps the calendar to the
 *   event and refreshes the board.
 */
import { BID, BRIEFS, CAREER, PROMISE, type BriefTemplate } from '../data/briefs'
import type { CyclistDesign } from '../data/cyclist'
import { REFERENCE_RIDER } from '../data/field'
import { riderEvent } from './cyclist'
import { cyclistShape } from './geom/cyclist'
import { hashString, Rng } from './rng'
import type { Guide } from './guide'
import { fieldResult, REFERENCE_TT, truth, type EventSpec, type FieldResult } from './views'

/** A brief as it sits on the board: which client, and the terms on offer. */
export interface Brief {
  /** The template's id in BRIEFS. */
  id: string
  /** The client's suggested fee, ₽ (the job's fee is what you bid). */
  fee: number
  days: number
  /** Seed for this job's desk bias and its event day. */
  seed: number
}

export interface Job {
  brief: Brief
  /** The promised cut, % of wind-averaged CdA from the client's setup (from your bid). */
  promise: number
  /** The career day the job was taken. */
  startDay: number
  daysLeft: number
  /** Money spent while on the job (runs and models), ₽. */
  spent: number
}

/** One finished job, kept for the firm's record (and the correlation score in PR 7). */
export interface JobRecord {
  id: string
  /** Race day. */
  day: number
  fee: number
  paid: number
  /** Promised and achieved cut, %. */
  promised: number
  achieved: number
  /** Declared and real CdA on the day, m². */
  predicted: number
  actual: number
}

export interface CareerState {
  /** The career's own seed: its tunnel's quirks and every board. */
  seed: number
  /** ₽ (may go below zero; the soft landing comes with PR 7). */
  money: number
  /** Days since the career began. */
  day: number
  jobsDone: number
  /** Which board this is: one more after every delivery or week's wait. */
  round: number
  board: Brief[]
  /** Briefs lost to the rival on this board, so they don't come back to it. */
  lost: string[]
  job: Job | null
  /** Finished jobs, oldest first. */
  history: JobRecord[]
  /** The partner's guide through the first job (src/sim/guide.ts). */
  guide: Guide
}

/** Why a model can't be ordered now, or null if it can. */
export type OrderBlock = 'noJob' | 'noDays' | null

export function briefTemplate(id: string): BriefTemplate | undefined {
  return BRIEFS.find((b) => b.id === id)
}

function template(id: string): BriefTemplate {
  const found = briefTemplate(id)
  if (!found) throw new RangeError(`unknown brief ${id}`)
  return found
}

/** A template as it goes on a board: a suggested fee and its own seed. */
function onBoard(b: BriefTemplate, rng: Rng): Brief {
  const fee = Math.round(rng.range(b.fee.min, b.fee.max) / CAREER.feeRound) * CAREER.feeRound
  return { id: b.id, fee, days: b.days, seed: rng.int(1, 0x7fffffff) }
}

/**
 * Board number `round`: the tutorial first while no job is done, and always
 * one small brief. (Round n of a career that has never waited or lost is the
 * board after n jobs, as before bids.)
 */
export function boardFor(seed: number, round: number, firstJob = round === 0): Brief[] {
  const rng = new Rng(seed).fork(`board-${round}`)
  const first = firstJob ? BRIEFS.filter((b) => b.tutorial) : []
  const small = rng.shuffle(BRIEFS.filter((b) => b.small))
  const rest = rng.shuffle(BRIEFS.filter((b) => !b.tutorial && !b.small))
  const picked = [...first, ...small.slice(0, 1)]
  for (const b of [...rest, ...small.slice(1)]) {
    if (picked.length >= CAREER.boardSize) break
    picked.push(b)
  }
  return picked.map((b) => onBoard(b, rng))
}

export function newCareer(seed: number): CareerState {
  return {
    seed,
    money: CAREER.startMoney,
    day: 0,
    jobsDone: 0,
    round: 0,
    board: boardFor(seed, 0),
    lost: [],
    job: null,
    history: [],
    guide: { off: false, done: [] },
  }
}

/** The event a brief is for, ready for the field model. */
export function eventOf(brief: Pick<Brief, 'id'>): EventSpec {
  const b = template(brief.id)
  return {
    temperature: b.event.temperature,
    altitude: b.event.altitude,
    riderSpeed: b.event.riderSpeed,
    windSpeed: b.event.windSpeed,
    course: b.event.course,
    rider: { ...REFERENCE_RIDER, power: b.rider.power, mass: b.rider.mass },
    refX: REFERENCE_TT.refX,
    spread: b.event.spread,
  }
}

/** The event the bench is working towards: the job's, or the reference time trial between jobs. */
export function currentEvent(state: CareerState): EventSpec {
  return state.job ? eventOf(state.job.brief) : REFERENCE_TT
}

/** Take a brief off the board at its suggested fee and the client's ask. Only one job at a time. */
export function acceptBrief(state: CareerState, id: string): CareerState {
  const brief = state.board.find((b) => b.id === id)
  if (!brief) return state
  return take(state, brief, { price: brief.fee, promise: template(id).target })
}

function take(state: CareerState, brief: Brief, bid: Bid): CareerState {
  if (state.job) return state
  return { ...state, job: { brief: { ...brief, fee: bid.price }, promise: bid.promise, startDay: state.day, daysLeft: brief.days, spent: 0 } }
}

/** A sealed bid: a price, ₽, and a promised cut, %. */
export interface Bid {
  price: number
  promise: number
}

export interface BidResult {
  state: CareerState
  won: boolean
  /** Your bid as it went in (kept inside the limits). */
  mine: Bid
  /** The rival's bid, or null when the client asked for you alone (the first job). */
  rival: Bid | null
  /** What the client counts each promised point as worth, ₽. */
  worth: number
}

/** ₽ the client counts each promised point as worth: a share of the middle of the fee range. */
export function pointWorth(id: string): number {
  const b = template(id)
  return Math.round((((b.fee.min + b.fee.max) / 2) * BID.pointValue) / 100) * 100
}

/** How the client rates a bid: the promise's worth plus what it saves under the top of the fee range. Higher wins. */
export function bidScore(id: string, bid: Bid): number {
  return bid.promise * pointWorth(id) + template(id).fee.max - bid.price
}

const roundTo = (x: number, step: number) => Math.round(x / step) * step

/** A bid brought inside the brief's fee range and the promise limits, on the steps. */
export function clampBid(id: string, bid: Bid): Bid {
  const b = template(id)
  const price = Math.min(b.fee.max, Math.max(b.fee.min, roundTo(bid.price, BID.priceStep)))
  const promise = Math.min(BID.promiseMax, Math.max(BID.promiseMin, roundTo(bid.promise, BID.promiseStep)))
  return { price, promise }
}

/** The rival firm's sealed bid for a brief (seeded by the brief), or null for the first job. */
export function rivalBid(brief: Brief): Bid | null {
  const b = template(brief.id)
  if (b.tutorial) return null
  const rng = new Rng(brief.seed).fork('rival')
  const promise = b.target + rng.range(BID.rivalPromise.min, BID.rivalPromise.max)
  const share = rng.range(BID.rivalPrice.min, BID.rivalPrice.max)
  return clampBid(brief.id, { price: b.fee.min + share * (b.fee.max - b.fee.min), promise })
}

/**
 * Put in a sealed bid. Win (ties go to you) and the job starts at your price
 * and promise. Lose and the brief leaves the board, and another the firm
 * hasn't lost this round takes its place if there is one. Null if the brief
 * isn't on the board or a job is in hand.
 */
export function placeBid(state: CareerState, id: string, bid: Bid): BidResult | null {
  const brief = state.board.find((b) => b.id === id)
  if (!brief || state.job) return null
  const mine = clampBid(id, bid)
  const rival = rivalBid(brief)
  const worth = pointWorth(id)
  const won = !rival || bidScore(id, mine) >= bidScore(id, rival)
  if (won) return { state: take(state, brief, mine), won, mine, rival, worth }
  const lost = [...state.lost, id]
  const board = state.board.filter((b) => b.id !== id)
  const spare = BRIEFS.filter((b) => !b.tutorial && !lost.includes(b.id) && !board.some((o) => o.id === b.id))
  if (spare.length > 0) {
    const rng = new Rng(state.seed).fork(`refill-${state.round}-${lost.length}`)
    board.push(onBoard(rng.pick(spare), rng))
  }
  return { state: { ...state, board, lost }, won, mine, rival, worth }
}

/** Wait a week for a fresh board (when the rival has taken every brief). */
export function waitForBriefs(state: CareerState): CareerState {
  if (state.job) return state
  const round = state.round + 1
  return { ...state, day: state.day + BID.waitDays, round, board: boardFor(state.seed, round, state.jobsDone === 0), lost: [] }
}

/** Spend money (a run, a model). Goes on the job's tally when there is one. */
export function charge(state: CareerState, amount: number): CareerState {
  return {
    ...state,
    money: state.money - amount,
    job: state.job ? { ...state.job, spent: state.job.spent + amount } : null,
  }
}

export function orderBlock(state: CareerState, days: number): OrderBlock {
  if (!state.job) return 'noJob'
  return days > state.job.daysLeft ? 'noDays' : null
}

/** Order a model: pay for it and let its days pass (Kelbo: days pass at once, the model arrives straight away). */
export function orderModel(state: CareerState, price: number, days: number): CareerState {
  if (orderBlock(state, days)) return state
  const paid = charge(state, price)
  return { ...paid, day: paid.day + days, job: { ...paid.job!, daysLeft: paid.job!.daysLeft - days } }
}

/** How close a declared CdA was to the road's. */
export type Read = 'good' | 'fair' | 'poor'

/** What race day showed (plan section 4, step 8). */
export interface Debrief {
  /** Promised and achieved cut, % (achieved: both setups ridden in the day's air). */
  promised: number
  achieved: number
  met: boolean
  /** Points short after the allowance (0 if met). */
  shortfall: number
  /** ₽ taken off the fee. */
  penalty: number
  /** Declared and real CdA on the day, m². */
  predicted: number
  actual: number
  /** (declared − real) ÷ real. */
  readError: number
  read: Read
  /** The client's old setup on the same day, and the time your design saved, s. */
  baseline: FieldResult
  timeSaved: number
  /**
   * Why a miss happened: the design doesn't cut enough even on a typical
   * day ('design'), or it does and the day's wind took it away ('day').
   */
  cause: 'design' | 'day' | null
}

/** The fee, less a slice per point short (Kelbo: at most half, after a small allowance). */
export function penaltyFor(fee: number, promised: number, achieved: number): { shortfall: number; penalty: number } {
  const shortfall = Math.max(0, promised - PROMISE.allowance - achieved)
  const share = Math.min(PROMISE.maxShare, shortfall * PROMISE.perPoint)
  return { shortfall, penalty: Math.round((fee * share) / 100) * 100 }
}

export function readOf(error: number): Read {
  const e = Math.abs(error)
  return e <= PROMISE.goodRead ? 'good' : e <= 2 * PROMISE.goodRead ? 'fair' : 'poor'
}

export interface Delivery {
  state: CareerState
  /** The job that was delivered. */
  job: Job
  event: EventSpec
  result: FieldResult
  debrief: Debrief
  /** What the client paid, ₽. */
  paid: number
}

/** The seed for a job's event day. */
export function daySeed(brief: Brief): number {
  return hashString(`day:${brief.seed}`)
}

/**
 * Deliver the design with a declared CdA: the calendar jumps to the event,
 * the rider races it (with whatever power the position costs them), and so
 * does their old setup in the same air, for the promise. The fee is paid,
 * less any penalty. Null if there's no job.
 */
export function deliver(state: CareerState, design: CyclistDesign, predicted: number): Delivery | null {
  const job = state.job
  if (!job) return null
  const b = template(job.brief.id)
  const event = eventOf(job.brief)
  const seed = daySeed(job.brief)
  const shape = cyclistShape(design)
  const result = fieldResult(shape, riderEvent(design, event), seed)
  const baseline = fieldResult(cyclistShape(b.setup), riderEvent(b.setup, event), seed)
  const achieved = (1 - result.cdA / baseline.cdA) * 100
  const { shortfall, penalty } = penaltyFor(job.brief.fee, job.promise, achieved)
  const met = shortfall === 0
  // On a typical day, would the design have kept the promise? Then the miss was the day's.
  const typical = (1 - truth(shape, event).windAveragedCdA / truth(cyclistShape(b.setup), event).windAveragedCdA) * 100
  const readError = (predicted - result.cdA) / result.cdA
  const debrief: Debrief = {
    promised: job.promise,
    achieved,
    met,
    shortfall,
    penalty,
    predicted,
    actual: result.cdA,
    readError,
    read: readOf(readError),
    baseline,
    timeSaved: baseline.time - result.time,
    cause: met ? null : typical >= job.promise - PROMISE.allowance ? 'day' : 'design',
  }
  const paid = job.brief.fee - penalty
  const jobsDone = state.jobsDone + 1
  const raceDay = state.day + job.daysLeft
  const record: JobRecord = {
    id: job.brief.id,
    day: raceDay,
    fee: job.brief.fee,
    paid,
    promised: job.promise,
    achieved,
    predicted,
    actual: result.cdA,
  }
  const next: CareerState = {
    ...state,
    money: state.money + paid,
    day: raceDay,
    jobsDone,
    round: state.round + 1,
    board: boardFor(state.seed, state.round + 1, false),
    lost: [],
    job: null,
    history: [...state.history, record],
  }
  return { state: next, job, event, result, debrief, paid }
}
