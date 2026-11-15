/**
 * The Saves sheet (plan section 13): three career slots, a new career in
 * any of them, and save codes to carry a career to another phone.
 * Switching careers reloads the page, so every screen starts clean from the
 * new save.
 */
import { t, type StringKey } from '../data/strings'
import { decodeSave, encodeSave } from '../persist/code'
import { readSlot, SLOTS } from '../persist/db'
import { parseSave, type SaveFile } from '../persist/save'
import { createSheet, type Sheet } from './sheet'

export interface SavesActions {
  /** The slot in play. */
  slot: number
  /** The career as it stands, for its save code. */
  current(): SaveFile
  /** Play another slot. */
  switchTo(slot: number): Promise<void>
  /** Start a fresh career in a slot (erasing whatever is there). */
  startOver(slot: number): Promise<void>
  /** Replace the slot in play with this career. */
  load(save: SaveFile): Promise<void>
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}

function button(cls: string, text: string): HTMLButtonElement {
  const b = el('button', cls, text)
  b.type = 'button'
  return b
}

/**
 * A button that asks for a second tap before something that can't be
 * undone, instead of a pop-up: the first tap changes its words for a few
 * seconds.
 */
function twoTap(b: HTMLButtonElement, words: string, confirmWords: string, run: () => void): void {
  let armed = 0
  b.addEventListener('click', () => {
    if (armed) {
      window.clearTimeout(armed)
      armed = 0
      run()
      return
    }
    b.textContent = confirmWords
    b.classList.add('is-armed')
    armed = window.setTimeout(() => {
      armed = 0
      b.textContent = words
      b.classList.remove('is-armed')
    }, 4000)
  })
}

const savedAt = (ms: number) =>
  new Date(ms).toLocaleString('en-CA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const sizeOf = (text: string) => (text.length < 1024 ? `${text.length} B` : `${Math.round(text.length / 1024)} KB`)

let sheet: Sheet | null = null

export async function openSaves(actions: SavesActions): Promise<void> {
  sheet ??= createSheet({ cls: 'saves', title: t('saves.title'), closeLabel: t('saves.close') })
  const body = sheet.body
  body.replaceChildren(el('p', 'shop-intro', t('saves.intro')))

  // Each slot as one row: its name and state, a summary, and what you can do with it.
  const list = el('ul', 'save-slots')
  body.append(list)
  const texts = await Promise.all(Array.from({ length: SLOTS }, (_, i) => readSlot(i + 1).catch(() => null)))
  texts.forEach((text, i) => {
    const n = i + 1
    const save = parseSave(text)
    const playing = n === actions.slot
    const row = el('li', `save-slot${playing ? ' is-current' : ''}`)
    const head = el('p', 'save-slot-head')
    head.append(el('span', 'save-slot-name', t('saves.slot', { n })))
    if (playing) head.append(el('span', 'save-slot-tag', t('saves.inUse')))
    // The slot in play is described as it is now, not as last written.
    const shown = playing ? actions.current() : save
    const runs = shown?.lab.runs.length ?? 0
    const line = shown
      ? t(runs === 1 ? 'saves.summaryOne' : 'saves.summary', { runs, when: savedAt(shown.savedAt) })
      : t(text ? 'saves.unreadable' : 'saves.empty')
    const buttons = el('div', 'save-slot-actions')
    if (!playing && save) {
      const play = button('save-btn', t('saves.play'))
      play.addEventListener('click', () => void actions.switchTo(n))
      buttons.append(play)
    }
    const fresh = save || playing || text ? t('saves.newCareer') : t('saves.startHere')
    const wipe = button(save || playing || text ? 'save-btn quiet' : 'save-btn', fresh)
    if (save || playing || text) twoTap(wipe, fresh, t('saves.confirm'), () => void actions.startOver(n))
    else wipe.addEventListener('click', () => void actions.startOver(n))
    buttons.append(wipe)
    row.append(head, el('p', 'save-slot-line', line), buttons)
    list.append(row)
  })

  // Save codes: copy this career out, or paste one in.
  const code = el('div', 'save-code')
  const copy = button('shop-order', t('saves.copy'))
  const status = el('p', 'shop-note')
  status.setAttribute('aria-live', 'polite')
  const box = el('textarea', 'save-code-box')
  box.rows = 3
  box.spellcheck = false
  box.autocapitalize = 'off'
  box.setAttribute('autocorrect', 'off')
  box.placeholder = 'LAM1:…'
  box.id = 'save-code-box'
  const boxLabel = el('label', 'shop-label', t('saves.pasteLabel'))
  boxLabel.htmlFor = box.id
  const loadWords = t('saves.load', { n: actions.slot })
  const load = button('save-btn', loadWords)
  const loadStatus = el('p', 'shop-note')
  loadStatus.setAttribute('aria-live', 'polite')

  copy.addEventListener('click', async () => {
    status.textContent = t('saves.busy')
    const text = await encodeSave(actions.current())
    try {
      await navigator.clipboard.writeText(text)
      status.textContent = t('saves.copied', { size: sizeOf(text) })
    } catch {
      // No clipboard (an old browser or a blocked permission): hand over the code to copy by hand.
      box.value = text
      box.select()
      status.textContent = t('saves.copyBox')
    }
  })
  twoTap(load, loadWords, t('saves.loadConfirm', { n: actions.slot }), async () => {
    loadStatus.textContent = t('saves.busy')
    const got = await decodeSave(box.value)
    if (!got.ok) {
      loadStatus.textContent = t(`saves.error.${got.error}` as StringKey)
      load.textContent = loadWords
      load.classList.remove('is-armed')
      return
    }
    await actions.load(got.save)
  })

  code.append(el('h3', 'save-code-title', t('saves.codeTitle')), el('p', 'shop-note', t('saves.codeNote')), copy, status, boxLabel, box, load, loadStatus)
  body.append(code)
  sheet.open()
}
