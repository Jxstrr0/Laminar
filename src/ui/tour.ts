/**
 * The quick tutorial (PR 13ai): five swipe cards in a bottom sheet. A new
 * player sees them once, before the first job; "How to play" on the Shape
 * sheet opens them again. The cards sit in a row that scrolls sideways and
 * snaps, so a swipe is the browser's own; Back and Next do the same for
 * thumbs, keys and screen readers. The text is in strings.ts (`tour.*`).
 */
import { TOUR_CARDS, TOUR_SEEN_KEY, type TourCard } from '../data/tour'
import { t } from '../data/strings'
import { ICONS } from './icons'
import { createSheet, type Sheet } from './sheet'

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/** Each card's picture: the wordmark first, then the dock's own icons, so the cards point at the real buttons. */
function picture(id: TourCard): HTMLElement {
  const box = el('div', `tour-pic tour-pic-${id}`)
  box.setAttribute('aria-hidden', 'true')
  if (id === 'welcome') box.append(el('span', 'wordmark tour-word', 'laminar'))
  else box.innerHTML = ICONS[id]
  return box
}

let sheet: Sheet | null = null
let goTo: (i: number, smooth?: boolean) => void = () => {}

function build(): Sheet {
  const s = createSheet({ cls: 'tour', title: t('tour.title'), closeLabel: t('tour.close') })
  const total = TOUR_CARDS.length
  const track = el('div', 'tour-track')
  TOUR_CARDS.forEach((id, i) => {
    const card = el('div', 'tour-card')
    card.setAttribute('role', 'group')
    card.setAttribute('aria-roledescription', 'slide')
    card.setAttribute('aria-label', t('tour.slide', { n: i + 1, total }))
    card.append(picture(id), el('h3', 'tour-head', t(`tour.${id}.head`)), el('p', 'tour-body', t(`tour.${id}.body`)))
    track.append(card)
  })

  const foot = el('div', 'tour-foot')
  const back = el('button', 'text-button tour-back', t('tour.back'))
  back.type = 'button'
  const dots = el('div', 'tour-dots')
  dots.setAttribute('aria-hidden', 'true')
  const dotEls = TOUR_CARDS.map(() => dots.appendChild(el('span', 'tour-dot')))
  // The dots get a number beside them, so where you are never rests on colour alone.
  const count = el('span', 'tour-count')
  dots.append(count)
  const next = el('button', 'shop-order tour-next', t('tour.next'))
  next.type = 'button'
  foot.append(back, dots, next)
  s.body.append(track, foot)

  let index = 0
  const mark = (i: number) => {
    index = i
    dotEls.forEach((d, k) => d.classList.toggle('is-on', k === i))
    count.textContent = t('tour.count', { n: i + 1, total })
    back.disabled = i === 0
    next.textContent = t(i === total - 1 ? 'tour.go' : 'tour.next')
    // Cards off to the side are out of the tab order and hidden from screen readers.
    Array.from(track.children).forEach((c, k) => {
      if (c instanceof HTMLElement) c.inert = k !== i
    })
  }
  goTo = (i, smooth = true) => {
    const k = Math.max(0, Math.min(total - 1, i))
    track.scrollTo({ left: k * track.clientWidth, behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' })
    mark(k)
  }
  // A swipe settles on a card: follow it.
  let settle = 0
  track.addEventListener('scroll', () => {
    window.clearTimeout(settle)
    settle = window.setTimeout(() => {
      const k = Math.round(track.scrollLeft / Math.max(1, track.clientWidth))
      if (k !== index) mark(k)
    }, 80)
  })
  back.addEventListener('click', () => goTo(index - 1))
  next.addEventListener('click', () => (index === total - 1 ? s.close() : goTo(index + 1)))
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') goTo(index + 1)
    else if (e.key === 'ArrowLeft') goTo(index - 1)
  })
  mark(0)
  return s
}

/** Open the cards at the first one. */
export function openTour(): void {
  sheet ??= build()
  sheet.open()
  // The sheet has just been laid out, so the row has its width now.
  requestAnimationFrame(() => goTo(0, false))
  try {
    localStorage.setItem(TOUR_SEEN_KEY, '1')
  } catch {
    // A private window may refuse; then the cards may show again next time.
  }
}

/** True until the cards have shown once on this browser. */
export function tourUnseen(): boolean {
  try {
    return localStorage.getItem(TOUR_SEEN_KEY) !== '1'
  } catch {
    return false
  }
}
