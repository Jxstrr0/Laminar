/**
 * The race-day replay (plan section 4, step 8): how long it plays, how the
 * road and the chase camera are laid out, and when the commentator speaks.
 * The riders' speeds all come from the field model; these numbers only set
 * how it is shown.
 */
export const REPLAY = {
  /** The whole race (to the slower rider's finish) plays in this many seconds; on the track, `trackSeconds`. */
  seconds: 22,
  trackSeconds: 30,
  /** Wind below this, m/s, is still air (indoors). */
  calm: 0.3,
  /** Wind within this many degrees of straight ahead is a headwind; past `tailDeg`, a tailwind. */
  headDeg: 45,
  tailDeg: 135,
  /** Turns sharper than this, degrees, get a line from the commentator. */
  turnDeg: 30,
  /** A turn this sharp makes the course an out-and-back, where the riders meet. */
  backDeg: 150,
  /** The race clock's sampling step when looking for the moment the two riders meet, s. */
  meetStep: 1,
  /** The gust line comes this far into the first stretch where the rider eased off (a share of it). */
  gustAt: 0.15,
}

/** The 3D road, the riders on it and the chase camera, m. */
export const REPLAY_SCENE = {
  roadWidth: 7,
  /** Distance right of the road's centre for your rider and for the old setup. */
  laneMine: 1.1,
  laneOld: 2.5,
  /** A centre-line dash every this many metres. */
  dashEvery: 12,
  /** A wind flag every this many metres, this far left of the centre. */
  flagEvery: 400,
  flagSide: -6,
  flagHeight: 3,
  /** The ground grid: cell size and how far it reaches. */
  gridCell: 25,
  gridSize: 2400,
  /** Fog closes in between these distances. */
  fogNear: 120,
  fogFar: 1500,
  /** Chase camera: behind, above and beside the rider, and the point it looks at ahead. */
  camera: { back: 6.5, up: 2.3, side: -1.8, ahead: 6, lookUp: 0.9, fov: 50 },
  /** How fast the camera catches up after a turn (per second). */
  cameraEase: 3,
  /** How see-through the old setup is drawn. */
  ghostOpacity: 0.35,
  /**
   * A truck's fuel run (PR 9h): a wider road with your truck in the right
   * lane and the fleet's old one in the left, flags spaced for a long
   * route, and the chase camera pulled back, up and over to the road's
   * middle, so both 17 m rigs fit a portrait screen.
   */
  truck: {
    roadWidth: 11,
    laneMine: 2.2,
    laneOld: -2.2,
    flagEvery: 1500,
    flagSide: -8,
    camera: { back: 34, up: 11, side: -2.2, ahead: 24, lookUp: 0, fov: 50 },
  },
  /**
   * A race lap (PR 9o): a circuit-wide road with your car on the right and
   * the team's old car on the left, no wind flags, and the chase camera
   * low behind your car.
   */
  car: {
    roadWidth: 12,
    laneMine: 2,
    laneOld: -2,
    flagEvery: 1e9,
    flagSide: -8,
    camera: { back: 11, up: 3.2, side: -1, ahead: 12, lookUp: 0.4, fov: 55 },
  },
  /** The indoor track: the boards' width, a fixed broadcast camera and the rider markers. */
  track: {
    width: 7,
    /** High over the west end of the oval, looking steeply down along it, so a portrait screen holds the whole lap. */
    camera: { back: 26, up: 108, ahead: 4, fov: 70 },
    /** Radius of the ring under each rider, m. */
    marker: 1.8,
    /** The camera above was framed for a lap this long, m; a longer oval lifts it in proportion. */
    framedLap: 250,
  },
  /**
   * Trouble on the road, drawn (PR 6d): a rider easing off in the gusts
   * rocks side to side now and then, and one who can't hold the position
   * sits up for the last third.
   */
  trouble: {
    /** Roll at the most a rider ever eases off, degrees (a rider just past their limit rocks `rollFloor` of that), and the sideways sway with it, m. */
    rollDeg: 10,
    rollFloor: 0.4,
    swayM: 0.3,
    /** A gust comes every `every` seconds of the replay and rocks the rider for `lasts` of them. */
    every: 1.8,
    lasts: 0.9,
    /** Sitting up: the back comes up to at least this angle, degrees, and the head comes up. */
    sitUpTorso: 34,
    /** A skater standing taller: the knees open to at least this angle, degrees. */
    standKnee: 140,
  },
}

