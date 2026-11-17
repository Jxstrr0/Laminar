/**
 * The Saves sheet (plan section 13): three career slots, a new career in
 * any of them, and save codes to carry a career to another phone.
 * Switching careers reloads the page, so every screen starts clean from the
 * new save. A backup file (PR 7h) holds the same save code as a text file.
 */
import { t, type StringKey } from '../data/strings'
import { decodeSave, encodeSave } from '../persist/code'
import { decodeChallenge, findChallengeCode } from '../persist/designCode'
import { readSlot, SLOTS } from '../persist/db'
import { parseSave, type SaveFile } from '../persist/save'
import { createSheet, type Sheet } from './sheet'
import { twoTap } from './twoTap'
import { rubles } from './format'
import { backupDue, backupFileName, downloadText, markBackedUp, readMarks } from '../persist/backup'

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
  /** A backup was just made (a file saved or the code copied). */
  backedUp(): void
  /** Open a friend's challenge (PR 11i): a practice copy, outside this career. */
  openChallenge(code: string): Promise<void>
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

const savedAt = (ms: number) =>
  new Date(ms).toLocaleString('en-CA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const sizeOf = (text: string) => (text.length < 1024 ? `${text.length} B` : `${Math.round(text.length / 1024)} KB`)

let sheet: Sheet | null = null

export async function openSaves(actions: SavesActions): Promise<void> {
  sheet ??= createSheet({ cls: 'saves', title: t('saves.title'), closeLabel: t('saves.close') })
  const body = sheet.body
  body.replaceChildren(el('p', 'shop-intro', t('saves.intro')))
  if (backupDue(Date.now(), readMarks())) body.append(el('p', 'save-due', t('backup.due')))

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
      ? t(runs === 1 ? 'saves.summaryOne' : 'saves.summary', { runs, money: rubles(shown.career.money), when: savedAt(shown.savedAt) })
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

  const backedUp = () => {
    markBackedUp(Date.now())
    actions.backedUp()
    showLast()
  }
  copy.addEventListener('click', async () => {
    status.textContent = t('saves.busy')
    const text = await encodeSave(actions.current())
    try {
      await navigator.clipboard.writeText(text)
      status.textContent = t('saves.copied', { size: sizeOf(text) })
      backedUp()
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

  // A backup file to restore from: its code goes in the box, ready for Load.
  const file = el('input', 'save-file')
  file.type = 'file'
  file.accept = '.txt,text/plain'
  file.id = 'save-file'
  const fileLabel = el('label', 'save-btn quiet save-file-label', t('backup.restore'))
  fileLabel.htmlFor = file.id
  file.addEventListener('change', async () => {
    const picked = file.files?.[0]
    file.value = ''
    if (!picked) return
    box.value = (await picked.text().catch(() => '')).trim()
    loadStatus.textContent = box.value ? t('backup.read', { n: actions.slot }) : t('backup.unreadable')
  })

  code.append(
    el('h3', 'save-code-title', t('saves.codeTitle')),
    el('p', 'shop-note', t('saves.codeNote')),
    copy,
    status,
    boxLabel,
    box,
    fileLabel,
    file,
    load,
    loadStatus,
  )

  // Challenges (PR 11i): a friend's link or code opens their job as a practice copy.
  const challenge = el('div', 'save-code')
  const chBox = el('textarea', 'save-code-box')
  chBox.rows = 2
  chBox.spellcheck = false
  chBox.autocapitalize = 'off'
  chBox.setAttribute('autocorrect', 'off')
  chBox.placeholder = 'LAMD1:…'
  chBox.id = 'challenge-code-box'
  const chLabel = el('label', 'shop-label', t('chal.openLabel'))
  chLabel.htmlFor = chBox.id
  const chOpen = button('save-btn', t('chal.open'))
  const chStatus = el('p', 'shop-note')
  chStatus.setAttribute('aria-live', 'polite')
  chOpen.addEventListener('click', async () => {
    const found = findChallengeCode(chBox.value)
    if (!found) {
      chStatus.textContent = t('chal.error.prefix')
      return
    }
    chStatus.textContent = t('saves.busy')
    const got = await decodeChallenge(found)
    if (!got.ok) {
      chStatus.textContent = t(`chal.error.${got.error}` as StringKey)
      return
    }
    await actions.openChallenge(found)
  })
  challenge.append(el('h3', 'save-code-title', t('chal.openTitle')), el('p', 'shop-note', t('chal.openNote')), chLabel, chBox, chOpen, chStatus)

  // The backup file: the save code in a text file, saved to the phone's downloads.
  const backup = el('div', 'save-code')
  const last = el('p', 'shop-note')
  const showLast = () => {
    const at = readMarks().backedUpAt
    last.textContent = at ? t('backup.last', { when: savedAt(at) }) : t('backup.never')
  }
  showLast()
  const save = button('shop-order', t('backup.download'))
  const saveStatus = el('p', 'shop-note')
  saveStatus.setAttribute('aria-live', 'polite')
  save.addEventListener('click', async () => {
    saveStatus.textContent = t('saves.busy')
    const name = backupFileName(new Date())
    downloadText(name, await encodeSave(actions.current()))
    saveStatus.textContent = t('backup.saved', { name })
    backedUp()
  })
  backup.append(el('h3', 'save-code-title', t('backup.title')), el('p', 'shop-note', t('backup.note')), last, save, saveStatus)
  body.append(backup, code, challenge)
  sheet.open()
}
