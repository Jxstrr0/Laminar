/**
 * Clients and their briefs (plan sections 4 and 9.1): who wants what, the
 * event they're riding, their current setup, the fee range and the days to
 * the event. The brief board draws from this pool with the career's seed.
 * Every name here is fictional and listed in docs/NAMES.md.
 */
import type { CyclistDesign } from './cyclist'
import type { CourseSegment } from './field'

/** How a career starts, and how the brief board works. */
export const CAREER = {
  /** The firm's money on day one, ₽. */
  startMoney: 150000,
  /** Day 0 of the career (UTC). */
  start: { year: 2010, month: 3, day: 1 },
  /** Briefs on the board at a time. */
  boardSize: 3,
  /** Fees round to this many rubles. */
  feeRound: 1000,
}

/**
 * The promise (Kelbo, PR 5): a cut in the client's wind-averaged CdA from
 * their current setup, checked on race day against both setups ridden in
 * that day's air. Missing it costs a slice of the fee per point missed, at
 * most half; a small allowance covers the road's own spread.
 */
export const PROMISE = {
  /** Points of cut forgiven before any penalty (the field's spread). */
  allowance: 0.5,
  /** Share of the fee lost per point missed beyond the allowance. */
  perPoint: 0.08,
  /** The most of the fee a miss can cost. */
  maxShare: 0.5,
  /** A prediction this close (fraction of the real CdA) is a good read; twice this, fair. */
  goodRead: 0.02,
}

/**
 * Sealed bids (plan section 4, step 2): you name a price inside the brief's
 * fee range and a promised cut. The rival firms bid too (src/data/rivals.ts).
 * The client counts each promised point as worth a
 * share of the middle fee, the same share a missed point costs you, so an
 * over-promise wins jobs and the road takes it back.
 */
export const BID = {
  /** Share of the middle fee the client counts each promised point as worth (matches PROMISE.perPoint). */
  pointValue: 0.08,
  /** The promise moves in these steps, between these limits, %. */
  promiseStep: 0.5,
  promiseMin: 0.5,
  promiseMax: 30,
  /** The price moves in these steps, ₽. */
  priceStep: 1000,
  /** Days the firm waits for a fresh board when every brief on it has gone. */
  waitDays: 7,
}

/** The event a brief is for: the day's typical air, how much it varies, and the course. */
export interface EventTemplate {
  name: string
  /** Where it's held, for the brief card. */
  place: string
  /** Typical air temperature, °C, and altitude, m. */
  temperature: number
  altitude: number
  /** Typical wind, m/s. */
  windSpeed: number
  /** The speed the rider should hold, m/s (it weights the yaw curve and sets the Reynolds number). */
  riderSpeed: number
  /** Day-to-day spread (standard deviations): temperature °C, wind m/s, the rider's power as a fraction. */
  spread: { temperature: number; wind: number; power: number }
  course: readonly CourseSegment[]
  /** Ridden on the indoor track: still air, laps of TRACK.lap metres (plan section 8.3). */
  indoor?: true
}

export interface BriefTemplate {
  id: string
  client: string
  /** One line on who they are. */
  who: string
  /** What they want, in their words. */
  goal: string
  event: EventTemplate
  /** The rider's engine: power held for the event, W, and rider plus bike, kg. */
  rider: { power: number; mass: number }
  /** How they ride now: the design a new job starts from. */
  setup: CyclistDesign
  /** The fee they'll pay, ₽ (the board picks one in this range). */
  fee: { min: number; max: number }
  /** Days from taking the job to the event. */
  days: number
  /** The cut they're asking for, % of wind-averaged CdA from their current setup. */
  target: number
  /** The first job of every career (the tutorial, plan section 9.1). */
  tutorial?: true
  /** A small, low-fee brief: one is always on the board (plan section 9.8). */
  small?: true
  /** The reputation a firm needs before this client calls (0 if left out; src/data/reputation.ts). */
  minRep?: number
}

