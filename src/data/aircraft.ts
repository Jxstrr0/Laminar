/**
 * Light aircraft (plan sections 4.1, 6 and 9.6, PR 10p): speed mods on a
 * kit plane. The client flies a fixed two-seat kit plane, the Lastochka L-2
 * (a high wing on struts, fixed tricycle wheels, a 100 hp engine up front);
 * the firm shapes the add-ons, as real speed-mod shops do. Kelbo chose
 * (16 November 2026):
 * - The promise is **cruise speed**: km/h gained at cruise power on the
 *   client's airfield's usual day.
 * - The tunnel's trap is **no prop wash** (a later PR): the model goes in
 *   with its prop stopped, so the cowling, the nose wheel and the struts'
 *   roots sit in calm air. In flight the prop blasts them (the slipstream
 *   is faster than the plane) and twists the air round them (the swirl), so
 *   they drag more than the tunnel said, and a strut fairing lined up with
 *   the tunnel's straight air meets the swirl at an angle. A powered prop on
 *   the model catches it.
 * - In the field, **stall speed creeps up**: sharper wingtips and a pod
 *   slid forward under the wing lower the wing's most lift, and past the
 *   plane's certified stall speed the inspector won't sign the mod off. The
 *   client can't fly it. Nobody is hurt.
 *
 * What each mod does:
 * - Wheel spats close round the wheels: the bare wheels and legs are a big
 *   share of a kit plane's drag. Fuller spats save more, for a few kilos.
 * - The cowling: a tighter cowl, with smaller, shaped inlets, cuts the
 *   cooling drag and the bluff front.
 * - Wingtips: squarer, sharper tips push the tip vortex outward (less drag
 *   from making lift), but a sharp tip lets the stall start there sooner.
 * - Strut fairings turn the round tubes into a teardrop. Their toe, degrees,
 *   lines them up with the air: straight air in the tunnel, but the struts'
 *   roots sit in the prop's swirl in flight.
 * - The client's pod under the wing (a camera or baggage pod): fairing it
 *   cuts its drag; sliding it forward clears its wake off the wing (less
 *   interference drag), but ahead of the leading edge it upsets the wing's
 *   flow near the stall.
 *
 * The client's cruise speed is on paper (the club's flown figure for the
 * kit): the promise is judged against it.
 *
 * Lengths in metres, areas m², angles degrees, masses kg, powers W, speeds m/s.
 */

export type AircraftClass = 'kit'

export interface AircraftDesign {
  sport: 'aircraft'
  /** The client's kind of plane: set by the brief, not shaped. */
  class: AircraftClass
  /** Wheel spats: 0 (bare wheels) to 1 (full, close-fitting spats). */
  spats: number
  /** The cowling: 0 (the kit's loose cowl and big inlets) to 1 (tight, with small shaped inlets). */
  cowling: number
  /** Wingtips: 0 (the kit's rounded tips) to 1 (square, sharp-edged tips). */
  wingtips: number
  /**
   * Strut fairings: how much of each strut is faired, 0–1, and their toe,
   * degrees: both fairings' noses turned the same way, to meet the prop's
   * swirl (the tunnel's straight air wants 0).
   */
  struts: { fairing: number; toe: number }
  /** The client's pod under the wing: how faired it is, 0 (a box) to 1 (a teardrop), and where it sits, −1 (aft, under the wing) to 1 (forward, ahead of the leading edge). */
  pod: { fairing: number; at: number }
}

/** Slider ranges. */
export const AIRCRAFT_RANGE = {
  kit: {
    spats: { min: 0, max: 1, step: 0.05 },
    cowling: { min: 0, max: 1, step: 0.05 },
    wingtips: { min: 0, max: 1, step: 0.05 },
    fairing: { min: 0, max: 1, step: 0.05 },
    toe: { min: -6, max: 6, step: 0.5 },
    podFairing: { min: 0, max: 1, step: 0.05 },
    podAt: { min: -1, max: 1, step: 0.1 },
  },
}

/** The kit as its builders fly it: bare wheels, the loose cowl, rounded tips, bare struts, the client's pod as a box in the middle. */
export const STOCK_AIRCRAFT: Record<AircraftClass, AircraftDesign> = {
  kit: { sport: 'aircraft', class: 'kit', spats: 0, cowling: 0, wingtips: 0, struts: { fairing: 0, toe: 0 }, pod: { fairing: 0, at: 0 } },
}

