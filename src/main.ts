import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/space-grotesk/latin-700.css'
import '@fontsource/instrument-sans/latin-400.css'
import '@fontsource/instrument-sans/latin-600.css'
import '@fontsource/instrument-sans/latin-700.css'
import '@fontsource/spline-sans-mono/latin-400.css'
import '@fontsource/spline-sans-mono/latin-500.css'
import './style.css'
import { t } from './data/strings'
import { bindGlossary } from './ui/glossary'
import { bindLoadingScreen } from './ui/loading'
import { designStore } from './ui/designStore'
import { newLab } from './sim/lab'
import { startAutosave } from './persist/autosave'
import { readSlot, writeSlot } from './persist/db'
import { parseSave, SAVE_VERSION } from './persist/save'

/** One career slot until the Saves sheet arrives (PR 5b). */
const SLOT = 1

const loading = bindLoadingScreen()

/** Can this browser draw WebGL at all? */
function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

const SCREENS = ['shape', 'tunnel'] as const
type Screen = (typeof SCREENS)[number]

/** The screen named in the address (#shape or #tunnel), Shape by default. */
function screenFromHash(): Screen {
  const name = location.hash.slice(1)
  return (SCREENS as readonly string[]).includes(name) ? (name as Screen) : 'shape'
}

function screenHost(app: HTMLElement, name: Screen): HTMLElement {
  const host = document.createElement('div')
  host.className = 'screen'
  host.dataset.screen = name
  host.hidden = true
  app.append(host)
  return host
}

/** The Shape / Tunnel switch, top right. */
function buildNav(go: (s: Screen) => void): { root: HTMLElement; mark(s: Screen): void } {
  const root = document.createElement('nav')
  root.className = 'screen-nav'
  root.setAttribute('aria-label', t('nav.label'))
  const buttons = SCREENS.map((s) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'nav-button'
    b.textContent = t(`nav.${s}`)
    b.addEventListener('click', () => go(s))
    root.append(b)
    return b
  })
  return {
    root,
    mark(s) {
      buttons.forEach((b, i) => b.setAttribute('aria-current', SCREENS[i] === s ? 'page' : 'false'))
    },
  }
}

async function boot(): Promise<void> {
  const app = document.getElementById('app')
  if (!app) throw new Error('missing #app')
  if (!hasWebGL()) {
    loading.fail(t('boot.noGl'))
    return
  }
  loading.progress(0.2)
  // Pick up where the last visit left off. A save that can't be trusted is left alone, unread.
  const saved = parseSave(await readSlot(SLOT).catch(() => null))
  if (saved) designStore.set(saved.design)
  loading.progress(0.3)
  // three.js and the scenes load as their own chunks.
  const [{ createTunnelView }, { startTunnelScreen }, { createShapeView }, { startShapeScreen }] = await Promise.all([
    import('./render/tunnelScene'),
    import('./ui/tunnelScreen'),
    import('./render/shapeScene'),
    import('./ui/shapeScreen'),
  ])
  loading.progress(0.9)
  const shapeHost = screenHost(app, 'shape')
  const tunnelHost = screenHost(app, 'tunnel')
  // The tunnel calls back when something worth keeping changes; so does the design.
  let touch = () => {}
  const tunnel = startTunnelScreen(tunnelHost, createTunnelView(tunnelHost), saved?.lab ?? newLab(), () => touch())
  const autosave = startAutosave(
    () => ({ v: SAVE_VERSION, savedAt: Date.now(), design: designStore.get(), lab: tunnel.lab() }),
    (text) => writeSlot(SLOT, text),
  )
  touch = () => autosave.touch()
  designStore.subscribe(() => touch())
  const screens: Record<Screen, { host: HTMLElement; control: { setActive(on: boolean): void } }> = {
    shape: { host: shapeHost, control: startShapeScreen(shapeHost, createShapeView(shapeHost)) },
    tunnel: { host: tunnelHost, control: tunnel },
  }
  // Any element marked data-g on any screen opens its glossary entry.
  bindGlossary(app)
  const nav = buildNav((s) => show(s))
  app.append(nav.root)
  const show = (screen: Screen) => {
    for (const k of SCREENS) {
      screens[k].host.hidden = k !== screen
      screens[k].control.setActive(k === screen)
    }
    nav.mark(screen)
    if (location.hash !== `#${screen}`) history.replaceState(null, '', `#${screen}`)
  }
  window.addEventListener('hashchange', () => show(screenFromHash()))
  show(screenFromHash())
  loading.done()
}

boot().catch((err: unknown) => {
  console.error(err)
  loading.fail(t('boot.fail'))
})
