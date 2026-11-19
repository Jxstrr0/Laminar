/**
 * Tap any aero term for a plain explanation (plan section 10, "Glossary").
 *
 * Any element with data-g="<id>" is a term: a dotted underline in the accent
 * colour that opens a small sheet at the bottom of the screen. The sheet shows
 * the term, its explanation and "see also" chips; openGlossaryIndex() shows a
 * searchable A–Z list of every term in the same sheet.
 *
 * The sheet closes with its close button, a tap outside it, Escape, or a swipe
 * down on its top edge. The words live in src/data/glossary.ts.
 */
import { GLOSSARY, GLOSSARY_IDS, GLOSSARY_UI, isGlossaryId, type GlossaryId } from '../data/glossary'
import { scrollFade } from './scrollFade'

/** How long the sheet takes to slide; matches .gloss-sheet in style.css. */
const SLIDE_MS = 220
/** A swipe down past this many pixels closes the sheet. */
const SWIPE_CLOSE_PX = 72
/** ...or a shorter, quick flick faster than this (pixels per millisecond). */
const FLICK_SPEED = 0.5

const TERM_CLASS = 'g-term'

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}

function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Give a data-g element its look, focus stop and role, once. */
function upgradeTerm(node: HTMLElement): void {
  if (node.dataset.gReady === '1') return
  node.dataset.gReady = '1'
  node.classList.add(TERM_CLASS)
  if (!node.hasAttribute('tabindex')) node.tabIndex = 0
  if (!node.hasAttribute('role') && node.tagName !== 'BUTTON') node.setAttribute('role', 'button')
  node.setAttribute('aria-haspopup', 'dialog')
}

function upgradeAll(root: ParentNode): void {
  if (root instanceof HTMLElement && root.dataset.g !== undefined) upgradeTerm(root)
  root.querySelectorAll<HTMLElement>('[data-g]').forEach(upgradeTerm)
}

/** A tappable term for other UI code to drop into text. */
export function glossaryTerm(id: GlossaryId, label?: string): HTMLElement {
  const span = el('span', undefined, label ?? GLOSSARY[id].term)
  span.dataset.g = id
  upgradeTerm(span)
  return span
}

// --- The sheet -------------------------------------------------------------

interface Sheet {
  root: HTMLElement
  panel: HTMLElement
  title: HTMLElement
  body: HTMLElement
  close: HTMLButtonElement
}

let sheet: Sheet | null = null
let isOpen = false
let opener: HTMLElement | null = null
let hideTimer = 0

function buildSheet(): Sheet {
  const root = el('div', 'gloss')
  root.hidden = true

  const scrim = el('div', 'gloss-scrim')
  // A tap anywhere outside the panel lands on the scrim and closes.
  scrim.addEventListener('click', () => closeGlossary())

  const panel = el('section', 'gloss-sheet')
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-modal', 'true')
  panel.setAttribute('aria-labelledby', 'gloss-title')
  panel.tabIndex = -1

  const grab = el('div', 'gloss-grab')
  grab.setAttribute('aria-hidden', 'true')
  grab.append(el('span', 'gloss-grab-bar'))

  const head = el('div', 'gloss-head')
  const title = el('h2', 'gloss-title')
  title.id = 'gloss-title'
  const close = el('button', 'gloss-close')
  close.type = 'button'
  close.setAttribute('aria-label', GLOSSARY_UI.close)
  close.innerHTML =
    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">' +
    '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>'
  close.addEventListener('click', () => closeGlossary())
  head.append(title, close)

  const body = el('div', 'gloss-body')
  scrollFade(body, 16)

  panel.append(grab, head, body)
  root.append(scrim, panel)
  document.body.append(root)

  panel.addEventListener('keydown', onSheetKey)
  // Clicks on terms or chips inside the sheet switch it to that entry.
  panel.addEventListener('click', (e) => {
    const target = (e.target as Element | null)?.closest<HTMLElement>('[data-g-go]')
    if (!target) return
    const id = target.dataset.gGo
    if (id === '*') showIndex()
    else if (id && isGlossaryId(id)) showEntry(id)
  })
  bindSwipe(panel, [grab, head])

  return { root, panel, title, body, close }
}

function onSheetKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault()
    closeGlossary()
  } else if (e.key === 'Tab' && sheet) {
    // Keep focus inside the sheet while it is open.
    const stops = focusables(sheet.panel)
    const first = stops[0]
    const last = stops[stops.length - 1]
    if (!first || !last) return
    if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet.panel)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
  // Keys typed in the sheet are the sheet's: don't let screen shortcuts
  // (Space stops the fan) see them.
  e.stopPropagation()
}

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])'),
  ).filter((n) => !n.hasAttribute('disabled') && n.offsetParent !== null)
}

