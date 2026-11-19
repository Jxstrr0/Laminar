/**
 * Soft scroll edges (PR 13am). A scroller's top edge fades in over the first
 * `ramp` pixels of scrolling, so cards slip away under a soft edge instead of
 * being sliced by a hard line. The CSS reads `--fade-k`, 0 at the top and 1
 * once scrolled `ramp` pixels or more; it only changes while it ramps.
 */
export function scrollFade(el: HTMLElement, ramp: number): void {
  let shown = -1
  const update = (): void => {
    const k = Math.round(Math.min(1, Math.max(0, el.scrollTop / ramp)) * 20) / 20
    if (k === shown) return
    shown = k
    el.style.setProperty('--fade-k', String(k))
  }
  el.addEventListener('scroll', update, { passive: true })
  update()
}
