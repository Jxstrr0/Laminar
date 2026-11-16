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
  },
}
