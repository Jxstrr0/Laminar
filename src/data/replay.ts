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
}
