/**
 * The university's old low-speed tunnel.
 *
 * Every tuning number for the tunnel lives here, not in the code. Its hidden
 * quirks (blockage, turbulent air, the mount's own drag) are drawn from
 * UNIVERSITY_QUIRKS below; static wheels and legs come next.
 *
 * Axes in the test section: the air flows along +x, y is up, and the model's
 * centre sits on the turntable at the origin.
 */
export const UNIVERSITY_TUNNEL = {
  /** Test section, in metres: length along the flow, width, height. */
  section: { length: 8, width: 2.4, height: 1.8 },
  /** Fastest the fan can push the air, in m/s. */
  topSpeed: 40,
  /** How fast the fan can change speed, in m/s per second (it can't jump). */
  rampRate: 6,
  /** The fan slider moves in steps of this many m/s. */
  sliderStep: 0.5,
  /**
   * Turbulence intensity of perfectly calm air (a fraction). The real value
   * is a hidden quirk (UNIVERSITY_QUIRKS); this is what a reading uses with
   * no quirks given, as in the sim's own tests.
   */
  turbulence: 0,
  /**
   * The balance's scatter: each reading's forces wobble by this fraction
   * (standard deviation). Repeat runs and average to beat it.
   */
  balanceNoise: 0.01,
  /**
   * No wheel drive: the rider model's wheels sit still, so their spokes read
   * low (a quirk, plan section 7.2). The reference wheel shows by how much.
   */
  wheelDrive: false,
  /** No rolling road (PR 9k): a car model sits over the still floor, or the model shop's ground board. */
  rollingRoad: false,
  /** No PIV (PR 10ah): no laser sheet to show the air's speed round the model. */
  piv: false,
  /** The yaw turntable: range and steps in degrees, and how fast it turns (degrees per second). */
  turntable: { min: -20, max: 20, step: 1, rate: 6 },
  /**
   * The balance readout on screen settles over about this many seconds (an
   * exponential average), so the noise shows as a gentle wobble, not flicker.
   */
  displaySettle: 0.6,
  /** Below this air speed (m/s) the balance reads nothing worth showing. */
  readFrom: 1,
} as const

/**
 * What a run costs (plan section 7.1). Runs cost money, never days. Power is
 * billed by the energy the fan uses, and fan power grows with the cube of air
 * speed, so holding top speed is what costs. The university also charges a
 * small fee per run.
 */
export const TUNNEL_BILLING = {
  /** Fee per run, ₽. */
  perRun: 500,
  /** Power price, ₽ per kWh of fan energy (the university's research rate). */
  perKWh: 2000,
  /**
   * Fan power as a fraction of the air's kinetic power through the test
   * section (½ρAV³): circuit losses over fan efficiency. About 0.35 for an
   * old closed-return tunnel.
   */
  powerFactor: 0.35,
}

/** How runs are recorded (plan section 7.1): from fan-up to fan-down, every sample kept. */
export const RUN_RECORDING = {
  /** A run starts once the air passes this speed, m/s. */
  startAbove: 0.5,
  /** And ends when it has slowed back below this, m/s. */
  endBelow: 0.05,
  /** The balance is sampled this often, seconds of tunnel time. */
  sampleEvery: 0.25,
}

/**
 * The calibration sphere on the sting. Its drag comes from the aero model
 * (src/sim/aero/drag.ts), drag crisis included: at 25 cm it goes through the
 * crisis near 20 m/s, right in the middle of the fan's range.
 */
export const REFERENCE_SPHERE = {
  /** Diameter in metres. */
  diameter: 0.25,
} as const

/**
 * The lab's reference wheel: a plain spoked wheel with its spinning drag in
 * the book. Built at the model's scale and run on the posts with no rider,
 * held still like the model's wheels, it shows what still wheels miss.
 */
export const REFERENCE_WHEEL = {
  spokes: 32,
} as const

/**
 * Reading runs side by side (plan section 7.3). Readings taken at rest are
 * grouped by yaw; a group's noise band is ±z standard errors of its mean.
 * A change counts as real only when it is bigger than the combined band.
 */
export const RUN_STATS = {
  /** Standard errors either side of a mean: 2 is about 95 % confidence. */
  z: 2,
  /** Fewer settled readings than this at a yaw and the group isn't trusted. */
  minSamples: 4,
  /** Yaw angles closer than this (degrees) count as the same setting. */
  yawTolerance: 0.5,
  /** Air speeds closer than this (m/s) count as the same setting. */
  speedTolerance: 0.25,
  /**
   * Crank angles needed for a fair pedalling average. Spread evenly over a
   * half turn (say 0°, 45°, 90°, 135°), four cancel the legs' swing exactly.
   */
  legAngles: 4,
}

/** The crank dial on a rider model's legs, degrees (0 forward, 90 down). */
export const CRANK_DIAL = { min: 0, max: 165, step: 15 } as const

/**
 * The university tunnel's hidden quirks (plan section 7.2), drawn once per
 * career from these ranges. The player never sees the numbers: tare runs
 * and calibration runs with the sphere are how they find them out.
 */
