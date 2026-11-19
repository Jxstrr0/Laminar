/**
 * A bottom sheet that slides up over the screen, borrowing the glossary's
 * look: a scrim, a grab bar, a title and a close button. While it is open
 * the rest of the page is inert, focus stays inside, and Escape or a tap on
 * the scrim closes it. The model shop and the Saves sheet are built on it.
 */
import { bindGlossary } from './glossary'
import { scrollFade } from './scrollFade'

/** How long the slide takes, ms (matches the CSS). */
const SLIDE_MS = 220

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

export interface SheetOptions {
  /** Extra class on the root (its z-index and size live in the CSS). */
  cls: string
  title: string
  /** The close button's accessible name. */
  closeLabel: string
}

export interface Sheet {
  /** Fill this with the sheet's content. */
  body: HTMLElement
  open(): void
  close(): void
  readonly isOpen: boolean
}

export function createSheet(options: SheetOptions): Sheet {
  const root = document.createElement('div')
  root.className = `gloss ${options.cls}`
  root.hidden = true
  const scrim = document.createElement('div')
  scrim.className = 'gloss-scrim'

  const panel = document.createElement('section')
  panel.className = `gloss-sheet ${options.cls}-sheet`
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-modal', 'true')
  const titleId = `${options.cls}-title`
  panel.setAttribute('aria-labelledby', titleId)
  panel.tabIndex = -1

  const grab = document.createElement('div')
  grab.className = 'gloss-grab'
  grab.setAttribute('aria-hidden', 'true')
  const bar = document.createElement('span')
  bar.className = 'gloss-grab-bar'
  grab.append(bar)

  const head = document.createElement('div')
  head.className = 'gloss-head'
  const title = document.createElement('h2')
  title.className = 'gloss-title'
  title.id = titleId
  title.textContent = options.title
  const closeBtn = document.createElement('button')
  closeBtn.className = 'gloss-close'
  closeBtn.type = 'button'
  closeBtn.setAttribute('aria-label', options.closeLabel)
  closeBtn.innerHTML =
    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">' +
    '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>'
  head.append(title, closeBtn)

  const body = document.createElement('div')
  body.className = 'gloss-body'
  scrollFade(body, 16)
  panel.append(grab, head, body)
  root.append(scrim, panel)
  document.body.append(root)
  bindGlossary(root)

  let isOpen = false
  let opener: HTMLElement | null = null
  let hideTimer = 0
  const inertMark = `sheetInert${options.cls.replace(/\W/g, '')}`

  function close(): void {
    if (!isOpen) return
    isOpen = false
    root.classList.remove('is-open')
    for (const sib of Array.from(document.body.children)) {
      if (sib instanceof HTMLElement && sib.dataset[inertMark]) {
        sib.inert = false
        delete sib.dataset[inertMark]
      }
    }
    const hide = () => {
      if (!isOpen) root.hidden = true
    }
    if (reducedMotion()) hide()
    else hideTimer = window.setTimeout(hide, SLIDE_MS)
    if (opener?.isConnected) opener.focus({ preventScroll: true })
    opener = null
  }

  function open(): void {
    body.scrollTop = 0
    if (isOpen) return
    isOpen = true
    const active = document.activeElement
    opener = active instanceof HTMLElement && active !== document.body ? active : null
    window.clearTimeout(hideTimer)
    root.hidden = false
    for (const sib of Array.from(document.body.children)) {
      if (sib !== root && sib instanceof HTMLElement && !sib.inert) {
        sib.inert = true
        sib.dataset[inertMark] = '1'
      }
    }
    void root.offsetHeight
    root.classList.add('is-open')
    closeBtn.focus({ preventScroll: true })
  }

  scrim.addEventListener('click', close)
  closeBtn.addEventListener('click', close)
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'Tab') {
      // Keep focus inside the sheet while it is open.
      const stops = Array.from(
        panel.querySelectorAll<HTMLElement>('button:not([tabindex="-1"]):not(:disabled), textarea, input, [tabindex="0"]'),
      ).filter((n) => n.offsetParent !== null)
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
    body,
    open,
    close,
    get isOpen() {
      return isOpen
    },
  }
}