/**
 * The indoor track (plan section 8.3): a 250 m oval of two straights and two
 * banked bends, ridden anticlockwise. Each bend is laid as short straight
 * pieces, so the replay can draw it; the air is still, so the field model
 * doesn't mind the headings.
 */
export const TRACK = {
  lap: 250,
  /** Each straight's share of a lap. */
  straight: 0.2,
  /** Pieces per bend. */
  bendPieces: 8,
}

/** `km` of laps on the indoor track, starting at the head of the home straight (heading east). */
const trackCourse = (km: number): CourseSegment[] => {
  const straight = TRACK.lap * TRACK.straight
  const piece = (TRACK.lap * (1 - 2 * TRACK.straight)) / 2 / TRACK.bendPieces
  const step = 180 / TRACK.bendPieces
  const lap: CourseSegment[] = []
  for (const start of [90, 270]) {
    lap.push({ length: straight, gradient: 0, heading: start })
    // Anticlockwise: the heading swings left through the bend.
    for (let k = 0; k < TRACK.bendPieces; k++) lap.push({ length: piece, gradient: 0, heading: (start - step * (k + 0.5) + 360) % 360 })
  }
  const laps = Math.round((km * 1000) / TRACK.lap)
  return Array.from({ length: laps }, () => lap).flat()
}

/** Bits of course shared by several briefs. */
const outAndBack = (km: number, heading: number): CourseSegment[] => [
  { length: (km * 1000) / 2, gradient: 0, heading },
  { length: (km * 1000) / 2, gradient: 0, heading: (heading + 180) % 360 },
]

const setup = (
  posture: CyclistDesign['posture'],
  parts: Partial<Omit<CyclistDesign, 'posture'>> = {},
): CyclistDesign => ({
  posture,
  helmet: { kind: 'road', tail: 0, vents: 0.8 },
  suit: { fabric: 'smooth', armTrips: false },
  bars: 'aero',
  wheels: { front: 'spoked', rear: 'spoked' },
  frame: 'round',
  ...parts,
})