export interface AircraftClassSpec {
  /** Mass at cruise (two aboard, half the fuel), kg, and its most at take-off, kg (the stall speed is certified at it). */
  mass: number
  maxMass: number
  /** Wing area, m², span, m, and the wing's span efficiency (Oswald) with the kit's tips. */
  wingArea: number
  span: number
  oswald: number
  /** The engine: its rated power, W, the share flown at cruise, and how much of that the prop turns into push. */
  power: number
  cruiseShare: number
  propEfficiency: number
  /** The wing's most lift with the kit's tips and nothing under it. */
  clMax: number
  /** The certified stall speed at the most take-off mass in standard sea-level air, km/h: the inspector's floor. */
  certifiedStall: number
}

export const AIRCRAFT_CLASS: Record<AircraftClass, AircraftClassSpec> = {
  kit: {
    mass: 560,
    maxMass: 600,
    wingArea: 12,
    span: 9.6,
    oswald: 0.75,
    power: 75_000,
    cruiseShare: 0.75,
    propEfficiency: 0.8,
    clMax: 1.55,
    certifiedStall: 85,
  },
}

/** The aero (gameplay model, tuned to a two-seat strut-braced kit plane). Drag areas, m². */
export const AIRCRAFT_AERO = {
  /** The wing's own profile drag coefficient (on its area). */
  wingCd0: 0.007,
  /** The fuselage, the tail, and the rest (aerials, steps, gaps). */
  fuselage: 0.12,
  tail: 0.04,
  misc: 0.04,
  /** The kit's cowl, and the share a fully tight one takes off. */
  cowl: 0.08,
  cowlGain: 0.4,
  /** The three bare wheels and their legs, the share full spats take off, and the spats' mass, kg. */
  gear: 0.11,
  spatGain: 0.5,
  spatMass: 6,
  /**
   * Both struts bare, the share full fairings take off, their mass, kg, and
   * how fast a fairing's drag grows when the air meets it at an angle, per
   * degree² (a bare round tube doesn't care).
   */
  struts: 0.05,
  fairGain: 0.7,
  fairMass: 4,
  misalign: 0.09,
  /** The client's pod: its drag as a box and as a teardrop, and the interference drag its wake makes on the wing sitting aft (none at its most forward). */
  podBare: 0.05,
  podFaired: 0.015,
  podInterference: 0.04,
  /** Square tips: the span efficiency they add (a share), their own skin drag, and the share of the wing's most lift they take away. */
  tipGain: 0.15,
  tipCdA: 0.002,
  tipStall: 0.1,
  /** The share of the wing's most lift a pod takes away at its most forward (none from the middle back). */
  podStall: 0.08,
}

/** Cruise speed is searched for between these speeds, m/s, halving the gap this many times. */
export const AIRCRAFT_CRUISE = { slow: 25, fast: 120, steps: 50 }

/** The air the stall speed is certified in: standard sea level. */
export const STALL_AIR = { temperature: 15, altitude: 0 }

/**
 * The prop wash (Kelbo's trap): in flight the slipstream behind the prop is
 * faster than the plane, so the parts in it drag `boost` more, and it swirls
 * round at `swirlDeg`. These shares of each part sit in it: the whole
 * cowling, the front of the fuselage, the nose wheel (one of three), and the
 * struts' roots.
 */
export const PROP_WASH = {
  boost: 0.3,
  swirlDeg: 5,
  share: { cowl: 1, fuselage: 0.4, gear: 1 / 3, struts: 0.4 },
}

export interface Airfield {
  id: 'belyanka'
  /** The strip's height above the sea, m; the usual cruising height, m, and the air there on a usual day, °C. */
  altitude: number
  cruiseAltitude: number
  temperature: number
}

export const AIRFIELDS: Record<Airfield['id'], Airfield> = {
  /** Belyanka airfield north of Stavren: a grass strip and a tarmac one, home to the flying club and the kit builders. */
  belyanka: { id: 'belyanka', altitude: 150, cruiseAltitude: 1500, temperature: 6 },
}
