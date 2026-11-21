/**
 * One more draw on the next frame (PR 13bc). A replay stops drawing on its
 * last frame (with reduced motion, its only frame), so a sky picture, a
 * ground texture or a venue's model that arrives after that would never
 * show. Each of them asks for a draw when it lands.
 */
export interface LateDraw {
  /** Draw once on the next frame (asking twice before then draws once). */
  ask(): void
  stop(): void
}

export function lateDraw(draw: () => void): LateDraw {
  let raf = 0
  let stopped = false
  return {
    ask() {
      if (stopped || raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        if (!stopped) draw()
      })
    },
    stop() {
      stopped = true
      cancelAnimationFrame(raf)
    },
  }
}
