/**
 * The mute button (PR 13a): a speaker, with waves when the sound is on and a
 * cross when it's off. The choice is remembered (audio/engine.ts).
 */
import { t } from '../data/strings'
import { isMuted, onMuted, setMuted } from '../audio/engine'

const SPEAKER = '<path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor"/>'
const ON = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">${SPEAKER}<path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`
const OFF = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">${SPEAKER}<path d="M16 9l6 6M22 9l-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`

export function soundButton(): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'chip sound-chip'
  const show = (off: boolean) => {
    b.innerHTML = off ? OFF : ON
    b.setAttribute('aria-label', t(off ? 'sound.offName' : 'sound.onName'))
    b.title = t(off ? 'sound.offName' : 'sound.onName')
    b.classList.toggle('off', off)
  }
  show(isMuted())
  onMuted(show)
  b.addEventListener('click', () => setMuted(!isMuted()))
  return b
}
