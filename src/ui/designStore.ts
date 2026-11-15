/**
 * The design you're working on, shared by the Shape and Tunnel screens:
 * shape it on one, test it on the other. Saves arrive in PR 5; until then it
 * lives only as long as the page.
 */
import { DEFAULT_CYCLIST, type CyclistDesign } from '../data/cyclist'

type Listener = (design: CyclistDesign) => void

let current: CyclistDesign = structuredClone(DEFAULT_CYCLIST)
const listeners = new Set<Listener>()

export const designStore = {
  get(): CyclistDesign {
    return current
  },
  /** Replace the design (pass a fresh object; it isn't copied). */
  set(design: CyclistDesign): void {
    current = design
    for (const l of listeners) l(current)
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}
