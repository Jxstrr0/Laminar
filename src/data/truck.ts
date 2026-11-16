/**
 * The truck (plan sections 4.1, 5 and 9.6, PR 9a). A regional fleet's
 * tractor and box trailer: you bolt aero parts on to save fuel on their
 * route at highway speed. Kelbo chose (16 November 2026) a fictional
 * Tarnovian road code that caps the boat-tail's length and the skirts'
 * ground gap, shown on Shape like the cycling and bobsled rule boxes.
 *
 * - The cab: how round its front corners are (the base body's nose radius),
 *   the roof fairing's height over the cab roof, and side extenders that
 *   reach back into the gap.
 * - The gap between cab and trailer, and how much of it a gap filler closes.
 * - The trailer: skirts down its sides (how deep below the floor), and a
 *   boat-tail on its back doors (length, and the angle its panels fold in).
 *
 * Lengths and heights in metres above the road, masses kg, speeds m/s.
 */

export interface TruckDesign {
  sport: 'truck'
  /** The trailer's roof above the road, m: set by the client's fleet, not shaped. */
  trailerTop: number
  cab: {
    /** Radius of the cab's front corners, m. Rounder corners keep the air on. */
    nose: number
    /** The roof fairing's height over the cab roof, m (0: none). It should meet the trailer's roof. */
    fairing: number
    /** Side extenders reaching back from the cab into the gap, m. */
    extenders: number
  }
  gap: {
    /** Cab back to trailer front, m. Shorter is less churn, but the rig must still turn. */
    length: number
    /** Share of the gap a filler closes, 0 to 1. */
    fill: number
  }
  trailer: {
    /** How far the side skirts reach down below the trailer floor, m (0: none). */
    skirts: number
    /** The boat-tail's length behind the back doors, m (0: none). */
    tail: number
    /** How far its top and side panels fold in, degrees. */
    tailAngle: number
  }
}

export const TRUCK_RANGE = {
  nose: { min: 0.05, max: 0.45, step: 0.01 },
  fairing: { min: 0, max: 1.4, step: 0.05 },
  extenders: { min: 0, max: 0.8, step: 0.05 },
  gap: { min: 0.5, max: 1.4, step: 0.05 },
  fill: { min: 0, max: 1, step: 0.05 },
  skirts: { min: 0, max: 1.1, step: 0.05 },
  tail: { min: 0, max: 1.6, step: 0.05 },
  tailAngle: { min: 4, max: 24, step: 1 },
  /** Not a slider: the trailers fleets run, for checking saves. */
  trailerTop: { min: 3.6, max: 4.1, step: 0.05 },
} as const

/** A fleet's working truck as it comes: square corners, no fairing, a wide gap, nothing on the trailer. */
export const FLEET_TRUCK: TruckDesign = {
  sport: 'truck',
  trailerTop: 4,
  cab: { nose: 0.08, fairing: 0, extenders: 0 },
  gap: { length: 1.1, fill: 0 },
  trailer: { skirts: 0, tail: 0, tailAngle: 12 },
}

/** A good start: rounded corners, a matched fairing, extenders, a short gap, legal skirts and a legal boat-tail. */
export const DEFAULT_TRUCK: TruckDesign = {
  sport: 'truck',
  trailerTop: 4,
  cab: { nose: 0.3, fairing: 1, extenders: 0.5 },
  gap: { length: 0.8, fill: 0.3 },
  trailer: { skirts: 0.8, tail: 0.9, tailAngle: 12 },
}

/**
 * The fictional Tarnovian Road Code's limits on add-on parts (PR 9a): a
 * boat-tail may stick out this far past the doors, and skirts must leave
 * this much room above the road (for kerbs, ramps and level crossings).
 */
export const ROAD_CODE = {
  maxTail: 1.2,
  minSkirtGap: 0.25,
} as const

/** The parts of the rig the shaper doesn't change. */
export const RIG = {
  /** Cab front to its back wall, m. */
  cab: 2.4,
  /** The cab's roof above the road, m. */
  cabTop: 3,
  /** The box trailer's length and width, m. */
  trailer: 13.6,
  width: 2.55,
  /** The trailer floor above the road (skirts hang from it), m. */
  floor: 1.25,
  /** The bottom of the bodywork the drag model reads (bumper and chassis line), m. */
  bodyBottom: 0.45,
  /** Where the roof fairing starts on the cab roof, m from the front. */
  fairingFrom: 0.6,
  /**
   * The box the drag model reads always has this front rounding, m, so its
   * own sharp-corner rule stays out of it: the cab's real corners are the
   * `corner` terms in TRUCK_DRAG, which change smoothly with the nose radius.
   */
  bodyNose: 0.55,
  /** Paint on aluminium panels, m. */
  roughness: 0.00005,
  /** Tractor and empty trailer, kg, and a usual load, kg. */
  mass: 15000,
  payload: 22000,
} as const

/**
 * What the drag model's box can't see, as drag areas at full size (m²).
 * `sin10` scales the yaw rises: each rise is the extra at 10° of yaw.
 */