export const UNIVERSITY_QUIRKS = {
  /**
   * Blockage: the air squeezes past the model, so readings come out high by
   * the factor (1 + k × model frontal area ÷ test-section area)². This is k.
   */
  blockage: { min: 0.8, max: 1.3 },
  /** Turbulence intensity of the test-section air (a fraction): an old tunnel with tired screens. */
  turbulence: { min: 0.008, max: 0.018 },
  /**
   * The mount's own drag area at model size, m², read along with the model:
   * the sphere's sting, and the two posts that clamp a rider model's axles.
   */
  mount: {
    sting: { min: 0.0025, max: 0.0035 },
    posts: { min: 0.003, max: 0.0045 },
  },
} as const

/**
 * The career seed for a save from before careers (v1), so the tunnel keeps
 * the quirks it had; the tests use it too. New careers pick their own.
 */
export const DEMO_TUNNEL_SEED = 2010

/**
 * Calibration with the sphere (plan section 7.2): compare its readings with
 * the book (a smooth sphere in calm air, from the aero model) to find the
 * drag crisis and the blockage.
 */
export const CALIBRATION = {
  /** The readings must span at least this much Cd to show a drag crisis. */
  minDrop: 0.12,
  /** Readings below this fraction of the crisis Reynolds number count as before the crisis. */
  subcritical: 0.7,
  /** Settled readings needed before the crisis to trust a blockage figure. */
  minSubReadings: 8,
  /** The book curve: air speeds from, to and step, m/s. */
  book: { from: 1, to: 40, step: 0.25 },
}

/**
 * Your own tunnel (plan section 9.2; Kelbo's calls of 16 November 2026): a
 * small closed-return tunnel, paid for in cash, built over about 90 days
 * while you keep renting the university's. Runs then cost power only, at an
 * industrial rate, and the tunnel's upkeep is paid every day that passes.
 */
export const OWN_TUNNEL_BUILD = {
  /** What it costs, ₽, all up front (no loans). */
  price: 2_000_000,
  /** Days from paying to the first run in it. */
  days: 90,
  /** Upkeep for every day it's open (rent on the building, the fan's service), ₽. */
  upkeepPerDay: 400,
}

/**
 * Your tunnel's test section and fan match the university's (the upgrades
 * that change them come next). It's new, so its air is calmer and its mount
 * is cleaner, and blockage is about the same: the section is the same size.
 */
export const OWN_QUIRKS = {
  blockage: { min: 0.8, max: 1.1 },
  turbulence: { min: 0.002, max: 0.005 },
  mount: {
    sting: { min: 0.0015, max: 0.0022 },
    posts: { min: 0.002, max: 0.003 },
  },
} as const

/** What a run costs in your own tunnel: no fee, and power at the industrial rate. */
export const OWN_BILLING = {
  perRun: 0,
  perKWh: 500,
}

/**
 * Upgrades for your own tunnel (plan section 9.2), the ones the cycling work
 * needs. Each is paid for in cash and fitted over some days while you keep
 * working; it takes effect the day it's done.
 */
export type UpgradeId = 'screens' | 'turntable' | 'wheelDrive' | 'fan' | 'rollingRoad' | 'piv' | 'cfd'

export const TUNNEL_UPGRADES = {
  /** Fine mesh screens before the contraction: the test-section air's turbulence falls to this share. */
  screens: { price: 180_000, days: 14, turbulenceShare: 0.4 },
  /** A bigger turntable: yaw sweeps out to ± this many degrees. */
  turntable: { price: 120_000, days: 10, yawRange: 30 },
  /** Motors that spin the model's wheels, so the spokes read true (no static-wheel correction needed). */
  wheelDrive: { price: 350_000, days: 21 },
  /** A bigger fan and motor: top speed, m/s, for a closer Reynolds match on small models. */
  fan: { price: 600_000, days: 30, topSpeed: 55 },
  /**
   * A belt under the model that runs at the air's speed, with the wheels
   * spinning on it (Kelbo, 16 November 2026, for PR 9): a car's floor and
   * wheels read true, as on the road.
   */
  rollingRoad: { price: 900_000, days: 30 },
  /**
   * PIV (Kelbo, 16 November 2026, for PR 10ag–10ah): a laser sheet and a
   * camera that track seeding in the air, showing its speed round the model,
   * how much the wake has lost, and which slider would cut it most.
   */
  piv: { price: 900_000, days: 21 },
  /**
   * The CFD Cluster (Kelbo, 17 November 2026, for PR 12b: a tunnel upgrade,
   * free to run): a coarse simulated tunnel on the phone's GPU, with a flow
   * slice and a second drag estimate. Needs a phone with WebGPU.
   */
  cfd: { price: 900_000, days: 21 },
} as const satisfies Record<UpgradeId, { price: number; days: number; [k: string]: number }>

/** The order they're shown in. */
export const UPGRADE_IDS: readonly UpgradeId[] = ['screens', 'turntable', 'wheelDrive', 'fan', 'rollingRoad', 'piv', 'cfd']
