/**
 * The tunnel fan. The player sets a target speed; the real air speed follows
 * it at the fan's ramp rate, so the fan spins up and down instead of jumping.
 * Runs on a fixed time step like the rest of the sim.
 */

export interface FanSpec {
  /** Fastest air speed in m/s. */
  topSpeed: number
  /** Most the speed can change per second, in m/s. */
  rampRate: number
}

export interface FanState {
  /** What the player asked for, in m/s. */
  target: number
  /** What the air is doing now, in m/s. */
  speed: number
}

export function fanAtRest(): FanState {
  return { target: 0, speed: 0 }
}

/** Clamp a requested speed into what the fan can do. */
export function setFanTarget(state: FanState, target: number, spec: FanSpec): FanState {
  const t = Number.isFinite(target) ? Math.min(spec.topSpeed, Math.max(0, target)) : 0
  return { ...state, target: t }
}

/** Advance the fan by dt seconds. */
export function stepFan(state: FanState, dt: number, spec: FanSpec): FanState {
  const maxChange = spec.rampRate * dt
  const gap = state.target - state.speed
  const change = Math.min(maxChange, Math.max(-maxChange, gap))
  return { ...state, speed: state.speed + change }
}
