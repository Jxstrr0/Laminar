/**
 * Is a replay on screen? (PR 13u.) The music, the replay's sounds and the
 * debrief's voice lines all change the moment a replay opens or closes, so
 * they listen here instead of each checking on a timer (which left the music
 * up to half a second behind the picture).
 *
 * Every replay screen is a `.replay` element added straight to the page's
 * body, so watching the body's children is enough.
 */
const listeners = new Set<(open: boolean) => void>()
let open = false
let watching = false

export const replayOpen = (): boolean => (typeof document === 'undefined' ? false : document.querySelector('.replay') !== null)

function check(): void {
  const now = replayOpen()
  if (now === open) return
  open = now
  for (const f of [...listeners]) f(now)
}

/** Hear the moment a replay opens (true) or closes (false). */
export function onReplay(f: (open: boolean) => void): () => void {
  if (!watching && typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
    watching = true
    open = replayOpen()
    new MutationObserver(check).observe(document.body, { childList: true })
  }
  listeners.add(f)
  return () => listeners.delete(f)
}