/**
 * The jump replay (PR 8j): a side-on view of the hill, your jumper with the
 * old setup as a see-through twin beside it. Every position comes from the
 * day's flights; these numbers only set how they are shown.
 */
export const JUMP_REPLAY = {
  /** Take-off to the later landing, plus the hold, plays in this many seconds (slow motion: flights last 3 to 5 s). */
  seconds: 9,
  /** The picture holds on the landing this long, in flight seconds. */
  hold: 0.8,
  /**
   * A jump measured shorter than its flight (a wobbly landing, or the
   * bail-out at the hill size) is drawn coming down over this many metres
   * before the mark, so the skis touch where the distance was measured.
   */
  bend: 14,
  /** The commentator speaks once the jumper has settled this long after take-off, s. */
  settled: 1,
}

/** The jump replay's hill and camera, m. */
export const JUMP_SCENE = {
  /** Width of the landing slope, and the lanes: yours nearer the camera, the old setup beyond. */
  width: 24,
  laneMine: 2,
  laneOld: -2,
  /** The jumper's hips ride this far above the path, so the skis skim the snow on landing. */
  hipsUp: 0.35,
  /** The in-run behind the table: the table's length, then the steep run above it. */
  table: 7,
  inrun: { length: 50, deg: 35 },
  /** The snow runs this far below the slope's lowest point, so the hill reads as solid from the side. */
  base: 12,
  /** Fir trees along the far side (the near side would block the camera): one every this many metres, this far out from the edge. */
  treeEvery: 9,
  treeOut: 4,
  /**
   * A side-on camera off to the right of the hill, a little above and ahead
   * of the jumper. A portrait phone sees only about 6 m across at this
   * distance, so it looks barely ahead.
   */
  camera: { side: 13, up: 2.5, ahead: 0.8, fov: 50 },
  /** The old setup is a see-through slate twin, so it shows on the snow. */
  ghostOpacity: 0.45,
  /** Marks across the slope: thickness, m. */
  mark: 0.35,
  /**
   * The hill's buildings (PR 13l, art/skijump/build.py), all on the far side
   * of the slope, each this far out from its edge, m: the judges' tower
   * `beforeK` metres of slope above the K point (so the landing stays
   * clear), the coaches' stand `along` metres down the slope, a floodlight
   * mast every `every` metres of slope, the grandstand `fromEnd` metres back
   * from the outrun's end, and the fence just off the edge.
   */
  buildings: {
    judges: { beforeK: 20, out: 14 },
    coach: { along: 18, out: 6 },
    masts: { from: 10, every: 40, out: 16 },
    stand: { fromEnd: 25, out: 8 },
    fenceOut: 0.4,
    /** One fence panel's length, m (FencePanel in the model). */
    panel: 5,
  },
}

/**
 * The bobsled replay (PR 8q): the run down the track from behind, your sled
 * with the old one as a see-through ghost in the same ice channel. Every
 * position and speed comes from the day's runs; these numbers only set how
 * they are shown.
 */
export const SLED_REPLAY = {
  /** Start to the later finish, plus the hold, plays in this many seconds (runs last about 50 s, so this is fast-forward). */
  seconds: 20,
  /** The picture holds on the finish this long, in run seconds. */
  hold: 2,
  /** The track's centre line is worked out every this many metres. */
  step: 1,
  /** A sled rides up the curve wall no further than this, degrees, easing up and down over this many metres either side of a curve's ends. */
  maxBankDeg: 72,
  easeSpan: 8,
  /** Gravity for the ride up the wall, m/s². */
  gravity: 9.81,
}

