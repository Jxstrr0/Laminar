/**
 * The firm's career (plan sections 4 and 9): money, the calendar, the brief
 * board and the job in hand. Every step here is a pure function from one
 * state to the next, so the save holds the whole career as plain numbers.
 *
 * - Tunnel runs cost money and no days, with or without a job.
 * - Model orders need a job, cost money and spend days from its budget.
 * - A brief is won with a sealed bid against the rival firms (Bystro Aero on
 *   every brief, Vysota Aerolab on the big ones); a lost brief
 *   leaves the board and another takes its place while any are left.
 * - Your own tunnel is bought with cash and opens OWN_TUNNEL_BUILD.days later;
 *   from then on its upkeep is paid for every day that passes (passDays).
 * - Delivering runs the event, pays the fee, jumps the calendar to the
 *   event and refreshes the board.
 */
import { BID, BRIEFS, CAREER, PROMISE, type BriefTemplate } from '../data/briefs'
import type { CyclistDesign } from '../data/cyclist'
import { REFERENCE_RIDER } from '../data/field'
import { comfort, riderEvent } from './cyclist'
import type { FixTarget } from './failure'
import { cyclistShape } from './geom/cyclist'
import { hashString, Rng } from './rng'
import type { Guide } from './guide'
import { readOf, reputationOf, type Read } from './reputation'
import { REPUTATION } from '../data/reputation'
import { RIVALS, RIVAL_IDS, type RivalId } from '../data/rivals'
import { rivalRecord } from './rivals'
import { buildBlock, NO_FACILITY, upkeepDays, type Facility } from './facility'
import { OWN_TUNNEL_BUILD } from '../data/tunnel'
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

/** One finished job, kept for the firm's record: its reputation and correlation score come from these. */
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
  /** Briefs lost to a rival on this board, so they don't come back to it. */
  lost: string[]
  job: Job | null
  /** Finished jobs, oldest first. */
  history: JobRecord[]
  /** The partner's guide through the first job (src/sim/guide.ts). */
  guide: Guide
  /** Where the firm tests: the university's tunnel, and your own once it's paid for. */
  facility: Facility
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

/** Clients who'll call a firm with this reputation (Kelbo: a good name brings bigger clients). */
export function openTo(b: BriefTemplate, reputation: number): boolean {
  return (b.minRep ?? 0) <= reputation
}

/**
 * Board number `round`: the tutorial first while no job is done, and always
 * one small brief; the rest are clients who'll call a firm with this
 * reputation. (Round n of a career that has never waited or lost is the
 * board after n jobs, as before bids.)
 */
export function boardFor(seed: number, round: number, firstJob = round === 0, reputation: number = REPUTATION.start): Brief[] {
  const rng = new Rng(seed).fork(`board-${round}`)
  const first = firstJob ? BRIEFS.filter((b) => b.tutorial) : []
  const small = rng.shuffle(BRIEFS.filter((b) => b.small))
  const rest = rng.shuffle(BRIEFS.filter((b) => !b.tutorial && !b.small && openTo(b, reputation)))
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
    facility: NO_FACILITY,
  }
}

/** The upkeep due for `days` more days from the career's day, ₽. */
export function upkeepFor(state: CareerState, days: number): number {
  return upkeepDays(state.facility, state.day, state.day + days) * OWN_TUNNEL_BUILD.upkeepPerDay
}

/**
 * Let days pass: the calendar moves on and the open tunnel's upkeep is paid
 * for each of them. Upkeep is the firm's cost, not the job's, so it stays
 * off the job's tally.
 */
export function passDays(state: CareerState, days: number): CareerState {
  if (days <= 0) return state
  return { ...state, money: state.money - upkeepFor(state, days), day: state.day + days }
}

/** Pay for your own tunnel (cash only); it opens OWN_TUNNEL_BUILD.days later. Unchanged if it can't be bought. */
export function buildOwnTunnel(state: CareerState): CareerState {
  if (buildBlock(state.facility, state.money)) return state
  return { ...state, money: state.money - OWN_TUNNEL_BUILD.price, facility: { ...state.facility, ownOrdered: state.day } }
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
  /** The rivals' bids (none when the client asked for you alone, as on the first job). */
  rivals: RivalBid[]
  /** Who got the job: null for you, or the rival that beat you. */
  winner: RivalId | null
  /** What the client counts each promised point as worth, ₽. */
  worth: number
  /** Your firm's reputation, as the client weighed it. */
  myRep: number
}

/** A rival firm's sealed bid, with the reputation the client weighed it with. */
export interface RivalBid {
  firm: RivalId
  bid: Bid
  reputation: number
}

/** ₽ the client counts each promised point as worth: a share of the middle of the fee range. */
export function pointWorth(id: string): number {
  const b = template(id)
  return Math.round((((b.fee.min + b.fee.max) / 2) * BID.pointValue) / 100) * 100
}

/**
 * How the client rates a bid: the promise's worth plus what it saves under
 * the top of the fee range, plus a little for the firm's name (each
 * reputation point counts as a small share of a promised point). Higher wins.
 */
export function bidScore(id: string, bid: Bid, reputation = 0): number {
  return (bid.promise + reputation * REPUTATION.bidPerPoint) * pointWorth(id) + template(id).fee.max - bid.price
}

const roundTo = (x: number, step: number) => Math.round(x / step) * step

/** A bid brought inside the brief's fee range and the promise limits, on the steps. */
export function clampBid(id: string, bid: Bid): Bid {
  const b = template(id)
  const price = Math.min(b.fee.max, Math.max(b.fee.min, roundTo(bid.price, BID.priceStep)))
  const promise = Math.min(BID.promiseMax, Math.max(BID.promiseMin, roundTo(bid.promise, BID.promiseStep)))
  return { price, promise }
}

