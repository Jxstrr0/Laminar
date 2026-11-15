/**
 * A button that asks for a second tap before something that can't be
 * undone, instead of a pop-up: the first tap changes its words for a few
 * seconds.
 */
export function twoTap(b: HTMLButtonElement, words: string, confirmWords: string, run: () => void): void {
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
