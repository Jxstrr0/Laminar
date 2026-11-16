/**
 * The model shop sheet (plan section 9.3): pick who makes it (the outside
 * shop or a machine you own), a scale, finish, accuracy grade, trip strips
 * and pressure taps, see the price and lead time, and order. It slides
 * up over the tunnel like the glossary and borrows its look.
 *
 * Models are built for a job (Kelbo, PR 5): the price is charged to it and
 * the lead time comes off its days, all at once when the order is placed.
 */
import { MAKERS, MAKER_IDS, MODEL_FINISH, MODEL_GRADE, MODEL_SCALES, type MakerId, type ModelFinish, type ModelGrade, type ModelScale } from '../data/model'
import { t, type StringKey } from '../data/strings'
import { forMaker, makerOf, matchedSpeed, quote, type MakerHand, type ModelOrder } from '../sim/modelShop'
import type { OrderBlock } from '../sim/career'
import type { EventSpec } from '../sim/views'
import { fixed } from './format'
import { glossaryTerm } from './glossary'
import { createSheet, type Sheet } from './sheet'

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
): { box: HTMLElement; note: HTMLElement; set(value: T): void; allow(values: readonly T[]): void } {
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
    // Step to the next option that can be picked, skipping any the maker can't do.
    const i = options.findIndex((o) => o.value === current)
    const dir = e.key === 'ArrowRight' ? 1 : options.length - 1
    let next = (i + dir) % options.length
    while (buttons[next]!.disabled && next !== i) next = (next + dir) % options.length
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
    allow(values) {
      options.forEach((o, i) => (buttons[i]!.disabled = !values.includes(o.value)))
    },
  }
}

/** What the shop needs to know about the job in hand. */
export interface ShopContext {
  /** The event the model is for (its Reynolds number). */
  event: EventSpec
  /** Whether an order taking this many days can be placed. */
  block(days: number): OrderBlock
  /** Days left on the job (0 with none). */
  daysLeft: number
  /** The top speed of the tunnel in use, m/s (a bigger fan raises it). */
  topSpeed: number
  /** Who can make the model: the outside shop and any machines you own. */
  makers: readonly MakerId[]
  /** What your own model maker brings to price and days. */
  hand: MakerHand
}

interface Shop {
  sheet: Sheet
  show(order: ModelOrder, context: ShopContext, onOrder: (order: ModelOrder) => void): void
}

let shop: Shop | null = null

function buildShop(): Shop {
  const sheet = createSheet({ cls: 'shop', title: t('shop.title'), closeLabel: t('shop.close') })
  const body = sheet.body
  const intro = el('p', 'shop-intro', t('shop.intro'))

  // The order being drawn up, and what happens when it's placed.
  let order: ModelOrder = { scale: 2, finish: 'sanded', grade: 'standard', trips: false, taps: false }
  let place: (o: ModelOrder) => void = () => {}
  let context: ShopContext | null = null
  const update = () => {
    if (!context) return
    const m = MAKERS[makerOf(order)]
    maker.box.hidden = context.makers.length < 2
    maker.allow(context.makers)
    maker.set(makerOf(order))
    maker.note.textContent = t(`shop.makerNote.${makerOf(order)}`)
    scale.allow(m.scales)
    finish.allow(m.finishes)
    grade.allow(m.grades)
    scale.set(order.scale)
    finish.set(order.finish)
    grade.set(order.grade)
    trips.set(order.trips ? 'on' : 'off')
    taps.set(order.taps ? 'on' : 'off')
    const speed = matchedSpeed(1 / order.scale, context.event)
    const top = context.topSpeed
    reText.data =
      speed <= top
        ? t('shop.match', { speed: fixed(speed, 0) })
        : t('shop.noMatch', { speed: fixed(speed, 0), top: `${fixed(top, 0)} m/s` })
    finish.note.textContent = t('shop.finishNote', { um: fixed(MODEL_FINISH[order.finish] * 1e6, 0) })
    grade.note.textContent = t('shop.gradeNote', { pct: fixed(MODEL_GRADE[order.grade].accuracy * 100, 1) })
    const q = quote(order, context.hand)
    price.textContent = t('shop.quote', { price: fixed(q.price, 0), days: q.days })
    const block = context.block(q.days)
    const left = context.daysLeft
    bill.classList.toggle('is-blocked', block !== null)
    orderBtn.disabled = block !== null
    free.textContent =
      block === 'noJob' ? t('shop.noJob') : block === 'noDays' ? t('shop.noDays', { days: q.days, left }) : t('shop.bill', { days: q.days, left })
  }
  const pick = (patch: Partial<ModelOrder>) => {
    order = { ...order, ...patch }
    update()
  }

  const maker = choice<MakerId>(
    t('shop.maker'),
    MAKER_IDS.map((id) => ({ value: id, text: t(`shop.maker.${id}`) })),
    (id) => {
      order = forMaker(order, id)
      update()
    },
  )
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
  const free = el('p', 'shop-note')
  free.setAttribute('aria-live', 'polite')
  const orderBtn = el('button', 'shop-order', t('shop.order'))
  orderBtn.type = 'button'
  orderBtn.addEventListener('click', () => {
    const placed = order
    closeModelShop()
    place(placed)
  })
  bill.append(price, free, orderBtn)

  body.append(intro, maker.box, scale.box, finish.box, grade.box, trips.box, taps.box, bill)

  return {
    sheet,
    show(current, ctx, onOrder) {
      // Start from the model on the mount, at a maker you still have.
      order = ctx.makers.includes(makerOf(current)) ? { ...current } : forMaker(current, 'shop')
      context = ctx
      place = onOrder
      update()
    },
  }
}

/** Open the shop on the current model's order; `onOrder` gets the new order. */
export function openModelShop(current: ModelOrder, context: ShopContext, onOrder: (order: ModelOrder) => void): void {
  shop ??= buildShop()
  shop.show(current, context, onOrder)
  shop.sheet.open()
}

/** Slide the shop away and hand focus back to whatever opened it. */
export function closeModelShop(): void {
  shop?.sheet.close()
}
