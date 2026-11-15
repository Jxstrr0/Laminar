/**
 * The model shop sheet (plan section 9.3): pick a scale, finish, accuracy
 * grade, trip strips and pressure taps, see the price and lead time, and order. It slides
 * up over the tunnel like the glossary and borrows its look.
 *
 * Until jobs arrive (PR 5–6) the price and days are shown but not spent.
 */
import { MODEL_FINISH, MODEL_GRADE, MODEL_SCALES, type ModelFinish, type ModelGrade, type ModelScale } from '../data/model'
import { t, type StringKey } from '../data/strings'
import { UNIVERSITY_TUNNEL } from '../data/tunnel'
import { matchedSpeed, quote, type ModelOrder } from '../sim/modelShop'
import { REFERENCE_TT } from '../sim/views'
import { fixed } from './format'
import { bindGlossary, glossaryTerm } from './glossary'

/** How long the slide takes, ms (matches the CSS). */
const SLIDE_MS = 220

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}

/** A row of radio-style buttons, like the tunnel's model switch. */
function choice<T extends string | number>(
  label: string,
  options: readonly { value: T; text: string }[],
  onPick: (value: T) => void,
): { box: HTMLElement; note: HTMLElement; set(value: T): void } {
  const box = el('div', 'shop-group')
  const head = el('p', 'shop-label', label)
  head.id = `shop-${label.toLowerCase().replace(/\W+/g, '-')}`
  const group = el('div', 'segmented')
  group.setAttribute('role', 'radiogroup')
  group.setAttribute('aria-labelledby', head.id)
  const buttons = options.map((o) => {
    const b = el('button', 'segment', o.text)
    b.type = 'button'
    b.setAttribute('role', 'radio')
    b.addEventListener('click', () => onPick(o.value))
    group.append(b)
    return b
  })
  let current = options[0]!.value
  group.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const i = options.findIndex((o) => o.value === current)
    const next = (i + (e.key === 'ArrowRight' ? 1 : options.length - 1)) % options.length
    onPick(options[next]!.value)
    buttons[next]!.focus()
  })
  const note = el('p', 'shop-note')
  box.append(head, group, note)
  return {
    box,
    note,
    set(value) {
      current = value
      options.forEach((o, i) => {
        const on = o.value === value
        buttons[i]!.setAttribute('aria-checked', String(on))
        buttons[i]!.tabIndex = on ? 0 : -1
      })
    },
  }
}

interface Shop {
  root: HTMLElement
  panel: HTMLElement
  close: HTMLButtonElement
  show(order: ModelOrder, onOrder: (order: ModelOrder) => void): void
}

let shop: Shop | null = null
let isOpen = false
let opener: HTMLElement | null = null
let hideTimer = 0

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