/** Drag the sheet down by its top edge; let go far or fast enough and it closes. */
function bindSwipe(panel: HTMLElement, handles: HTMLElement[]): void {
  let id = -1
  let startY = 0
  let lastY = 0
  let lastT = 0
  let speed = 0

  const onDown = (e: PointerEvent) => {
    if (id !== -1 || (e.pointerType === 'mouse' && e.button !== 0)) return
    if ((e.target as Element | null)?.closest('button')) return
    id = e.pointerId
    startY = lastY = e.clientY
    lastT = e.timeStamp
    speed = 0
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(id)
    } catch {
      // The pointer is already gone; the drag still works while it stays on the handle.
    }
    panel.classList.add('is-dragging')
  }
  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== id) return
    const dt = Math.max(1, e.timeStamp - lastT)
    speed = (e.clientY - lastY) / dt
    lastY = e.clientY
    lastT = e.timeStamp
    const dy = Math.max(0, e.clientY - startY)
    panel.style.transform = dy > 0 ? `translateY(${dy}px)` : ''
  }
  const onEnd = (e: PointerEvent) => {
    if (e.pointerId !== id) return
    id = -1
    panel.classList.remove('is-dragging')
    const dy = e.clientY - startY
    const shouldClose = e.type === 'pointerup' && (dy > SWIPE_CLOSE_PX || (dy > 16 && speed > FLICK_SPEED))
    if (shouldClose) {
      closeGlossary()
    } else {
      panel.style.transform = ''
    }
  }
  for (const h of handles) {
    h.addEventListener('pointerdown', onDown)
    h.addEventListener('pointermove', onMove)
    h.addEventListener('pointerup', onEnd)
    h.addEventListener('pointercancel', onEnd)
  }
}

function ensureSheet(): Sheet {
  sheet ??= buildSheet()
  return sheet
}

/** Slide the sheet up, if it isn't up already, and remember who opened it. */
function present(s: Sheet): void {
  if (isOpen) return
  isOpen = true
  const active = document.activeElement
  opener = active instanceof HTMLElement && active !== document.body ? active : null
  window.clearTimeout(hideTimer)
  s.panel.style.transform = ''
  s.root.hidden = false
  // Everything behind the sheet is out of reach while it is open.
  for (const sib of Array.from(document.body.children)) {
    if (sib !== s.root && sib instanceof HTMLElement && !sib.inert) {
      sib.inert = true
      sib.dataset.gInert = '1'
    }
  }
  // Force a layout so the slide-up transition runs from the closed position.
  void s.root.offsetHeight
  s.root.classList.add('is-open')
}

function showEntry(id: GlossaryId): void {
  const s = ensureSheet()
  const entry = GLOSSARY[id]
  s.root.dataset.view = 'entry'
  s.title.textContent = entry.term
  const short = el('p', 'gloss-short', entry.short)
  const long = el('p', 'gloss-long', entry.long)
  const chips = el('div', 'gloss-chips')
  const see = entry.seeAlso ?? []
  if (see.length > 0) {
    const label = el('h3', 'gloss-chips-label', GLOSSARY_UI.seeAlso)
    label.id = 'gloss-see'
    const list = el('ul', 'gloss-chip-list')
    list.setAttribute('aria-labelledby', 'gloss-see')
    for (const other of see) {
      const li = el('li')
      li.append(chip(GLOSSARY[other].term, other))
      list.append(li)
    }
    chips.append(label, list)
  }
  const all = chip(GLOSSARY_UI.allTerms, '*')
  all.classList.add('gloss-chip-all')
  chips.append(all)
  s.body.replaceChildren(short, long, chips)
  s.body.scrollTop = 0
  present(s)
  s.close.focus({ preventScroll: true })
}

function chip(label: string, go: GlossaryId | '*'): HTMLButtonElement {
  const b = el('button', 'gloss-chip', label)
  b.type = 'button'
  b.dataset.gGo = go
  return b
}

/** The A–Z list of every term, sorted by its term. */
const SORTED = [...GLOSSARY_IDS].sort((a, b) =>
  GLOSSARY[a].term.localeCompare(GLOSSARY[b].term, 'en-CA', { sensitivity: 'base' }),
)

function matches(id: GlossaryId, q: string): boolean {
  if (!q) return true
  const e = GLOSSARY[id]
  // Match the start of words, so "wing" finds wings but not "following".
  const words = [e.term, e.short, ...(e.aliases ?? [])].join(' ').toLowerCase().split(/[^\p{L}\p{N}/½²]+/u)
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((part) => words.some((w) => w.startsWith(part)))
}

