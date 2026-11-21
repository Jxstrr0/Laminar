/**
 * The Credits sheet (PR 13c): the studio block, then everyone whose work is in
 * the game. The studio block is a studio piece, so it wears the Longlight
 * colours, the official logo file and Space Grotesk; the rest is Laminar's own.
 * Adapted from a retired Longlight game, src/ui/creditsSheet.ts (17 Nov 2026).
 */
import { FONTS, LIBRARIES, STUDIO_LOGO, STUDIO_URL, type Credit } from '../data/credits'
import { offlineState } from '../pwa/register'
import { t } from '../data/strings'
import { createSheet, type Sheet } from './sheet'

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = cls
  if (text !== undefined) node.textContent = text
  return node
}

/** One line for a font or a library. */
export function creditLine(c: Credit): string {
  return t('credits.line', { name: c.name, by: c.by, licence: c.licence })
}

let sheet: Sheet | null = null

export function openCredits(): void {
  if (!sheet) {
    sheet = createSheet({ cls: 'credits', title: t('credits.title'), closeLabel: t('credits.close') })
    const list = (lines: readonly string[]) => {
      const ul = el('ul', 'credits-list')
      for (const line of lines) ul.append(el('li', '', line))
      return ul
    }
    const head = (key: Parameters<typeof t>[0]) => el('h3', 'credits-head', t(key))
    const note = (key: Parameters<typeof t>[0]) => el('p', 'credits-note', t(key))

    const studio = el('div', 'credits-studio')
    const logo = el('img', 'credits-logo')
    logo.src = STUDIO_LOGO.src
    logo.width = STUDIO_LOGO.width
    logo.height = STUDIO_LOGO.height
    logo.alt = t('credits.studioName')
    const site = el('a', 'credits-site', t('credits.site'))
    site.href = STUDIO_URL
    site.target = '_blank'
    site.rel = 'noopener'
    studio.append(logo, el('p', 'credits-game', t('credits.game')), el('p', 'credits-copy', t('studio.credit')), site)

    sheet.body.append(
      studio,
      head('credits.fonts'),
      list(FONTS.map(creditLine)),
      head('credits.code'),
      list(LIBRARIES.map(creditLine)),
      head('credits.art'),
      note('credits.artNote'),
      head('credits.sound'),
      note('credits.soundNote'),
      head('credits.setting'),
      note('credits.settingNote'),
      el('p', 'credits-note', t(`offline.${offlineState()}`)),
      el('p', 'credits-note version', `v${__GAME_VERSION__} · ${__BUILD_SHA__} · ${__BUILD_DATE__}`),
    )
  }
  sheet.open()
}