function buildShop(): Shop {
  const root = el('div', 'gloss shop')
  root.hidden = true
  const scrim = el('div', 'gloss-scrim')
  scrim.addEventListener('click', () => closeModelShop())

  const panel = el('section', 'gloss-sheet shop-sheet')
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-modal', 'true')
  panel.setAttribute('aria-labelledby', 'shop-title')
  panel.tabIndex = -1

  const grab = el('div', 'gloss-grab')
  grab.setAttribute('aria-hidden', 'true')
  grab.append(el('span', 'gloss-grab-bar'))
  const head = el('div', 'gloss-head')
  const title = el('h2', 'gloss-title', t('shop.title'))
  title.id = 'shop-title'
  const close = el('button', 'gloss-close')
  close.type = 'button'
  close.setAttribute('aria-label', t('shop.close'))
  close.innerHTML =
    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">' +
    '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>'
  close.addEventListener('click', () => closeModelShop())
  head.append(title, close)

  const body = el('div', 'gloss-body')
  const intro = el('p', 'shop-intro', t('shop.intro'))

  // The order being drawn up, and what happens when it's placed.
  let order: ModelOrder = { scale: 2, finish: 'sanded', grade: 'standard', trips: false, taps: false }
  let place: (o: ModelOrder) => void = () => {}
  const update = () => {
    scale.set(order.scale)
    finish.set(order.finish)
    grade.set(order.grade)
    trips.set(order.trips ? 'on' : 'off')
    taps.set(order.taps ? 'on' : 'off')
    const speed = matchedSpeed(1 / order.scale, REFERENCE_TT)
    const top = UNIVERSITY_TUNNEL.topSpeed
    reText.data =
      speed <= top
        ? t('shop.match', { speed: fixed(speed, 0) })
        : t('shop.noMatch', { speed: fixed(speed, 0), top: `${fixed(top, 0)} m/s` })
    finish.note.textContent = t('shop.finishNote', { um: fixed(MODEL_FINISH[order.finish] * 1e6, 0) })
    grade.note.textContent = t('shop.gradeNote', { pct: fixed(MODEL_GRADE[order.grade].accuracy * 100, 1) })
    const q = quote(order)
    price.textContent = t('shop.quote', { price: fixed(q.price, 0), days: q.days })
  }
  const pick = (patch: Partial<ModelOrder>) => {
    order = { ...order, ...patch }
    update()
  }

  const scale = choice<ModelScale>(
    t('shop.scale'),
    MODEL_SCALES.map((s) => ({ value: s, text: t('shop.scaleLabel', { scale: s }) })),
    (s) => pick({ scale: s }),
  )
  // The Reynolds note keeps "Reynolds number" as a glossary term that leads to the trap.
  const reText = document.createTextNode('')
  scale.note.append(reText, ' ', glossaryTerm('reynoldsTrap', t('shop.trapLink')))
  const finish = choice<ModelFinish>(
    t('shop.finish'),
    (Object.keys(MODEL_FINISH) as ModelFinish[]).map((f) => ({ value: f, text: t(`shop.finish.${f}` as StringKey) })),
    (f) => pick({ finish: f }),
  )
  const grade = choice<ModelGrade>(
    t('shop.grade'),
    (Object.keys(MODEL_GRADE) as ModelGrade[]).map((g) => ({ value: g, text: t(`shop.grade.${g}` as StringKey) })),
    (g) => pick({ grade: g }),
  )
  const trips = choice<'off' | 'on'>(
    t('shop.trips'),
    [
      { value: 'off', text: t('shop.trips.off') },
      { value: 'on', text: t('shop.trips.on') },
    ],
    (v) => pick({ trips: v === 'on' }),
  )
  trips.note.textContent = t('shop.tripsNote')
  const taps = choice<'off' | 'on'>(
    t('shop.taps'),
    [
      { value: 'off', text: t('shop.taps.off') },
      { value: 'on', text: t('shop.taps.on') },
    ],
    (v) => pick({ taps: v === 'on' }),
  )
  taps.note.textContent = t('shop.tapsNote')

  const bill = el('div', 'shop-bill')
  const price = el('p', 'shop-price')
  price.setAttribute('aria-live', 'polite')
  const free = el('p', 'shop-note', t('shop.free'))
  const orderBtn = el('button', 'shop-order', t('shop.order'))
  orderBtn.type = 'button'
  orderBtn.addEventListener('click', () => {
    const placed = order
    closeModelShop()
    place(placed)
  })
  bill.append(price, free, orderBtn)

  body.append(intro, scale.box, finish.box, grade.box, trips.box, taps.box, bill)
  panel.append(grab, head, body)
  root.append(scrim, panel)
  document.body.append(root)
  bindGlossary(root)

  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      closeModelShop()
    } else if (e.key === 'Tab') {
      // Keep focus inside the sheet while it is open.
      const stops = Array.from(panel.querySelectorAll<HTMLElement>('button:not([tabindex="-1"]), [tabindex="0"]')).filter(
        (n) => n.offsetParent !== null,
      )
      const first = stops[0]
      const last = stops[stops.length - 1]
      if (first && last) {
        if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    // Keys typed in the sheet are the sheet's: Space mustn't stop the fan behind it.
    e.stopPropagation()
  })

  return {
    root,
    panel,
    close,
    show(current, onOrder) {
      order = { ...current }
      place = onOrder
      update()
      body.scrollTop = 0
    },
  }
}

/** Open the shop on the current model's order; `onOrder` gets the new order. */
export function openModelShop(current: ModelOrder, onOrder: (order: ModelOrder) => void): void {
  shop ??= buildShop()
  const s = shop
  s.show(current, onOrder)
  if (isOpen) return
  isOpen = true
  const active = document.activeElement
  opener = active instanceof HTMLElement && active !== document.body ? active : null
  window.clearTimeout(hideTimer)
  s.root.hidden = false
  for (const sib of Array.from(document.body.children)) {
    if (sib !== s.root && sib instanceof HTMLElement && !sib.inert) {
      sib.inert = true
      sib.dataset.shopInert = '1'
    }
  }
  void s.root.offsetHeight
  s.root.classList.add('is-open')
  s.close.focus({ preventScroll: true })
}

/** Slide the shop away and hand focus back to whatever opened it. */
export function closeModelShop(): void {
  if (!shop || !isOpen) return
  const s = shop
  isOpen = false
  s.root.classList.remove('is-open')
  for (const sib of Array.from(document.body.querySelectorAll<HTMLElement>('[data-shop-inert]'))) {
    sib.inert = false
    delete sib.dataset.shopInert
  }
  const hide = () => {
    if (!isOpen) s.root.hidden = true
  }
  if (reducedMotion()) hide()
  else hideTimer = window.setTimeout(hide, SLIDE_MS)
  if (opener?.isConnected) opener.focus({ preventScroll: true })
  opener = null
}