function showIndex(): void {
  const s = ensureSheet()
  s.root.dataset.view = 'index'
  s.title.textContent = GLOSSARY_UI.title

  const search = el('input', 'gloss-search')
  search.type = 'search'
  search.placeholder = GLOSSARY_UI.search
  search.setAttribute('aria-label', GLOSSARY_UI.search)
  search.autocomplete = 'off'
  search.spellcheck = false
  search.enterKeyHint = 'search'

  const status = el('p', 'gloss-count')
  status.setAttribute('aria-live', 'polite')
  const list = el('ul', 'gloss-index')

  const render = () => {
    const q = search.value.trim()
    const shown = SORTED.filter((id) => matches(id, q))
    const items: HTMLElement[] = []
    let letter = ''
    for (const id of shown) {
      const term = GLOSSARY[id].term
      const first = term.charAt(0).toUpperCase()
      if (first !== letter && !q) {
        letter = first
        items.push(el('li', 'gloss-letter', first))
      }
      const li = el('li')
      const b = el('button', 'gloss-row')
      b.type = 'button'
      b.dataset.gGo = id
      b.append(el('span', 'gloss-row-term', term), el('span', 'gloss-row-short', GLOSSARY[id].short))
      li.append(b)
      items.push(li)
    }
    list.replaceChildren(...items)
    status.textContent = shown.length === 0 ? GLOSSARY_UI.noMatch : GLOSSARY_UI.count.replace('{n}', String(shown.length))
  }
  search.addEventListener('input', render)
  render()

  s.body.replaceChildren(search, status, list)
  s.body.scrollTop = 0
  present(s)
  // On a phone, focusing the box would throw up the keyboard over the list.
  if (matchMedia('(pointer: fine)').matches) search.focus({ preventScroll: true })
  else s.close.focus({ preventScroll: true })
}

/** Open the sheet on one term. */
export function openGlossary(id: GlossaryId): void {
  showEntry(id)
}

/** Open the searchable A–Z list of every term. */
export function openGlossaryIndex(): void {
  showIndex()
}

/** Slide the sheet away and hand focus back to whatever opened it. */
export function closeGlossary(): void {
  if (!sheet || !isOpen) return
  const s = sheet
  isOpen = false
  s.root.classList.remove('is-open')
  s.panel.style.transform = ''
  for (const sib of Array.from(document.body.querySelectorAll<HTMLElement>('[data-g-inert]'))) {
    sib.inert = false
    delete sib.dataset.gInert
  }
  const hide = () => {
    if (!isOpen) s.root.hidden = true
  }
  if (reducedMotion()) hide()
  else hideTimer = window.setTimeout(hide, SLIDE_MS)
  if (opener?.isConnected) opener.focus({ preventScroll: true })
  opener = null
}

// --- Binding terms -----------------------------------------------------------

const bound = new WeakSet<HTMLElement>()

function termFrom(target: EventTarget | null, root: HTMLElement): HTMLElement | null {
  const node = target instanceof Element ? target.closest<HTMLElement>('[data-g]') : null
  if (!node || !root.contains(node)) return null
  if (sheet?.root.contains(node)) return null
  return node
}

function openFrom(node: HTMLElement): boolean {
  const id = node.dataset.g
  if (!id || !isGlossaryId(id)) return false
  // Remember the term so focus comes back to it when the sheet closes.
  if (document.activeElement !== node) node.focus({ preventScroll: true })
  showEntry(id)
  return true
}

/**
 * Make every data-g element under root a glossary term, now and later.
 * One listener on root handles them all, so terms added after this call work too.
 */
export function bindGlossary(root: HTMLElement): void {
  if (bound.has(root)) return
  bound.add(root)
  upgradeAll(root)

  root.addEventListener('click', (e) => {
    const node = termFrom(e.target, root)
    if (node && openFrom(node)) e.preventDefault()
  })
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    const node = termFrom(e.target, root)
    if (!node || node !== e.target) return
    if (openFrom(node)) {
      e.preventDefault()
      // Space on a term opens it; it must not also stop the fan.
      e.stopPropagation()
    }
  })

  // Style and focus terms that other code adds later.
  new MutationObserver((records) => {
    for (const r of records) {
      r.addedNodes.forEach((n) => {
        if (n instanceof HTMLElement) upgradeAll(n)
      })
      if (r.type === 'attributes' && r.target instanceof HTMLElement) upgradeTerm(r.target)
    }
  }).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-g'] })
}