/** The bobsled replay's ice channel, the snow beside it and the chase camera, m. */
export const SLED_SCENE = {
  /** The channel is a half pipe this wide in radius, its walls reaching this far round from the bottom, degrees. */
  trough: 1.7,
  wallDeg: 105,
  /** Snow banks on each side of the channel, this wide. */
  bank: 7,
  /** The channel is drawn every this many metres along. */
  drawEvery: 2,
  /** Fir trees beside the track: one every this many metres, this far out from the channel's centre. */
  treeEvery: 16,
  treeOut: 11,
  /**
   * Chase camera: this far behind your sled along the track and above it,
   * following `follow` of the way up the wall the sled rides. It looks at
   * the sled, moved `lead` of the way toward the track `ahead` metres on.
   */
  camera: { back: 8, up: 3, follow: 0.6, ahead: 8, lead: 0.3, lookUp: 0.5, fov: 55 },
  /** The old sled is a see-through slate ghost. */
  ghostOpacity: 0.4,
}

/**
 * The Belogor sliding track's buildings (PR 13p, art/bobsled/build.py):
 * Blender pieces the sled scene stands along the code-drawn channel, each
 * at a point on its centre line (metres from the start). Every clearance
 * from the channel is built into the pieces; these only say where.
 */
export const SLED_KIT = {
  /** A timing arch over the channel at each split, m from the start (on straights: a test checks). The start's arch is at the end of the push. */
  splits: [395, 670, 990],
  /** The sun roof over the long horseshoe: bays from here to here, one every `every` metres. */
  shade: { from: 524, to: 636, every: 8 },
  /** A spectator terrace on the outside of every curve, at its middle; trees and masts keep this far along from it, m. */
  terraceClear: 12,
  /** Floodlight masts, alternating sides, from here one every `every` metres. */
  masts: { from: 25, every: 45 },
  /** Trees stop this far before the finish line: the finish area has its own ground. */
  treesEndBefore: 70,
}

/**
 * The fuel-run replay (PR 9h): both trucks down the client's route on the
 * trial day, fast-forwarded. Every speed, yaw angle and litre comes from
 * the day's fuel runs; these numbers only set how they are shown.
 */
export const TRUCK_REPLAY = {
  /** The whole route (to the later truck's arrival) plays in this many seconds; a route takes about two hours. */
  seconds: 26,
  /** The stretch with the most yaw gets a crosswind line if the wind meets your truck at more than this, degrees. */
  crossDeg: 4,
  /** The first stretch where your truck drops this far below the limit, m/s, gets a climb line. */
  slowBy: 0.5,
  /** A line comes this far into its stretch (a share of it), so the picture has turned first. */
  noteAt: 0.08,
}

/**
 * The lap replay (PR 9o): both cars round the circuit on race day, side by
 * side, sped up. Every speed comes from the day's two laps; these numbers
 * only set how they are shown.
 */
export const CAR_REPLAY = {
  /** The lap (to the slower car's line) plays in this many seconds; a lap takes a minute or two. */
  seconds: 24,
  /** A straight is drawn in pieces no longer than this, m, so braking and pulling away show. */
  piece: 40,
  /** A corner is drawn in pieces turning no more than this, degrees. */
  cornerStep: 10,
  /** A line comes this far into its stretch (a share of it), so the picture has turned first. */
  noteAt: 0.15,
  /** A porpoising car bounces this high, m, this many times a second of the replay. */
  bounce: { height: 0.06, perSecond: 4 },
}

/**
 * The record-run replay (PR 9v): both runs on the salt, your car with the
 * team's old one as a see-through twin beside it. A run takes a minute or
 * more, most of it the run-up, so the run-up plays fast and the timed
 * kilometre slower. Every speed comes from record day's runs; these numbers
 * only set how they are shown.
 */
export const RECORD_REPLAY = {
  /** Run seconds per replay second: on the run-up, and from just before the timed kilometre (or the chutes) until your car stops. */
  fastRate: 10,
  slowRate: 2.5,
  /** The slower part starts this many run seconds before your car reaches the timed kilometre, or pulls its chutes. */
  lead: 1.5,
  /** Between the runs the picture holds this long, replay s, for the turn round. */
  turn: 2.2,
  /** Chutes out: the car slows at this rate, m/s², drawn in pieces this long, m, and is shown stopping once it's down to this speed, m/s. */
  chuteDecel: 20,
  stopPiece: 25,
  stopSpeed: 8,
  /** A light nose or a wander shows over this many metres before the chutes come out. */
  troubleSpan: 300,
}