export const TRUCK_DRAG = {
  /**
   * The cab's front corners: the air trips over a sharp corner and leaves a
   * bubble down the cab's sides and roof. Per m² of cab face, square
   * corners cost `cornerCd`, falling as (1 − radius ÷ `cornerRound`)² to
   * nothing once the corners are that round.
   */
  cornerCd: 0.34,
  cornerRound: 0.5,
  /** The roof step: the trailer's front face showing over the fairing (or cab), per m² of it. */
  stepUnder: 0.35,
  /** A fairing standing over the trailer's roof, per m² sticking up. */
  stepOver: 0.3,
  /** The gap's churn per metre of gap, straight on. */
  gapPerMetre: 0.25,
  /** The most of that a full gap filler takes away. */
  gapFillCut: 0.8,
  /** The gap's churn at 10° yaw, as extra over straight on (×). Crosswind blows through an open gap. */
  gapYawRise: 3,
  /** Extenders as long as the gap take this share of that rise away. */
  extenderCut: 0.85,
  /** Wheels, axles, tanks and the trailer's underside. */
  under: 1.3,
  /** The share of that skirts can shield (the trailer's underside and bogie). */
  underShielded: 0.6,
  /** Full skirts take this much of the shielded part away straight on, and this much of its yaw rise. */
  skirtCut: 0.5,
  skirtYawCut: 0.8,
  /** The shielded part's extra at 10° yaw (×). */
  underYawRise: 1.5,
  /** Skirts reach full effect when their ground gap is down to this, m. */
  skirtFullGap: 0.15,
  /**
   * The boat-tail's panels pull back on the trailer as the air turns round
   * them: per m² of back the panels close, × (angle ÷ `panelRefDeg`)².
   * Too steep and they cost more than the smaller wake saves.
   */
  panelK: 0.1,
  panelRefDeg: 16,
  /** Mirrors and their arms. */
  mirrors: 0.12,
} as const

/** The add-on parts' weight and price at full size. */
export const TRUCK_PARTS = {
  /** Fairing kg per metre of height, extenders kg per metre (both sides), gap filler kg at full, skirts kg per metre of depth, boat-tail kg per metre. */
  massFairing: 45,
  massExtenders: 30,
  massFill: 40,
  massSkirts: 160,
  massTail: 70,
  /** What fitting each part costs the fleet, ₽ (shown on the sheet): per metre or at full, as the masses. */
  priceFairing: 80000,
  priceExtenders: 40000,
  priceFill: 50000,
  priceSkirts: 110000,
  priceTail: 120000,
} as const

/**
 * The fuel run (plan section 8.3, PR 9a): a loaded rig at a steady highway
 * speed, slowing only where a climb needs more power than the engine has.
 * Fuel is the work against the air, the tyres and the hills, through the
 * drivetrain and the engine's efficiency, plus what the accessories burn.
 */
export const FUEL = {
  /** Tyre rolling resistance coefficient. */
  rolling: 0.0055,
  /** Engine efficiency (fuel energy to work at the flywheel), and drivetrain efficiency to the wheels. */
  engine: 0.42,
  drivetrain: 0.93,
  /** Diesel's energy per litre, J. */
  diesel: 35.8e6,
  /** Engine power at the flywheel, W. */
  power: 330000,
  /** Accessories (fans, compressor, alternator), W at the flywheel, all the time. */
  accessories: 3000,
  /** The slowest a climb pulls the truck down to before it changes down and holds it, m/s. */
  crawl: 8,
  /** How many wind directions the wind-averaged fuel figure takes. */
  windSamples: 12,
} as const

/**
 * The desk's guess at a truck (PR 9b): the drag curve with a job-wide bias
 * and a small per-design jitter (fractions, standard deviations). The
 * client's current truck is known from their own fuel records, so only the
 * new design's figure is guessed.
 */
export const TRUCK_DESK = {
  bias: 0.06,
  jitter: 0.02,
}

/**
 * The truck in the tunnel (PR 9c). On the road the tarmac slides back under
 * the truck at its own speed; the tunnel's floor stands still and grows a
 * slow layer of air that the wheels and underside sit in, so the balance
 * misses some of their drag. The shop's ground board (as for a bobsled)
 * takes most of that error away; a rolling road comes with race cars.
 */
export const TRUCK_TUNNEL = {
  /** Share of the wheels' and underside's drag the still floor hides. */
  floorHidden: 0.55,
  /** Share of that error still left on a ground board. */
  boardLeft: 0.15,
  /** The parts' yaw-dependent drag is carried with the model at this step, degrees, out to `maxYaw`. */
  stepDeg: 2.5,
  maxYaw: 30,
} as const

/** The Shape sheet tints the fairing amber when its top misses the trailer's roof by more than this, m. */
export const FAIRING_MISS = 0.15

/** The truck's body is read at highway speed (and the model's Reynolds number matched to it), m/s. */
export const TRUCK_SPEED = 25