/** The firms that bid for a brief: none for the first job, Vysota Aerolab only on the big ones. */
export function biddersFor(id: string): RivalId[] {
  const b = template(id)
  if (b.tutorial) return []
  return RIVAL_IDS.filter((firm) => b.fee.max >= RIVALS[firm].minFee)
}

/** One rival's sealed bid for a brief (seeded by the brief and the firm). */
export function rivalBid(brief: Brief, firm: RivalId): Bid {
  const b = template(brief.id)
  const r = RIVALS[firm]
  const rng = new Rng(brief.seed).fork(`rival-${firm}`)
  const promise = b.target + rng.range(r.promise.min, r.promise.max)
  const share = rng.range(r.price.min, r.price.max)
  return clampBid(brief.id, { price: b.fee.min + share * (b.fee.max - b.fee.min), promise })
}

/** Every rival's bid for a brief, weighed with that firm's reputation this week. */
export function rivalBids(state: Pick<CareerState, 'seed' | 'day'>, brief: Brief): RivalBid[] {
  return biddersFor(brief.id).map((firm) => ({
    firm,
    bid: rivalBid(brief, firm),
    reputation: rivalRecord(state.seed, firm, state.day).reputation,
  }))
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
  const rivals = rivalBids(state, brief)
  const worth = pointWorth(id)
  const myRep = reputationOf(state.history)
  // The best rival bid; ties between rivals go to the first listed, and a tie with you goes to you.
  let best: RivalBid | null = null
  for (const r of rivals) if (!best || bidScore(id, r.bid, r.reputation) > bidScore(id, best.bid, best.reputation)) best = r
  const won = !best || bidScore(id, mine, myRep) >= bidScore(id, best.bid, best.reputation)
  if (won) return { state: take(state, brief, mine), won, mine, rivals, winner: null, worth, myRep }
  const lost = [...state.lost, id]
  const board = state.board.filter((b) => b.id !== id)
  const spare = BRIEFS.filter((b) => !b.tutorial && openTo(b, myRep) && !lost.includes(b.id) && !board.some((o) => o.id === b.id))
  if (spare.length > 0) {
    const rng = new Rng(state.seed).fork(`refill-${state.round}-${lost.length}`)
    board.push(onBoard(rng.pick(spare), rng))
  }
  return { state: { ...state, board, lost }, won, mine, rivals, winner: best!.firm, worth, myRep }
}

/** Wait a week for a fresh board (when the rivals have taken every brief). */
export function waitForBriefs(state: CareerState): CareerState {
  if (state.job) return state
  const round = state.round + 1
  return { ...passDays(state, BID.waitDays), round, board: boardFor(state.seed, round, state.jobsDone === 0, reputationOf(state.history)), lost: [] }
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
  const paid = passDays(charge(state, price), days)
  return { ...paid, job: { ...paid.job!, daysLeft: paid.job!.daysLeft - days } }
}

/**
 * Send a broken model for repair (plan section 8): pay the repair and the
 * screens if it tore off the mount, and let the repair days pass. With no
 * job there's no clock to spend; with too few days left it can't be done.
 */
export function repairModel(state: CareerState, price: number, days: number): CareerState {
  if (state.job && days > state.job.daysLeft) return state
  const paid = charge(state, price)
  if (!paid.job) return paid
  const later = passDays(paid, days)
  return { ...later, job: { ...paid.job, daysLeft: paid.job.daysLeft - days } }
}

/** How close a declared CdA was to the road's. */
export { readOf, type Read }

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
  /**
   * Trouble on the road (plan section 7): time the rider lost easing off in
   * gusts or sitting up late, s, and the part to change for each; null if
   * it didn't happen. It costs time, not the promise (that's on CdA).
   */
  gusts: { lost: number; fix: FixTarget } | null
  fade: { lost: number; fix: FixTarget } | null
  /** The firm's reputation before and after this job. */
  reputation: { before: number; after: number }
}

/** The fee, less a slice per point short (Kelbo: at most half, after a small allowance). */
export function penaltyFor(fee: number, promised: number, achieved: number): { shortfall: number; penalty: number } {
  const shortfall = Math.max(0, promised - PROMISE.allowance - achieved)
  const share = Math.min(PROMISE.maxShare, shortfall * PROMISE.perPoint)
  return { shortfall, penalty: Math.round((fee * share) / 100) * 100 }
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
  /** Your tunnel's upkeep for the days up to race day, ₽ (0 before it's open). */
  upkeep: number
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
    // A gust turns the bike by its front: the front wheel is the part to change.
    gusts: result.lostToGusts > 0 ? { lost: result.lostToGusts, fix: 'front' } : null,
    fade: result.lostToFade > 0 ? { lost: result.lostToFade, fix: comfort(design).worst ?? 'torsoDeg' } : null,
    reputation: {
      before: reputationOf(state.history),
      after: reputationOf([...state.history, { promised: job.promise, achieved, predicted, actual: result.cdA }]),
    },
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
  const upkeep = upkeepFor(state, job.daysLeft)
  const next: CareerState = {
    ...state,
    money: state.money + paid - upkeep,
    day: raceDay,
    jobsDone,
    round: state.round + 1,
    board: boardFor(state.seed, state.round + 1, false, reputationOf([...state.history, record])),
    lost: [],
    job: null,
    history: [...state.history, record],
  }
  return { state: next, job, event, result, debrief, paid, upkeep }
}