/** The record replay's salt, lanes, chute and chase camera, m. */
export const RECORD_SCENE = {
  roadWidth: 16,
  laneMine: 2,
  laneOld: -2,
  /** A wind sock every this many metres along the left of the course. */
  flagEvery: 500,
  flagSide: -12,
  camera: { back: 26, up: 4.5, side: -0.5, ahead: 14, lookUp: 0.5, fov: 50 },
  /** The drogue chute rides this far behind the tail on its lines, this wide in radius: far enough back to show below the car in the chase camera. */
  chute: { line: 10, radius: 0.6 },
  /** The old car is a see-through slate twin, so it shows on the white salt. */
  ghostOpacity: 0.45,
  /** A light nose lifts up to this many degrees; a wander swings this many degrees and this far sideways, this often a second. */
  liftDeg: 4,
  wander: { deg: 1.5, side: 0.6, perSecond: 1.2 },
  /**
   * A jet car past Mach 1 trails its shock across the salt (PR 9z+): a V of
   * two lines from the nose, each this long and wide, m, this see-through,
   * opening at the Mach angle (sin = 1 ÷ M), capped at `maxDeg` so the V
   * reads as a V from the chase camera (the real one, nearly flat this
   * close to Mach 1, only narrows past 50° beyond Mach 1.3).
   */
  shock: { length: 40, width: 0.6, opacity: 0.55, maxDeg: 50 },
}

/**
 * The quad race replay (PR 10h): five laps of the club's gate course, your
 * quad with the pilot's old one as a see-through twin beside it. Every
 * speed and lean comes from race day's races; these only set how they show.
 */
export const DRONE_REPLAY = {
  /** Race seconds a replay second: a minute's race plays in under half a minute. */
  rate: 2.25,
  /** A tumble plays slower, from this many race seconds before it, at this rate, and holds this long once the quad is down before the replay ends. */
  slowLead: 0.6,
  slowRate: 0.5,
  hold: 1.2,
  /** The top-speed line waits at least this many race seconds after the start. */
  topFrom: 1.8,
  /** A straight is drawn in pieces no longer than this, m, and a corner in pieces turning no more than this, degrees. */
  piece: 10,
  cornerStep: 15,
  /** A quad that tumbles spins this many half-turns as it falls onto the grass, over this many race seconds. */
  tumble: { halfTurns: 3, seconds: 1.2 },
}

/** The meadow: a mown line through the grass, the gates, and a chase camera close behind a quad, m. */
export const DRONE_SCENE = {
  roadWidth: 3,
  /** Side by side, close: a portrait phone sees only a metre or two across this near a quad. */
  laneMine: 0.3,
  laneOld: -0.3,
  flagEvery: 1e9,
  flagSide: -3,
  /** The quads race this high over the grass. */
  flyHeight: 1.5,
  camera: { back: 3, up: 2, side: -0.3, ahead: 4, lookUp: 1.4, fov: 60 },
  /** The camera sinks with a falling quad, down to this high over the grass. */
  cameraLow: 0.7,
  /** Once it's down, the camera looks this share nearer and this much lower, m, so the quad on the grass is the picture. */
  fallLook: { ahead: 0.8, down: 0.6 },
  /** A square gate over the line at the start of each straight: its opening, round the flying height, and its frame's thickness. */
  gate: { width: 2.6, height: 1.4, bar: 0.08 },
  /** The old quad is a see-through twin; a quad this small needs it a touch more solid than a rider's. */
  ghostOpacity: 0.5,
}

/**
 * The survey-day highlights (PR 10o; Kelbo chose highlights in 3D, 16
 * November 2026). A survey flight runs most of two hours, so the replay
 * plays clips of it, cutting between them with a time-lapse line: the
 * launch and the first turn, the day's big gust on a turn, then each plane
 * gliding down when its battery reaches the reserve. Flight seconds a
 * replay second in each clip, and how much flight each clip shows round its
 * moment, s.
 */
