/**
 * Slider fills (Isobar, PR 13f). The CSS fills a range's track in teal up to
 * its thumb using the custom property --p, from 0 at the left to 1 at the
 * right. This keeps --p in step with every range in the game: when the player
 * drags it, when code sets its value, and when its min or max changes (the
 * fan's top speed grows with an upgrade). Firefox fills the track itself.
 */

const done = new WeakSet<HTMLInputElement>()
const VALUE = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
const AS_NUMBER = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'valueAsNumber')

function update(input: HTMLInputElement): void {
  const min = Number(input.min || 0)
  const max = Number(input.max || 100)
  const v = Number(VALUE?.get?.call(input) ?? input.value)
  const p = max > min ? Math.min(1, Math.max(0, (v - min) / (max - min))) : 0
  input.style.setProperty('--p', p.toFixed(4))
}

/** Start keeping one range's fill up to date. Safe to call twice. */
export function trackFill(input: HTMLInputElement): void {
  if (done.has(input) || input.type !== 'range') return
  done.add(input)
  input.addEventListener('input', () => update(input))
  input.addEventListener('change', () => update(input))
  // Code often sets .value directly, which fires no event: catch that too.
  if (VALUE?.set && VALUE.get) {
    Object.defineProperty(input, 'value', {
      configurable: true,
      get: () => VALUE.get!.call(input) as string,
      set: (v: string) => {
        VALUE.set!.call(input, v)
        update(input)
      },
    })
  }
  if (AS_NUMBER?.set && AS_NUMBER.get) {
    Object.defineProperty(input, 'valueAsNumber', {
      configurable: true,
      get: () => AS_NUMBER.get!.call(input) as number,
      set: (v: number) => {
        AS_NUMBER.set!.call(input, v)
        update(input)
      },
    })
  }
  // A new min, max or step moves where the value sits on the track.
  new MutationObserver(() => update(input)).observe(input, { attributes: true, attributeFilter: ['min', 'max', 'step', 'value'] })
  update(input)
}

/**
 * Fill every range under root, now and whenever one is added later (sheets
 * build their sliders when first opened).
 */
export function fillRanges(root: HTMLElement): void {
  for (const r of root.querySelectorAll<HTMLInputElement>('input[type="range"]')) trackFill(r)
  new MutationObserver((records) => {
    for (const rec of records) {
      for (const node of rec.addedNodes) {
        if (node.nodeType !== 1) continue
        const elem = node as HTMLElement
        if (elem instanceof HTMLInputElement) trackFill(elem)
        else if (elem.firstElementChild) for (const r of elem.querySelectorAll<HTMLInputElement>('input[type="range"]')) trackFill(r)
      }
    }
  }).observe(root, { childList: true, subtree: true })
}
