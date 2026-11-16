/**
 * Tunnel failures (plan section 8, Kelbo's calls of 16 November 2026): a
 * scale model can shake a thin part loose, tear off its mount or shed a
 * glued part. The tunnel always warns first (the part buzzes, the trace
 * wobbles, Irina shouts), and a model only breaks if the fan stays past
 * the limit. A break sends the model for repair: half its price and half
 * its build days; tearing off the mount also brings the university's bill
 * for the screens.
 *
 * Speeds are tunnel air speeds, m/s; loads are on the model, N.
 */
export const FAILURE = {
  /** A part starts to warn at this fraction of its limit. */
  warnAt: 0.9,
  /** Seconds past the limit before it lets go (the warning's last chance). */
  holdSeconds: { flutter: 2.5, mount: 1.5, detach: 2 },
  /** Time past the limit drains away this many times faster than it builds once you back off. */
  recover: 2,
  /** Extra balance scatter at the limit while a part buzzes (fraction of the reading). */
  wobble: 0.04,
  flutter: {
    /**
     * A helmet tail's flutter speed on a sanded 1:2 model: `base` less
     * `perTail` for each unit of tail length. Only aero helmets with at
     * least `minTail` of tail have one worth worrying about.
     */
    tail: { base: 50, perTail: 24, minTail: 0.1 },
    /** A disc wheel's thin cover on a sanded 1:2 model. */
    disc: 42,
    /** Smaller models have shorter, stiffer parts: their flutter speed times this. */
    // Smaller models are stiffer for their size; a truck's scales (PR 9c) carry on the trend.
    scale: { 4: 1.3, 3: 1.15, 2: 1, 12: 1.6, 10: 1.5, 8: 1.4, 1: 1, 2.5: 1.2, 1.5: 1 },
    /** Printed parts are softer. */
    finish: { printed: 0.85, sanded: 1, polished: 1 },
  },
  /** The two posts that clamp a rider model's axles: the most load they take, drag and side force together. */
  mountN: 60,
  /**
   * A truck model (PR 9d) is bolted through its wheels onto stouter struts:
   * the most load they take. A 1:8 rig sweeps to about 15° at full fan; at
   * 20° it wants the fan down near 30 m/s, where a truck's side force bites.
   */
  truckMountN: 250,
  /** A racing car model hangs from a stout strut through its roof (PR 9l): it has its downforce to carry as well as its drag, N. */
  carMountN: 1500,
  /**
   * A land-speed car's model stands on two slim posts on the turntable
   * (PR 9s): a 1:8 model at 40 m/s and 20° of yaw loads them about 35 N;
   * a faster fan swept as far breaks them, N.
   */
  recordMountN: 60,
  /**
   * The sting a ski jumper's model hangs on (PR 8k): the most load it takes,
   * lift and drag together. A 1:2 model reads the whole sweep at 30 m/s; push
   * it near 35 m/s at a steep pitch and it gives.
   */
  stingN: 170,
  /**
   * The slim sting a full-size quad model is tipped on (PR 10d), N: a faired
   * racer tipped right over in the university's fan loads it under 30 N; the
   * bigger fan, tipped as far, breaks it.
   */
  droneStingN: 45,
  /** Printed models have their helmet glued on: it lets go past this air speed. */
  detachSpeed: 36,
  repair: {
    /** Share of the model's price and of its build days a repair costs. */
    share: 0.5,
    /** The university's bill when a model tears off and hits the screens, ₽. */
    screens: 12000,
  },
} as const