export const BRIEFS: readonly BriefTemplate[] = [
  {
    id: 'selivan-regional',
    client: 'Marta Selivan',
    who: 'Club time-triallist from Stavren',
    goal: 'I want a faster position for the regional championship. I can hold my power; I just punch a big hole in the air.',
    event: {
      name: 'Stavren Regional Time Trial',
      place: 'River road, out and back',
      temperature: 16,
      altitude: 180,
      windSpeed: 3,
      riderSpeed: 11.3,
      spread: { temperature: 4, wind: 1.5, power: 0.02 },
      course: outAndBack(40, 20),
    },
    rider: { power: 250, mass: 70 },
    setup: setup({ torsoDeg: 30, headDrop: 0.2, armWidth: 0.4, handReach: 0.62, handHeight: 0.02 }),
    fee: { min: 90000, max: 130000 },
    days: 21,
    target: 10,
    tutorial: true,
  },
  {
    id: 'stavren-club',
    client: 'Stavren Road Club',
    who: 'A town cycling club, run by volunteers',
    goal: 'Our best junior is racing the club 16 km. Small budget, but we would love a few seconds.',
    event: {
      name: 'Club 16 km Time Trial',
      place: 'Airfield perimeter road',
      temperature: 14,
      altitude: 160,
      windSpeed: 4,
      riderSpeed: 10.8,
      spread: { temperature: 4, wind: 2, power: 0.03 },
      course: outAndBack(16, 90),
    },
    rider: { power: 230, mass: 66 },
    setup: setup({ torsoDeg: 34, headDrop: 0.15, armWidth: 0.42, handReach: 0.6, handHeight: 0.04 }),
    fee: { min: 35000, max: 50000 },
    days: 10,
    target: 10,
    small: true,
  },
  {
    id: 'brusnik-hill',
    client: 'Oleg Brusnik',
    who: 'Veteran climber, two-time hill champion',
    goal: 'The hill time trial is half climbing, half flying down the other side. Find me time without making me slower uphill.',
    event: {
      name: 'Lake Dolgo Hill Time Trial',
      place: 'Lake Dolgo loop, over the ridge',
      temperature: 12,
      altitude: 620,
      windSpeed: 2,
      riderSpeed: 10.5,
      spread: { temperature: 3, wind: 1, power: 0.02 },
      course: [
        { length: 6000, gradient: 0.035, heading: 40 },
        { length: 6000, gradient: -0.035, heading: 140 },
        { length: 12000, gradient: 0, heading: 260 },
      ],
    },
    rider: { power: 290, mass: 72 },
    setup: setup({ torsoDeg: 26, headDrop: 0.3, armWidth: 0.36, handReach: 0.66, handHeight: 0 }, { helmet: { kind: 'aero', tail: 0.2, vents: 0.3 } }),
    fee: { min: 70000, max: 100000 },
    days: 14,
    target: 7,
  },
  {
    id: 'korolets-coast',
    client: 'Yana Korolets',
    who: 'National team hopeful, strong in the wind',
    goal: 'The coast road is all crosswind. I need a setup that is fast at an angle and that I can still steer.',
    event: {
      name: 'Kosa Coast Time Trial',
      place: 'Kosa spit, along the sea wall',
      temperature: 15,
      altitude: 5,
      windSpeed: 6,
      riderSpeed: 12.3,
      spread: { temperature: 3, wind: 2, power: 0.02 },
      course: outAndBack(30, 0),
    },
    rider: { power: 300, mass: 64 },
    setup: setup({ torsoDeg: 20, headDrop: 0.4, armWidth: 0.32, handReach: 0.7, handHeight: 0 }, { helmet: { kind: 'aero', tail: 0.4, vents: 0.1 }, wheels: { front: 'deep', rear: 'deep' } }),
    fee: { min: 120000, max: 170000 },
    days: 24,
    minRep: 25,
    target: 3,
  },
  {
    id: 'tvardov-national',
    client: 'Ruslan Tvardov',
    who: 'Defending national time-trial champion',
    goal: 'Last year I won by four seconds. This year the others have been in tunnels too. Keep me ahead.',
    event: {
      name: 'National Time Trial Championship',
      place: 'Rolling farm roads east of Stavren',
      temperature: 22,
      altitude: 240,
      windSpeed: 3,
      riderSpeed: 13.2,
      spread: { temperature: 4, wind: 1.5, power: 0.015 },
      course: [
        { length: 12000, gradient: 0.01, heading: 70 },
        { length: 12000, gradient: -0.01, heading: 110 },
        { length: 12000, gradient: 0.01, heading: 290 },
        { length: 12000, gradient: -0.01, heading: 250 },
      ],
    },
    rider: { power: 360, mass: 76 },
    setup: setup(
      { torsoDeg: 16, headDrop: 0.45, armWidth: 0.3, handReach: 0.72, handHeight: 0 },
      { helmet: { kind: 'aero', tail: 0.5, vents: 0.1 }, wheels: { front: 'deep', rear: 'disc' } },
    ),
    fee: { min: 160000, max: 220000 },
    days: 28,
    minRep: 45,
    target: 2,
  },
  {
    id: 'vesnina-pursuit',
    client: 'Alina Vesnina',
    who: 'Track pursuiter, national team',
    goal: 'Four kilometres on the boards, no wind, nowhere to hide. Every bit of drag you take away is time I keep.',
    event: {
      name: 'Track Championships: Individual Pursuit',
      place: 'Stavren Velodrome (indoors)',
      temperature: 26,
      altitude: 180,
      windSpeed: 0,
      riderSpeed: 14.5,
      spread: { temperature: 1, wind: 0, power: 0.02 },
      course: trackCourse(4),
      indoor: true,
    },
    rider: { power: 420, mass: 68 },
    setup: setup(
      { torsoDeg: 22, headDrop: 0.3, armWidth: 0.36, handReach: 0.66, handHeight: 0.02 },
      { helmet: { kind: 'aero', tail: 0.2, vents: 0.3 }, wheels: { front: 'deep', rear: 'disc' } },
    ),
    fee: { min: 110000, max: 150000 },
    days: 18,
    minRep: 35,
    target: 5,
  },
]