export const SURVEY_REPLAY = {
  /** The launch: from the start, this much flight, at this rate. */
  launch: { seconds: 50, rate: 9 },
  /** The gust's turn: from this long before it to this long after, at this rate (slow, so the stall can be watched). */
  gust: { before: 6, after: 9, rate: 1.6 },
  /** A landing: from this long before touchdown to this long after, at this rate. */
  land: { before: 9, after: 3, rate: 3 },
  /** A turn is drawn in pieces turning no more than this, degrees. */
  turnStep: 15,
  /** The bank rolls in and out over this many metres at each end of a turn. */
  rollIn: 18,
  /** A stalled plane spins this many turns as it falls into the crop, over this many flight seconds, its nose this far down, degrees. */
  spin: { turns: 1.5, seconds: 4, noseDeg: 55 },
  /** A plane at its reserve glides down over this many flight seconds before it touches the stubble. */
  glide: 9,
  /** The replay holds this long on the last clip's end, replay seconds. */
  hold: 1.2,
}

/** The survey fields from a chase camera behind your plane, m. */
export const SURVEY_SCENE = {
  /** The planes fly their lines this high over the crop. */
  flyHeight: 40,
  /** Side by side in close formation, so a portrait phone sees both: yours right of the line, theirs left of it. */
  laneMine: 1.3,
  laneOld: -1.7,
  /** The chase camera: behind, above and to the side of your plane (between the two), and how far ahead and how far below it it looks. */
  camera: { back: 11, up: 2.2, side: -1.5, ahead: 14, below: 1.5, fov: 55 },
  /** The camera never sinks below this height, following a plane down into the crop. */
  cameraLow: 4,
  /** The crop's rows run this far apart (the ground grid). */
  rows: 8,
  ghostOpacity: 0.45,
}

/**
 * The light aircraft's test day (PR 10v; Kelbo chose speed runs and the
 * stall check, 16 November 2026). Speeds in km/h, times in flight seconds.
 */
export const AIRCRAFT_REPLAY = {
  /**
   * The inspector's check: from this airspeed, slowing this many km/h a
   * second until the wing lets go, played this many times faster than life.
   * The plane stalls over this point along the runway, m.
   */
  check: { from: 130, slow: 2, rate: 3, over: 500 },
  /** The break: over this many seconds the nose drops this far below level and a wing this far, degrees, losing this much height, m; played at this rate. */
  stallBreak: { seconds: 4, noseDeg: 14, wingDeg: 18, drop: 14, rate: 1 },
  /** Recovered, the plane gains this much airspeed a second, km/h. */
  regain: 6,
  /** Not signed off: the plane parked by the runway's start for this long, s, this far along it and this far off it, m. */
  parked: { seconds: 4, at: -60, off: 24 },
  /**
   * The timed passes over the measured course, m: both planes start abreast
   * this far before its first marker and fly on this far past the second,
   * played at this rate.
   */
  pass: { course: 1000, runIn: 160, runOut: 140, rate: 1 },
  /** A pause, s, between the check and the passes (a cut: never played). */
  gap: 30,
  /** The replay holds this long on the last moment, replay seconds. */
  hold: 1.2,
}

/** Belyanka airfield from a camera flying alongside your plane, m. */
export const AIRFIELD_SCENE = {
  /** The inspector's check is flown this high; the timed passes this low over the runway. */
  checkHeight: 70,
  passHeight: 14,
  /** Abreast on the passes, a wingspan and a bit apart: yours right of the runway's line, theirs left of it. */
  laneMine: 5.5,
  laneOld: -5.5,
  /** The runway: from and to along x, and its width; its centre-line dashes. */
  runway: { from: -700, to: 1700, width: 20 },
  /** A timing mast each side of the runway at each marker: its height, and the board on top (width, height). */
  mast: { height: 9, board: 3, boardHeight: 1.6, out: 18 },
  /**
   * The cameras, both on a portrait phone's narrow view: through the check
   * (your plane alone), side-on from its right, this far out, ahead and up,
   * so the nose can be watched; on the passes, a camera plane this far ahead
   * of yours on the runway's centre line, this far up, looking back at a
   * point this far behind it, so both planes are in the picture as theirs
   * drops back.
   */
  camera: { side: { out: 26, ahead: 1, up: 1.5 }, front: { ahead: 46, up: 3, lookBack: 10 }, fov: 55 },
  /** The camera never sinks below this height. */
  cameraLow: 3,
  ghostOpacity: 0.45,
}

