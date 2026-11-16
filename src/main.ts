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
import { lastSlot, readSlot, setLastSlot, writeSlot } from './persist/db'
import { packSave, parseSave, SAVE_VERSION, type SaveFile } from './persist/save'
import { DEFAULT_CYCLIST } from './data/cyclist'
import { careerStore, freshSeed } from './ui/careerStore'
import { charge, currentEvent, newCareer, orderBlock, orderModel } from './sim/career'
import { afterDesign, afterOrder, afterRun, afterSwap, currentStep } from './sim/guide'
import { runCost } from './sim/run'
import { rublesShort } from './ui/format'

/** The career slot in play: the one used last visit. */
const SLOT = lastSlot()

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

const SCREENS = ['board', 'shape', 'tunnel'] as const
type Screen = (typeof SCREENS)[number]

/** The screen named in the address (#board, #shape or #tunnel), Jobs by default. */
function screenFromHash(): Screen {
  const name = location.hash.slice(1)
  return (SCREENS as readonly string[]).includes(name) ? (name as Screen) : 'board'
}

function screenHost(app: HTMLElement, name: Screen): HTMLElement {
  const host = document.createElement('div')
  host.className = 'screen'
  host.dataset.screen = name
  host.hidden = true
  app.append(host)
  return host
}

/** The Jobs / Shape / Tunnel switch, top right. */
function buildNav(go: (s: Screen) => void): { root: HTMLElement; mark(s: Screen): void } {
  const root = document.createElement('nav')
  root.className = 'screen-nav'
  root.setAttribute('aria-label', t('nav.label'))
  const buttons = SCREENS.map((s) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'nav-button'
    b.dataset.screen = s
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
  if (saved) {
    designStore.set(saved.design)
    careerStore.set(saved.career)
  } else careerStore.set(newCareer(freshSeed()))
  loading.progress(0.3)
  // three.js and the scenes load as their own chunks.
  const [{ createTunnelView }, { startTunnelScreen }, { createShapeView }, { startShapeScreen }, { startBoardScreen }] = await Promise.all([
    import('./render/tunnelScene'),
    import('./ui/tunnelScreen'),
    import('./render/shapeScene'),
    import('./ui/shapeScreen'),
    import('./ui/boardScreen'),
  ])
  loading.progress(0.9)
  const boardHost = screenHost(app, 'board')
  const shapeHost = screenHost(app, 'shape')
  const tunnelHost = screenHost(app, 'tunnel')
  // The tunnel calls back when something worth keeping changes; so do the design and the career.
  let touch = () => {}
  const tunnel = startTunnelScreen(tunnelHost, createTunnelView(tunnelHost), saved?.lab ?? newLab(), {
    onChange: () => touch(),
    onRun: (run) => careerStore.set(afterRun(charge(careerStore.get(), runCost(run)))),
    tunnelSeed: careerStore.get().seed,
    event: () => currentEvent(careerStore.get()),
    shop: () => {
      const career = careerStore.get()
      return { event: currentEvent(career), block: (days) => orderBlock(career, days), daysLeft: career.job?.daysLeft ?? 0 }
    },
    onOrder: (price, days) => careerStore.set(afterOrder(orderModel(careerStore.get(), price, days))),
    onSwap: (price) => careerStore.set(afterSwap(charge(careerStore.get(), price))),
  })
  const autosave = startAutosave(
    () => current(),
    (text) => writeSlot(SLOT, text),
  )
  touch = () => autosave.touch()
  designStore.subscribe(() => {
    touch()
    // Shaping a new position ticks the first-job guide.
    const career = careerStore.get()
    const next = afterDesign(career, designStore.get())
    if (next !== career) careerStore.set(next)
  })
  careerStore.subscribe(() => touch())
  // The guide's next step lights up the buttons that do it (style.css, [data-guide]).
  const markGuide = () => {
    const step = currentStep(careerStore.get())
    if (step) document.body.dataset.guide = step
    else delete document.body.dataset.guide
  }
  markGuide()
  careerStore.subscribe(markGuide)
  const current = (): SaveFile => ({
    v: SAVE_VERSION,
    savedAt: Date.now(),
    design: designStore.get(),
    lab: tunnel.lab(),
    career: careerStore.get(),
  })
  /** Leave this career for another: save it, stop saving, then reload into the new one. */
  const leaveFor = async (slot: number, write?: SaveFile) => {
    await autosave.flush()
    autosave.stop()
    if (write) await writeSlot(slot, packSave(write))
    setLastSlot(slot)
    location.reload()
  }
  const savesBtn = document.createElement('button')
  savesBtn.type = 'button'
  savesBtn.className = 'chip saves-open'
  savesBtn.textContent = t('saves.open')
  savesBtn.setAttribute('aria-label', t('saves.openName'))
  savesBtn.addEventListener('click', async () => {
    const { openSaves } = await import('./ui/savesSheet')
    await openSaves({
      slot: SLOT,
      current,
      switchTo: (slot) => leaveFor(slot),
      startOver: (slot) =>
        leaveFor(slot, {
          v: SAVE_VERSION,
          savedAt: Date.now(),
          design: structuredClone(DEFAULT_CYCLIST),
          lab: newLab(),
          career: newCareer(freshSeed()),
        }),
      load: (save) => leaveFor(SLOT, { ...save, savedAt: Date.now() }),
    })
  })
  // The firm's money and the job's days, beside Saves; a tap opens Jobs.
  const jobChip = document.createElement('button')
  jobChip.type = 'button'
  jobChip.className = 'chip job-chip'
  const showJob = () => {
    const career = careerStore.get()
    const money = rublesShort(career.money)
    const days = career.job?.daysLeft
    jobChip.textContent = days === undefined ? t('job.chipIdle', { money }) : t('job.chip', { money, days })
    jobChip.setAttribute('aria-label', days === undefined ? t('job.chipIdleName', { money }) : t('job.chipName', { money, days }))
    jobChip.classList.toggle('over', career.money < 0)
  }
  showJob()
  careerStore.subscribe(showJob)
  jobChip.addEventListener('click', () => show('board'))
  const chips = document.createElement('div')
  chips.className = 'top-chips'
  chips.append(jobChip, savesBtn)
  app.append(chips)
  const screens: Record<Screen, { host: HTMLElement; control: { setActive(on: boolean): void } }> = {
    board: { host: boardHost, control: startBoardScreen(boardHost, (s) => show(s)) },
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
