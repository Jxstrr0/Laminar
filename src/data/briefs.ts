/**
 * Clients and their briefs (plan sections 4 and 9.1): who wants what, the
 * event they're riding, their current setup, the fee range and the days to
 * the event. The brief board draws from this pool with the career's seed.
 * Every name here is fictional and listed in docs/NAMES.md.
 */
import type { BobsledDesign, Crew } from './bobsled'
import type { CyclistDesign } from './cyclist'
import type { HillId } from './hills'
import type { JumperDesign } from './jumper'
import type { SkaterDesign } from './skater'
import type { Design } from './sport'
import type { CourseSegment } from './field'
import type { Track } from './tracks'
import type { Route } from './routes'
import { FLEET_TRUCK, type TruckDesign } from './truck'
import { STOCK_CAR, type CarClass, type CarDesign } from './car'
import type { Circuit } from './circuits'
import { STOCK_RECORD, type RecordDesign } from './record'
import type { SaltFlat } from './saltFlats'

/** How a career starts, and how the brief board works. */
export const CAREER = {
  /** The firm's money on day one, ₽. */
  startMoney: 150000,
  /** Day 0 of the career (UTC). */
  start: { year: 2010, month: 3, day: 1 },
  /** The career's last day: 1 January 2040, as a career day. It closes after the first job or wait that reaches it. */
  endDay: 10898,
  /** Ready-made firm names (one is picked by the career's seed); the player can keep it or type their own. */
  firmNames: ['Potok Aero', 'Strela Aero Works', 'Krilo Aerodynamics', 'Tikha Wind Lab', 'Svetla Aero'],
  /** Longest firm name, in characters. */
  firmNameMax: 28,
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
  /** Raced indoors: still air, laps of `lap` metres (TRACK.lap if left out; plan section 8.3). */
  indoor?: true
  lap?: number
  /** Raced on ice (the replay draws an ice surface). */
  ice?: true
  /**
   * A ski jump (PR 8g): the hill, the jumper's mass with kit, kg, and the
   * day-to-day spread of the take-off speed, m/s. `windSpeed` is the typical
   * wind along the hill (positive: a headwind), `riderSpeed` the take-off speed.
   */
  jump?: { hill: HillId; mass: number; speedSpread: number }
  /**
   * A bobsled race (PR 8o): the track, the ice's typical temperature, °C,
   * how much faster (or slower) than the usual push this crew pushes, m/s,
   * and the day-to-day spread of both. `temperature` is the air,
   * `windSpeed` the typical wind up the track (a headwind) and `riderSpeed`
   * the sled's usual speed.
   */
  sled?: { track: Track['id']; iceTemp: number; push: number; spread: { ice: number; push: number } }
  /**
   * A truck fleet's fuel trial (PR 9e): the route its trucks run. The air and
   * wind are the route's own usual day (`temperature`, `windSpeed` and
   * `riderSpeed`, the speed limit, copy it for the brief card), and `spread`
   * says how far the trial day strays from it. `gravel` marks a fleet whose
   * yard is gravel (PR 9g): skirts lower than GRAVEL_YARD allows crack there.
   */
  truck?: { route: Route['id']; gravel?: boolean }
  /**
   * A race weekend (PR 9m): the circuit the team races at. `temperature`
   * and `altitude` copy the circuit's usual day for the brief card, and
   * `spread.temperature` says how far race day's air strays from it.
   */
  car?: { circuit: Circuit['id'] }
  /**
   * A speed week on the salt (PR 9t): the flat the team runs on.
   * `temperature` and `altitude` copy the flat's usual day for the brief
   * card; the record day's air comes from the flat's own spread.
   */
  record?: { flat: SaltFlat['id'] }
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
  setup: Design
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

/**
 * Ski-jump jobs (PR 8g): the promise is metres gained on the reference jump
 * (plan section 9: the hill's own take-off speed, still air) over the
 * client's current setup, and it counts only above the pitch-stability floor.
 * The declared number is the reference jump's distance. A promised metre is
 * weighed like a promised point of cut, and missed the same way.
 *
 * The board offers them from PR 8i, when the board and debrief can show
 * them. The switch stays so a test can take them off again.
 */
export const JUMP_JOBS = {
  open: true,
}

/**
 * Bobsled jobs (PR 8o; Kelbo, 16 November 2026): the promise is time gained
 * on the reference run down the track (the usual push, good ice, still air)
 * over the client's old sled, and the declared number is that run's time.
 * One promised point is a tenth of a second, so a missed tenth costs what a
 * missed point of cut does; bids move in hundredths.
 *
 * Open since PR 8p put them on the board. The switch stays so a test (or a
 * later change) can close them.
 */
export const SLED_JOBS = {
  open: true,
  /** Seconds in one promised point. */
  pointSeconds: 0.1,
  /** A sled bid's promise moves in these points: a hundredth of a second. */
  promiseStep: 0.1,
}

/**
 * Truck jobs (PR 9e; Kelbo, 16 November 2026): the promise is the fuel saved
 * on the client's route, wind-averaged, against the fleet's current truck
 * (one point is one per cent of fuel), and the declared number is the new
 * truck's wind-averaged fuel figure, litres per 100 km.
 *
 * Open since PR 9f put them on the board. The switch stays so a test (or a
 * later change) can close them.
 */
export const TRUCK_JOBS = {
  open: true,
}

/**
 * Racing-car jobs (PR 9m; Kelbo, 16 November 2026): the promise is lap time
 * gained on the circuit's usual day over the team's current car, after the
 * scrutineers have passed it. One point is a tenth of a second, and bids
 * move a tenth at a time. The declared number is the new car's lap time.
 *
 * Open since PR 9n put them on the board. The switch stays so a test (or a
 * later change) can close them.
 */
export const CAR_JOBS = {
  open: true,
  /** Seconds in one promised point. */
  pointSeconds: 0.1,
  /** A car bid's promise moves in these points: a tenth of a second. */
  promiseStep: 1,
}

/**
 * Land-speed record jobs (PR 9t; Kelbo, 16 November 2026: "km/h on their
 * car"): the promise is km/h gained on the two-way mean on the salt's
 * still day over the team's current car. A car that pulls its chutes sets
 * no time and gains nothing. One point is 2 km/h, and bids move a point at
 * a time. The declared number is the new car's two-way mean.
 *
 * Open since PR 9u put them on the board. The switch stays so a test (or a
 * later change) can close them.
 */
export const RECORD_JOBS = {
  open: true,
  /** km/h in one promised point. */
  pointKmh: 2,
  /** A record bid's promise moves in these points: 2 km/h. */
  promiseStep: 1,
}

/** The indoor 400 m ice oval (PR 8b): longer straights than the velodrome, skated anticlockwise too. */
export const OVAL = {
  lap: 400,
  straight: 0.28,
  bendPieces: 8,
}

type Oval = { lap: number; straight: number; bendPieces: number }

/** `km` of laps of an oval, starting at the head of the home straight (heading east). */
const ovalCourse = (oval: Oval, km: number): CourseSegment[] => {
  const straight = oval.lap * oval.straight
  const piece = (oval.lap * (1 - 2 * oval.straight)) / 2 / oval.bendPieces
  const step = 180 / oval.bendPieces
  const lap: CourseSegment[] = []
  for (const start of [90, 270]) {
    lap.push({ length: straight, gradient: 0, heading: start })
    // Anticlockwise: the heading swings left through the bend.
    for (let k = 0; k < oval.bendPieces; k++) lap.push({ length: piece, gradient: 0, heading: (start - step * (k + 0.5) + 360) % 360 })
  }
  const laps = Math.round((km * 1000) / oval.lap)
  return Array.from({ length: laps }, () => lap).flat()
}

/**
 * The Lake Dolgo ice marathon's loop (PR 8b): a ploughed lap on the frozen
 * lake, each side facing the wind a different way.
 */
const LAKE_LOOP = { sides: [20, 110, 200, 290], side: 1250 }

const lakeCourse = (km: number): CourseSegment[] => {
  const loop = LAKE_LOOP.sides.map((heading) => ({ length: LAKE_LOOP.side, gradient: 0, heading }))
  const laps = Math.round((km * 1000) / (LAKE_LOOP.side * LAKE_LOOP.sides.length))
  return Array.from({ length: laps }, () => loop).flat()
}

/** Bits of course shared by several briefs. */
const outAndBack = (km: number, heading: number): CourseSegment[] => [
  { length: (km * 1000) / 2, gradient: 0, heading },
  { length: (km * 1000) / 2, gradient: 0, heading: (heading + 180) % 360 },
]

const skater = (posture: SkaterDesign['posture'], parts: Partial<Omit<SkaterDesign, 'posture' | 'sport'>> = {}): SkaterDesign => ({
  sport: 'skating',
  posture,
  arms: 'back',
  hood: 'cap',
  suit: { fabric: 'smooth', legTrips: false },
  ...parts,
})

/** A fleet's current truck: FLEET_TRUCK with the changes they've already made. */
const truck = (trailerTop: number, cab: Partial<TruckDesign['cab']> = {}, gap: Partial<TruckDesign['gap']> = {}, trailer: Partial<TruckDesign['trailer']> = {}): TruckDesign => ({
  sport: 'truck',
  trailerTop,
  cab: { ...FLEET_TRUCK.cab, ...cab },
  gap: { ...FLEET_TRUCK.gap, ...gap },
  trailer: { ...FLEET_TRUCK.trailer, ...trailer },
})

const sled = (crew: Crew, nose: number, tail: number, cowl: number, tuck: number): BobsledDesign => ({
  sport: 'bobsled',
  crew,
  sled: { nose, tail, cowl },
  tuck,
})

const car = (cls: CarClass, change: Partial<Omit<CarDesign, 'sport' | 'class'>> = {}): CarDesign => ({ ...STOCK_CAR[cls], ...change })

const streamliner = (change: Partial<Omit<RecordDesign, 'sport' | 'class'>> = {}): RecordDesign => ({ ...STOCK_RECORD.streamliner, ...change })
const jetCar = (change: Partial<Omit<RecordDesign, 'sport' | 'class'>> = {}): RecordDesign => ({ ...STOCK_RECORD.jet, ...change })

const jumper = (leanDeg: number, vAngleDeg: number, bagginess: number): JumperDesign => ({
  sport: 'skijump',
  posture: { leanDeg, vAngleDeg },
  suit: { bagginess },
})

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
      course: ovalCourse(TRACK, 4),
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
  {
    id: 'lenok-oval',
    client: 'Sonya Lenok',
    who: 'Young distance skater, fast on the straights',
    goal: 'I fade in the 10 000. My coach says I stand up too tall and my cap is a parachute. Can you prove it?',
    event: {
      name: 'Stavren Open: 10 000 m',
      place: 'Stavren Ice Oval (indoors)',
      temperature: 12,
      altitude: 180,
      windSpeed: 0,
      riderSpeed: 11.4,
      spread: { temperature: 1, wind: 0, power: 0.02 },
      course: ovalCourse(OVAL, 10),
      indoor: true,
      lap: OVAL.lap,
      ice: true,
    },
    rider: { power: 210, mass: 62 },
    setup: skater({ trunkDeg: 32, kneeDeg: 130, headDrop: 0.15 }, { arms: 'swing' }),
    fee: { min: 50000, max: 75000 },
    days: 14,
    target: 8,
  },
  {
    id: 'kosov-marathon',
    client: 'Ilya Kosov',
    who: 'Marathon skater, races outdoors all winter',
    goal: 'Forty kilometres on the lake, and the wind changes every side of the loop. I want to sit lower and still last the distance.',
    event: {
      name: 'Lake Dolgo Ice Marathon',
      place: 'Lake Dolgo, a ploughed loop on the ice',
      temperature: -8,
      altitude: 620,
      windSpeed: 4,
      riderSpeed: 11.6,
      spread: { temperature: 4, wind: 2, power: 0.03 },
      course: lakeCourse(40),
      ice: true,
    },
    rider: { power: 240, mass: 74 },
    setup: skater({ trunkDeg: 26, kneeDeg: 122, headDrop: 0.25 }, { suit: { fabric: 'textured', legTrips: false } }),
    fee: { min: 70000, max: 100000 },
    days: 18,
    minRep: 10,
    target: 6,
  },
  {
    id: 'zorin-junior',
    client: 'Kirill Zorin',
    who: 'Junior ski jumper, strong off the table',
    goal: 'I jump well and then just sink. My coach says I fly like a plank with the skis too narrow. Find me some metres.',
    event: {
      name: 'Belogor Junior Cup',
      place: 'Belogor normal hill (HS 98)',
      temperature: -4,
      altitude: 640,
      windSpeed: 0.5,
      riderSpeed: 24.9,
      spread: { temperature: 3, wind: 1, power: 0 },
      course: [],
      jump: { hill: 'normal', mass: 61, speedSpread: 0.3 },
    },
    rider: { power: 0, mass: 61 },
    setup: jumper(18, 28, 0.2),
    fee: { min: 45000, max: 65000 },
    days: 16,
    minRep: 15,
    target: 6,
  },
  {
    id: 'vetrova-cup',
    client: 'Polina Vetrova',
    who: 'National-level jumper chasing her first podium',
    goal: 'My V is already wide. I want the last few metres without the wobble my old suit gave me.',
    event: {
      name: 'Belogor Winter Cup',
      place: 'Belogor normal hill (HS 98)',
      temperature: -7,
      altitude: 640,
      windSpeed: -0.3,
      riderSpeed: 24.9,
      spread: { temperature: 4, wind: 1.2, power: 0 },
      course: [],
      jump: { hill: 'normal', mass: 58, speedSpread: 0.3 },
    },
    rider: { power: 0, mass: 58 },
    setup: jumper(14, 36, 0.35),
    fee: { min: 80000, max: 110000 },
    days: 20,
    minRep: 30,
    target: 4,
  },
  {
    id: 'kuzmenko-large',
    client: 'Yaroslav Kuzmenko',
    who: 'Experienced jumper moving up to the large hill',
    goal: 'On the big hill my old suit gets me down safely and that is all. I want to be near the hill size, not at the bottom of the table.',
    event: {
      name: 'Tarnovian Large Hill Championship',
      place: 'Belogor large hill (HS 134)',
      temperature: -9,
      altitude: 640,
      windSpeed: 0.2,
      riderSpeed: 27,
      spread: { temperature: 4, wind: 1.3, power: 0 },
      course: [],
      jump: { hill: 'large', mass: 63, speedSpread: 0.35 },
    },
    rider: { power: 0, mass: 63 },
    setup: jumper(14, 32, 0.35),
    fee: { min: 140000, max: 180000 },
    days: 22,
    minRep: 45,
    target: 8,
  },
  {
    id: 'kostrov-club',
    client: 'Danil Kostrov',
    who: 'Club bobsled driver on a borrowed old sled',
    goal: 'The sled is older than my brakeman. We push well and then lose it all down the track. Find us some tenths.',
    event: {
      name: 'Belogor Club Cup: two-man',
      place: 'Belogor sliding track',
      temperature: -4,
      altitude: 1050,
      windSpeed: 0.5,
      riderSpeed: 30,
      spread: { temperature: 3, wind: 1, power: 0 },
      course: [],
      ice: true,
      sled: { track: 'belogor', iceTemp: -6, push: -0.2, spread: { ice: 2, push: 0.15 } },
    },
    rider: { power: 0, mass: 220 },
    setup: sled(2, 0.4, 0.15, 0.46, 0.2),
    fee: { min: 50000, max: 70000 },
    days: 14,
    minRep: 15,
    target: 12,
  },
  {
    id: 'kedrova-two',
    client: 'Vera Kedrova',
    who: 'National two-man pilot with a quick start',
    goal: 'We win the push and lose the bottom half. Our sled is decent, not fast. I want it fast without losing my view of the curves.',
    event: {
      name: 'Tarnovian Two-man Championship',
      place: 'Belogor sliding track',
      temperature: -7,
      altitude: 1050,
      windSpeed: 0.3,
      riderSpeed: 30,
      spread: { temperature: 4, wind: 1, power: 0 },
      course: [],
      ice: true,
      sled: { track: 'belogor', iceTemp: -8, push: 0.2, spread: { ice: 2, push: 0.12 } },
    },
    rider: { power: 0, mass: 220 },
    setup: sled(2, 0.5, 0.25, 0.5, 0.4),
    fee: { min: 90000, max: 120000 },
    days: 18,
    minRep: 30,
    target: 6,
  },
  {
    id: 'gromov-four',
    client: 'Matvei Gromov',
    who: 'Four-man pilot with a heavy crew and big ambitions',
    goal: 'Four big pushers and a sled built for comfort. I want a sled that goes as hard as they push.',
    event: {
      name: 'Tarnovian Four-man Championship',
      place: 'Belogor sliding track',
      temperature: -8,
      altitude: 1050,
      windSpeed: 0.4,
      riderSpeed: 31,
      spread: { temperature: 4, wind: 1.2, power: 0 },
      course: [],
      ice: true,
      sled: { track: 'belogor', iceTemp: -8, push: 0.1, spread: { ice: 2, push: 0.12 } },
    },
    rider: { power: 0, mass: 420 },
    setup: sled(4, 0.5, 0.25, 0.5, 0.4),
    fee: { min: 150000, max: 190000 },
    days: 22,
    minRep: 45,
    target: 6,
  },
  {
    id: 'kovyl-haulage',
    client: 'Lukyan Pyzhov',
    who: 'Owner of Kovyl Haulage, six trucks on the Mostograd run',
    goal: 'Diesel eats everything we earn. My trucks are bricks on wheels. Tell me what to bolt on and how much it will save.',
    event: {
      name: 'Kovyl Haulage fuel trial',
      place: 'Kovyl’s yard in Stavren',
      temperature: 12,
      altitude: 250,
      windSpeed: 5,
      riderSpeed: 25,
      spread: { temperature: 5, wind: 2, power: 0 },
      course: [],
      truck: { route: 'stavren-mostograd' },
    },
    rider: { power: 0, mass: 0 },
    setup: truck(4),
    fee: { min: 40000, max: 60000 },
    days: 16,
    minRep: 5,
    target: 12,
  },
  {
    id: 'volok-freight',
    client: 'Tamara Ilchuk',
    who: 'Fleet manager at Volok Freight, forty trucks across the plain',
    goal: 'We bought roof fairings years ago and saw nothing. Either they were wrong or we were. Find out, and find us more.',
    event: {
      name: 'Volok Freight fuel trial',
      place: 'Volok’s depot on the Stavren ring road',
      temperature: 12,
      altitude: 250,
      windSpeed: 5,
      riderSpeed: 25,
      spread: { temperature: 5, wind: 2, power: 0 },
      course: [],
      truck: { route: 'stavren-mostograd' },
    },
    rider: { power: 0, mass: 0 },
    setup: truck(4, { nose: 0.15, fairing: 0.6 }, { length: 1 }),
    fee: { min: 90000, max: 120000 },
    days: 20,
    minRep: 20,
    target: 10,
  },
  {
    id: 'prichal-coast',
    client: 'Stepan Brovar',
    who: 'Runs Prichal Logistics out of the Kosa port',
    goal: 'The coast road is wind from the sea all day, side-on. Our tall boxes catch it like sails. I want the fuel bill down where the wind is.',
    event: {
      name: 'Prichal Logistics fuel trial',
      place: 'Prichal’s shingle yard on the Kosa spit',
      temperature: 14,
      altitude: 5,
      windSpeed: 8,
      riderSpeed: 25,
      spread: { temperature: 4, wind: 2.5, power: 0 },
      course: [],
      truck: { route: 'kosa-coast', gravel: true },
    },
    rider: { power: 0, mass: 0 },
    setup: truck(4.1, { nose: 0.2, fairing: 1.1, extenders: 0.3 }, { length: 1 }),
    fee: { min: 130000, max: 170000 },
    days: 24,
    minRep: 35,
    target: 16,
  },
  {
    id: 'belan-sport',
    client: 'Taras Belan',
    who: 'Runs Belan Sport, a one-car touring team on a shoestring',
    goal: 'Stavren Park is all slow corners. I can’t buy a bigger engine. Find me some grip that doesn’t cost a fortune.',
    event: {
      name: 'Tarnovian Touring Car Championship: Stavren Park',
      place: 'Stavren Park',
      temperature: 16,
      altitude: 240,
      windSpeed: 0,
      riderSpeed: 30,
      spread: { temperature: 5, wind: 0, power: 0 },
      course: [],
      car: { circuit: 'stavren-park' },
    },
    rider: { power: 0, mass: 0 },
    setup: car('touring'),
    fee: { min: 60000, max: 90000 },
    days: 20,
    minRep: 15,
    target: 3,
  },
  {
    id: 'granit-touring',
    client: 'Zoya Rudneva',
    who: 'Team principal at Granit Motorsport, two touring cars',
    goal: 'Our drivers say the car pushes wide in every fast corner, and we lose a second a lap at the Dolgo Ring. Fix the front.',
    event: {
      name: 'Tarnovian Touring Car Championship: Dolgo Ring',
      place: 'The Dolgo Ring',
      temperature: 18,
      altitude: 180,
      windSpeed: 0,
      riderSpeed: 45,
      spread: { temperature: 6, wind: 0, power: 0 },
      course: [],
      car: { circuit: 'dolgo-ring' },
    },
    rider: { power: 0, mass: 0 },
    setup: car('touring', { frontWing: 4, rearWing: { angle: 12, chord: 0.26 } }),
    fee: { min: 120000, max: 160000 },
    days: 24,
    minRep: 30,
    target: 8,
  },
  {
    id: 'iskra-open',
    client: 'Gleb Mirny',
    who: 'Race engineer at Iskra Racing in the Tarnovian Open-wheel Series',
    goal: 'We dropped the car to find downforce and now it bounces on every straight. Get it low without the bouncing.',
    event: {
      name: 'Tarnovian Open-wheel Series: Stavren Park',
      place: 'Stavren Park',
      temperature: 16,
      altitude: 240,
      windSpeed: 0,
      riderSpeed: 35,
      spread: { temperature: 5, wind: 0, power: 0 },
      course: [],
      car: { circuit: 'stavren-park' },
    },
    rider: { power: 0, mass: 0 },
    setup: car('open', { ride: { front: 0.028, rear: 0.045 }, floorEdge: 0.6 }),
    fee: { min: 200000, max: 260000 },
    days: 28,
    minRep: 50,
    target: 14,
  },
  {
    id: 'kalina-streamliner',
    client: 'Bogdan Lisovoy',
    who: 'Built Kalina, a streamliner, in his barn, and drives it himself',
    goal: 'Kalina has the engine for the Tarnovian record but she’s shaped like a bread van. Make her slippery and keep her on the ground.',
    event: {
      name: 'Sukhoye Speed Week',
      place: 'Lake Sukhoye',
      temperature: 28,
      altitude: 420,
      windSpeed: 0,
      riderSpeed: 155,
      spread: { temperature: 4, wind: 0, power: 0 },
      course: [],
      record: { flat: 'sukhoye' },
    },
    rider: { power: 0, mass: 0 },
    setup: streamliner({ nose: { length: 1.2, droop: 1.5 }, canopy: 0.42, fin: 0.5, fairings: 0 }),
    fee: { min: 220000, max: 300000 },
    days: 30,
    minRep: 55,
    target: 14,
  },
  {
    id: 'zarya-streamliner',
    client: 'Vera Yarovaya',
    who: 'Engineer for the Zarya Land Speed Project, chasing the Tarnovian record',
    goal: 'We cut the canopy down to our driver’s helmet to save drag, and now she says she can’t see the line. Find us speed without blinding her.',
    event: {
      name: 'Sukhoye Speed Week',
      place: 'Lake Sukhoye',
      temperature: 28,
      altitude: 420,
      windSpeed: 0,
      riderSpeed: 165,
      spread: { temperature: 4, wind: 0, power: 0 },
      course: [],
      record: { flat: 'sukhoye' },
    },
    rider: { power: 0, mass: 0 },
    setup: streamliner({ nose: { length: 2.4, droop: 3 }, canopy: 0.18, fin: 1.1, fairings: 0.8 }),
    fee: { min: 320000, max: 420000 },
    days: 34,
    minRep: 70,
    target: 8,
  },
  {
    id: 'ognivo-jet',
    client: 'Tikhon Shatrov',
    who: 'Built Ognivo, a jet car, round an old fighter engine',
    goal: 'Ognivo has a fighter’s engine and the shape of a fuel tank. Make her slip through the air, and keep her pointing straight.',
    event: {
      name: 'Sukhoye Speed Week',
      place: 'Lake Sukhoye',
      temperature: 28,
      altitude: 420,
      windSpeed: 0,
      riderSpeed: 303,
      spread: { temperature: 4, wind: 0, power: 0 },
      course: [],
      record: { flat: 'sukhoye' },
    },
    rider: { power: 0, mass: 0 },
    setup: jetCar({ nose: { length: 2.6, droop: 2 }, canopy: 0.4, fin: 2.4, fairings: 0.3 }),
    fee: { min: 420000, max: 540000 },
    days: 36,
    minRep: 75,
    target: 30,
  },
  {
    id: 'proryv-jet',
    client: 'Raisa Belova',
    who: 'Lead engineer of the Proryv Project, out to take a car through the sound barrier',
    goal: 'Proryv is the fastest car in Tarnovia and still stops short of the sound barrier, where the air piles up in front of her. Take her through, both ways.',
    event: {
      name: 'Sukhoye Speed Week',
      place: 'Lake Sukhoye',
      temperature: 28,
      altitude: 420,
      windSpeed: 0,
      riderSpeed: 318,
      spread: { temperature: 4, wind: 0, power: 0 },
      course: [],
      record: { flat: 'sukhoye' },
    },
    rider: { power: 0, mass: 0 },
    setup: jetCar({ nose: { length: 3.2, droop: 2.5 }, canopy: 0.32, fin: 2.6, fairings: 0.7 }),
    fee: { min: 520000, max: 680000 },
    days: 40,
    minRep: 85,
    // 108 km/h on their car: a two-way mean just over the speed of sound on the salt's usual day.
    target: 54,
  },
]
