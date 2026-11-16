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
import { DEFAULT_JUMPER } from './data/jumper'
import { DEFAULT_BOBSLED } from './data/bobsled'
import { DEFAULT_TRUCK } from './data/truck'
import { STOCK_CAR } from './data/car'
import { STOCK_RECORD } from './data/record'
import { STOCK_DRONE } from './data/drone'
import { STOCK_PLANE } from './data/plane'
import { STOCK_AIRCRAFT } from './data/aircraft'
import { STOCK_POD } from './data/pod'
import type { Design } from './data/sport'
import { careerStore, freshSeed } from './ui/careerStore'
import { charge, currentAircraftRun, currentCarRun, currentDroneRun, currentPlaneRun, currentRecordRun, currentEvent, currentJumpEvent, currentSledEvent, currentTruckRun, newCareer, orderBlock, orderModel, repairModel } from './sim/career'
import { makersOwned, tunnelSetup } from './sim/facility'
import { crewEffects } from './sim/staff'
import { afterDesign, afterOrder, afterRun, afterSwap, currentStep } from './sim/guide'
import { runCost } from './sim/run'
import { rublesShort } from './ui/format'
import { askToKeepStorage, backupDue, noteFirstSeen, readMarks } from './persist/backup'

/** The career slot in play: the one used last visit. */
const SLOT = lastSlot()

/**
 * A preview of a sport before its jobs arrive (PR 8d): `?try=skijump` puts a
 * ski jumper on the bench in a fresh, throwaway career (`?try=bobsled` and
 * `?try=bobsled4` a two- or four-man sled, PR 8m). Nothing is read from
 * or written to the save slots, so a real career is never touched.
 */
const PREVIEWS: Record<string, Design> = {
  skijump: DEFAULT_JUMPER,
  bobsled: DEFAULT_BOBSLED,
  bobsled4: { ...DEFAULT_BOBSLED, crew: 4 as const },
  truck: DEFAULT_TRUCK,
  // Racing cars (PR 9j): a touring car, and `?try=car-open` a single-seater.
  car: STOCK_CAR.touring,
  'car-open': STOCK_CAR.open,
  // The land-speed streamliner (PR 9q), and `?try=jet` the jet car (PR 9x).
  record: STOCK_RECORD.streamliner,
  jet: STOCK_RECORD.jet,
  // The racing quad (PR 10b).
  quad: STOCK_DRONE.racer,
  // The survey drone (PR 10j).
  plane: STOCK_PLANE.survey,
  // The light aircraft (PR 10q).
  aircraft: STOCK_AIRCRAFT.kit,
  // The patrol plane's sensor pod (PR 10z).
  pod: STOCK_POD.patrol,
}
const PREVIEW_DESIGN = PREVIEWS[new URLSearchParams(location.search).get('try') ?? ''] ?? null
const PREVIEW = PREVIEW_DESIGN !== null

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
  const saved = PREVIEW ? null : parseSave(await readSlot(SLOT).catch(() => null))
  if (PREVIEW_DESIGN) {
    designStore.set(structuredClone(PREVIEW_DESIGN))
    careerStore.set(newCareer(freshSeed()))
  } else if (saved) {
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
  const tunnel = startTunnelScreen(tunnelHost, createTunnelView(tunnelHost), saved?.lab ?? newLab(PREVIEW_DESIGN ?? undefined), {
    onChange: () => touch(),
    onRun: (run) => careerStore.set(afterRun(charge(careerStore.get(), runCost(run)))),
    tunnelSeed: careerStore.get().seed,
    tunnel: () => {
      const career = careerStore.get()
      return tunnelSetup(career.seed, career.facility, career.day, career.crew)
    },
    event: () => currentEvent(careerStore.get()),
    // A jumper is forecast on the job's hill and day, or the practice jump between jobs.
    jumpEvent: () => currentJumpEvent(careerStore.get()),
    // A sled is forecast on the job's track, or Belogor between jobs.
    sledRace: () => currentSledEvent(careerStore.get()),
    // A truck is forecast on the job's route against the fleet's own truck, or the Mostograd run between jobs.
    truckRun: (trailerTop) => currentTruckRun(careerStore.get(), trailerTop),
    // A car is forecast at the job's circuit against the team's own car, or the Dolgo Ring between jobs.
    carRun: (cls) => currentCarRun(careerStore.get(), cls),
    recordRun: (cls) => currentRecordRun(careerStore.get(), cls),
    // A quad is forecast on the club's course against their own quad (PR 10d).
    droneRun: (cls) => currentDroneRun(careerStore.get(), cls),
    // A survey drone is forecast at the client's site against their own plane (PR 10l).
    planeRun: (cls) => currentPlaneRun(careerStore.get(), cls),
    aircraftRun: (cls) => currentAircraftRun(careerStore.get(), cls),
    shop: () => {
      const career = careerStore.get()
      return {
        event: currentEvent(career),
        block: (days) => orderBlock(career, days),
        daysLeft: career.job?.daysLeft ?? 0,
        topSpeed: tunnelSetup(career.seed, career.facility, career.day).build.topSpeed,
        makers: makersOwned(career.facility),
        hand: crewEffects(career.crew),
      }
    },
    onOrder: (price, days) => careerStore.set(afterOrder(orderModel(careerStore.get(), price, days))),
    onSwap: (price) => careerStore.set(afterSwap(charge(careerStore.get(), price))),
    onRepair: (price, days) => {
      const before = careerStore.get()
      if (orderBlock(before, days) === 'noDays') return false
      careerStore.set(repairModel(before, price, days))
      return true
    },
    goFix: (where) => {
      show('shape')
      window.dispatchEvent(new CustomEvent('laminar:fix', { detail: where }))
    },
  })
  const autosave = startAutosave(
    () => current(),
    // A preview writes nowhere.
    (text) => (PREVIEW ? Promise.resolve(true) : writeSlot(SLOT, text)),
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
  // After two weeks without a backup, the chip asks for one.
  const showSavesChip = () => {
    const due = backupDue(Date.now(), readMarks())
    savesBtn.textContent = t(due ? 'saves.openDue' : 'saves.open')
    savesBtn.setAttribute('aria-label', t(due ? 'saves.openDueName' : 'saves.openName'))
    savesBtn.classList.toggle('due', due)
  }
  noteFirstSeen(Date.now())
  showSavesChip()
  void askToKeepStorage()
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
      backedUp: showSavesChip,
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
  if (PREVIEW) {
    // In a preview the Saves sheet is out of reach; this chip says so, and a tap goes back to the real game.
    const previewChip = document.createElement('button')
    previewChip.type = 'button'
    previewChip.className = 'chip preview-chip'
    previewChip.textContent = t('preview.chip')
    previewChip.setAttribute('aria-label', t('preview.chipName'))
    previewChip.addEventListener('click', () => location.assign(location.pathname))
    savesBtn.replaceWith(previewChip)
  }
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
