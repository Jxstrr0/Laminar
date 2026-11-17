/**
 * Challenges on screen (PR 11i): the card at the top of Jobs in a practice
 * copy, the result against the sender's CdA in the debrief, and, in a real
 * career, a "Challenge a friend" button after a rider's or skater's job.
 * The codes themselves are in src/persist/designCode.ts.
 */
import { t } from '../data/strings'
import type { Design } from '../data/sport'
import { challengeLink, encodeChallenge } from '../persist/designCode'
import { briefTemplate, firmName, type CareerState, type Delivery } from '../sim/career'
import { challengeable, challengeOutcome } from '../sim/challenge'
import { challengeStore } from './challengeStore'
import { fixed } from './format'

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

/** The page without its challenge: the player's own game. */
const home = () => location.assign(location.pathname)

/** The challenge card for the top of Jobs, or null outside a challenge. */
export function challengeCard(): HTMLElement | null {
  const active = challengeStore.get()
  if (!active) return null
  const { challenge: c, target } = active
  const b = briefTemplate(c.brief.id)!
  const card = el('section', 'job-card challenge-card')
  card.setAttribute('aria-labelledby', 'challenge-title')
  const head = el('h2', 'board-heading', t('chal.title', { firm: c.firm }))
  head.id = 'challenge-title'
  const back = button('save-btn quiet', t('chal.home'))
  back.addEventListener('click', home)
  card.append(
    head,
    el('p', 'job-goal', t('chal.intro', { target: fixed(target, 3), event: b.event.name, client: b.client })),
    el('p', 'shop-note', t('chal.practice')),
    back,
  )
  return card
}

/**
 * What a rider's or skater's debrief adds: in a challenge, how the CdA on
 * the day did against the sender's; in a real career, a link to send.
 */
export function challengeParts(d: Delivery, design: Design): HTMLElement[] {
  const active = challengeStore.get()
  if (active) {
    const { challenge: c, target } = active
    // Only the challenge's own job is judged; later jobs in the practice copy are just practice.
    if (d.job.brief.id !== c.brief.id || d.job.brief.seed !== c.brief.seed) return []
    const mine = d.debrief.actual
    const outcome = challengeOutcome(target, mine)
    const pct = fixed(Math.abs(1 - mine / target) * 100, 1)
    const box = el('section', `race-record challenge-result is-${outcome}`)
    const again = button('save-btn', t('chal.again'))
    again.addEventListener('click', () => location.reload())
    const back = button('save-btn quiet', t('chal.home'))
    back.addEventListener('click', home)
    const actions = el('div', 'job-actions')
    actions.append(again, back)
    box.append(el('p', 'race-verdict', t(`chal.${outcome}`, { firm: c.firm, mine: fixed(mine, 3), target: fixed(target, 3), pct })), actions)
    return [box]
  }
  if (!challengeable(d.job.brief.id)) return []
  return [shareBox(d, design, d.state)]
}

/** "Challenge a friend": copies a link carrying this job and the design delivered. */
function shareBox(d: Delivery, design: Design, after: CareerState): HTMLElement {
  const box = el('div', 'race-trouble challenge-share')
  const share = button('save-btn', t('chal.share'))
  const status = el('p', 'shop-note')
  status.setAttribute('aria-live', 'polite')
  const field = el('textarea', 'save-code-box')
  field.rows = 2
  field.readOnly = true
  field.hidden = true
  field.setAttribute('aria-label', t('chal.share'))
  share.addEventListener('click', async () => {
    const code = await encodeChallenge({ brief: d.job.brief, seed: after.seed, day: d.job.startDay, design, firm: firmName(after) })
    const link = challengeLink(`${location.origin}${location.pathname}`, code)
    try {
      await navigator.clipboard.writeText(link)
      status.textContent = t('chal.copied')
    } catch {
      // No clipboard: the link goes in a box to copy by hand.
      field.hidden = false
      field.value = link
      field.select()
      status.textContent = t('chal.copyBox')
    }
  })
  box.append(el('p', 'race-trouble-text', t('chal.shareNote', { cda: fixed(d.debrief.actual, 3) })), share, status, field)
  return box
}