/**
 * The sensor pod's range day (PR 10af; Kelbo chose the sensor's-eye view,
 * 16 November 2026): the pod's picture of the Stepnoy steppe, steady or
 * shaking and blurred, beside both pods' clocks on station. Every number
 * comes from range day's two patrols; these only set how it is shown.
 */
export const POD_REPLAY = {
  /** The longer patrol's clock fills in this many seconds; the shorter one's stops in proportion. */
  clockSeconds: 12,
  /** The ministry calls a blurred picture this many seconds in, and the run stops there. */
  rejectAt: 5,
  /** The buffet is read out this many seconds in. */
  buffetAt: 2.5,
  /** The picture shakes this many pixels per unit of buffet index. */
  shakePerBuffet: 5,
  /** Past the limit it blurs: this many pixels, plus this many per unit of buffet over the limit. */
  blurBase: 2.5,
  blurPerBuffet: 6,
  /** The steppe slides under the sensor at this many pixels a second. */
  drift: 18,
  /** The fields, roads and farmsteads on the picture, laid out from the job's seed. */
  fields: 26,
  roads: 4,
  farms: 9,
}

/**
 * The circuit's trackside (PR 13m, art/circuit/build.py): Blender pieces the
 * race-lap replay stands along whichever lap is raced. Distances are metres
 * along the lap from the start line, and out from the road's centre line
 * (left or right as you drive).
 */
export const CIRCUIT_KIT = {
  /** The pit building on the left of the main straight, from `from` metres for its 150 m; its front stands `out` from the centre (its pit wall 8 m nearer). */
  pits: { from: 30, length: 150, out: 16 },
  /** The main grandstand on the right, from `from` metres for its 100 m, its front `out` from the centre. */
  stand: { from: 40, out: 18 },
  /** The footbridge over the main straight, this far from the line. */
  bridgeAt: 400,
  /** Steel barriers both sides of the whole lap, this far out, one panel every `every` metres. */
  barrier: { out: 10, every: 4 },
  /** Kerbs along the inside of every corner, their middle this far out, one every `every` metres. */
  kerb: { out: 6.3, every: 2 },
  /** A marshals' post on the left every `every` metres, this far out. */
  marshal: { every: 600, out: 13 },
}

/**
 * The salt flat's camp and course furniture (PR 13n, art/saltflat/build.py):
 * Blender pieces the record replay stands along each run's course. Distances
 * are metres along the run from its start, and out from the course's black
 * line, right of it as the car runs (left if negative).
 */
export const SALT_KIT = {
  /** The team's camp beside the course a little way past the start, where the chase camera's narrow view finds it. */
  camp: { along: 150, out: -30 },
  /** The timekeepers' trailer just before the start of the timed kilometre. */
  hut: { before: 40, out: -16 },
  /** The timing lights' posts both sides of the course at each end of the timed kilometre. */
  posts: { out: 10 },
  /** A kilometre board every `every` metres on the left. */
  boards: { every: 1000, out: -14 },
  /** Orange posts along both edges of the 16 m course, one every `every` metres. */
  markers: { every: 100, out: 8.6 },
  /** Where people watch, level with the middle of the timed kilometre. */
  viewing: { out: -55 },
  /** The recovery truck, waiting on the right this far past the timed kilometre. */
  recovery: { afterTimed: 1500, out: 30 },
}

/**
 * Belyanka airfield's buildings and runway furniture (PR 13o,
 * art/airfield/build.py): Blender pieces the kit-plane replay stands round
 * the runway (AIRFIELD_SCENE.runway, along +x). Distances along the runway
 * are x, m; out is from its centre line, the field side on the left (−z),
 * away from the check's side-on camera.
 */
export const AIRFIELD_KIT = {
  /** The field side (apron, hangars, clubhouse, tower) from this far along, its apron's edge `out` from the centre line: behind the timed passes, where the passes' camera looks back. */
  buildings: { from: -350, out: 35 },
  /** Edge lights both sides of the runway, one every `every` metres, this far out. */
  lights: { every: 60, out: 11.5 },
  /** The windsock beside the measured course. */
  windsock: { at: 100, out: 30 },
}
