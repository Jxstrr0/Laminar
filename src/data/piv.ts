/**
 * PIV, particle image velocimetry (PR 10ag, Kelbo 16 November 2026: "Wake
 * slice + hint", bought as an own-tunnel upgrade). A laser sheet lights
 * seeding in the air and a camera tracks it, so the player sees the air's
 * speed as a colour slice, gets a number for how much speed the wake has
 * lost, and is told the worst spot with a "Change this" jump.
 *
 * Every number the PIV sim reads lives here.
 */
export const PIV = {
  /** The side sheet (down the middle of the model): columns and rows of the grid. */
  sheet: { cols: 48, rows: 20 },
  /** The sheet reaches this many model lengths ahead of the nose and behind the tail. */
  sheetAhead: 0.15,
  sheetBehind: 0.9,
  /** The cross slice behind the model: columns and rows. */
  cross: { cols: 24, rows: 16 },
  /**
   * The cross slice sits this many of the model's frontal sizes (the bigger
   * of its height and width) behind the tail.
   */
  behind: 0.5,
  /** Both slices reach this share of the model's size past its edges. */
  margin: 0.25,
  /**
   * The wake's depth is fitted to the measured drag in this many steps, and
   * kept between these times the smoke's own (so a body the smoke draws
   * with no wake doesn't get an absurd one).
   */
  fitSteps: 4,
  depthMin: 0.1,
  depthMax: 6,
  /** The thin wake (skin friction's, behind the whole model) starts this many model lengths ahead of the tail. */
  thinRamp: 0.15,
  /** The PIV's drag reading scatters by this share (one standard deviation), repeatably per setting. */
  scatter: 0.03,
} as const

/**
 * The hint (which part to change). The PIV sees the wake, so it can only
 * say where drag is being lost. For each slider it tries small nudges, up
 * to this share of the slider's whole range either way, and names the one
 * whose nudge cuts the drag most. Nudges, not jumps to the end, so the
 * hint follows the design: a tail cone already near its finest stops
 * being named.
 */
export const PIV_HINT = {
  nudge: 0.15,
  /** Nudges tried each way within that reach. */
  tries: 3,
  /** A best nudge cutting less than this share of the drag isn't named: the wake is tidy. */
  minGain: 0.004,
  /** The air each sport's drag is taken in for the hint (only which nudge wins matters). */
  air: { density: 1.2, viscosity: 1.8e-5, turbulence: 0.005 },
  /** Speeds, m/s: a cyclist or skater, a sled, a car on a fast stretch, a kit plane at cruise. */
  speed: { body: 15, sled: 35, car: 50, aircraft: 55 },
  /** A truck's drag barely changes with the weather; any mild day does, °C. */
  truckTemperature: 15,
  /** A quad's tilt at racing speed, radians. */
  droneTilt: 0.5,
} as const

/**
 * How the PIV slice is drawn (PR 10ah). One hue, dark to pale, so speed
 * reads as lightness alone (colour-blind safe, and in greyscale): still air
 * is deep cobalt, air at the tunnel's speed nearly white. Faster than the
 * tunnel (round the shoulders) stays palest.
 */
export const PIV_PALETTE = {
  stops: ['#0B1B4D', '#1F45B8', '#5F86EE', '#AFC4F7', '#EEF2FC'],
  /** The speed share each stop sits at. */
  at: [0, 0.35, 0.65, 0.88, 1],
  /** Legend ticks, share of the tunnel's speed. */
  ticks: [0, 0.5, 1],
  /** The sheet's opacity over the lab. */
  opacity: 0.85,
  /**
   * Air at the tunnel's speed is drawn this opaque (times the sheet's), still
   * air fully: clean air fades back so the model shows through it and the
   * wake stands out.
   */
  clearAlpha: 0.25,
} as const
