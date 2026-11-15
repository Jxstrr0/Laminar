/**
 * The career in play (money, calendar, board, job), shared by every screen
 * like the design is. The autosave keeps it between visits.
 */
import { newCareer, type CareerState } from '../sim/career'
import { DEMO_TUNNEL_SEED } from '../data/tunnel'

type Listener = (career: CareerState) => void

let current: CareerState = newCareer(DEMO_TUNNEL_SEED)
const listeners = new Set<Listener>()

export const careerStore = {
  get(): CareerState {
    return current
  },
  /** Replace the career (the sim's steps hand back fresh objects). */
  set(career: CareerState): void {
    current = career
    for (const l of listeners) l(current)
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

/** A seed for a brand-new career: each one gets its own tunnel quirks and boards. */
export function freshSeed(): number {
  const a = new Uint32Array(1)
  crypto.getRandomValues(a)
  return a[0]! || 1
}
