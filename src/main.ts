import '@fontsource/space-grotesk/latin-500.css'
import '@fontsource/space-grotesk/latin-700.css'
import '@fontsource/instrument-sans/latin-400.css'
import '@fontsource/instrument-sans/latin-600.css'
import '@fontsource/instrument-sans/latin-700.css'
import '@fontsource/spline-sans-mono/latin-400.css'
import '@fontsource/spline-sans-mono/latin-500.css'
import './style.css'
import { t } from './data/strings'
import { bindLoadingScreen } from './ui/loading'

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

async function boot(): Promise<void> {
  const app = document.getElementById('app')
  if (!app) throw new Error('missing #app')
  if (!hasWebGL()) {
    loading.fail(t('boot.noGl'))
    return
  }
  loading.progress(0.3)
  // three.js and the scene load as their own chunks.
  const [{ createTunnelView }, { startTunnelScreen }] = await Promise.all([
    import('./render/tunnelScene'),
    import('./ui/tunnelScreen'),
  ])
  loading.progress(0.9)
  const view = createTunnelView(app)
  startTunnelScreen(app, view)
  loading.done()
}

boot().catch((err: unknown) => {
  console.error(err)
  loading.fail(t('boot.fail'))
})
