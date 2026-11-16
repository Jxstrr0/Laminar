/**
 * The design you're working on, shared by the Shape and Tunnel screens:
 * shape it on one, test it on the other. The autosave (src/persist) keeps it
 * between visits.
 */
import { DEFAULT_CYCLIST } from '../data/cyclist'
import type { Design } from '../data/sport'

type Listener = (design: Design) => void

let current: Design = structuredClone(DEFAULT_CYCLIST)
const listeners = new Set<Listener>()

export const designStore = {
  get(): Design {
    return current
  },
  /** Replace the design (pass a fresh object; it isn't copied). */
  set(design: Design): void {
    current = design
    for (const l of listeners) l(current)
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}
