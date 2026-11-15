/**
 * Autosave: a second after the last change, and at once when the page is
 * hidden or closed (a phone can drop a background tab without warning).
 * Writes never overlap; a change made while one is in flight saves after it.
 * Before another career loads, it is flushed and stopped, so the old one
 * can't be written over the new one as the page unloads.
 */
import { packSave, type SaveFile } from './save'

/** Quiet time after a change before it is written, ms. */
const DEBOUNCE_MS = 1000

export interface Autosave {
  /** Something changed: save soon. */
  touch(): void
  /** Save now, if anything changed. */
  flush(): Promise<void>
  /** Save nothing more (the page is about to load another career). */
  stop(): void
}

export function startAutosave(snapshot: () => SaveFile, write: (text: string) => Promise<boolean>): Autosave {
  let dirty = false
  let timer = 0
  let busy: Promise<void> | null = null
  let stopped = false

  async function flush(): Promise<void> {
    window.clearTimeout(timer)
    if (busy) await busy
    if (!dirty || stopped) return
    dirty = false
    busy = write(packSave(snapshot()))
      .then((ok) => {
        if (!ok) dirty = true
      })
      .catch(() => {
        dirty = true
      })
      .finally(() => {
        busy = null
      })
    await busy
  }

  const now = () => void flush()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') now()
  })
  window.addEventListener('pagehide', now)

  return {
    touch() {
      dirty = true
      window.clearTimeout(timer)
      timer = window.setTimeout(now, DEBOUNCE_MS)
    },
    flush,
    stop() {
      stopped = true
      window.clearTimeout(timer)
    },
  }
}
