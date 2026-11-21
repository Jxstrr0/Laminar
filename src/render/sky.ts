/**
 * A photographed sky behind a replay, lighting it too (PR 13az). The
 * flat theme colour stays until the picture has loaded, and if it never
 * does. Dark mode swaps in a dusk sky.
 */
import * as THREE from 'three'
import { pickSky, SKIES, type SkyId, type SkyMood } from '../data/skies'
import { currentTheme, onThemeChange, sceneColours } from './theme'

const loader = new THREE.TextureLoader()
const pictures = new Map<SkyId, Promise<THREE.Texture>>()

/** One sky picture, loaded once and shared by every replay. */
function picture(id: SkyId): Promise<THREE.Texture> {
  let p = pictures.get(id)
  if (!p) {
    p = loader.loadAsync(`${import.meta.env.BASE_URL}sky/${id}.jpg`).then((tex) => {
      tex.mapping = THREE.EquirectangularReflectionMapping
      tex.colorSpace = THREE.SRGBColorSpace
      return tex
    })
    // A failed load can be tried again by the next replay.
    p.catch(() => pictures.delete(id))
    pictures.set(id, p)
  }
  return p
}

/** What `?sky=` asks for while Kelbo tries the skies out. */
function trial(): string | null {
  try {
    return new URLSearchParams(location.search).get('sky')
  } catch {
    return null
  }
}

export interface SkyDome {
  /** Change the venue's kind of day (a lake replay after a road one). */
  setMood(mood: SkyMood): void
  dispose(): void
}

/**
 * Put a sky on `scene`: its picture as the background and the light, its
 * horizon as the fog's colour, the hemisphere light turned down so the
 * two don't add up to a glare, and the sun matched to it (low and warm at dusk).
 * `onChange` is called whenever what's shown changes, so a scene standing on a still frame can draw again.
 */
export function attachSky(renderer: THREE.WebGLRenderer, scene: THREE.Scene, fog: THREE.Fog, hemi: THREE.HemisphereLight, sun: THREE.DirectionalLight, mood: SkyMood, onChange: () => void): SkyDome {
  const flat = new THREE.Color(sceneColours().fieldSky)
  const hemiFull = hemi.intensity
  const sunFull = sun.intensity
  const sunWhite = sun.color.clone()
  const pmrem = new THREE.PMREMGenerator(renderer)
  let lit: THREE.WebGLRenderTarget | null = null
  let current: SkyMood = mood
  let wanted: SkyId | null = null
  let disposed = false

  function showFlat() {
    flat.setHex(sceneColours().fieldSky)
    scene.background = flat
    scene.environment = null
    fog.color.copy(flat)
    hemi.intensity = hemiFull
    sun.intensity = sunFull
    sun.color.copy(sunWhite)
    onChange()
  }

  function apply() {
    const id = pickSky(currentTheme() === 'dark' ? 'dusk' : current, trial())
    wanted = id
    if (!id) {
      showFlat()
      return
    }
    picture(id).then(
      (tex) => {
        if (disposed || wanted !== id) return
        const sky = SKIES[id]
        lit?.dispose()
        lit = pmrem.fromEquirectangular(tex)
        scene.background = tex
        scene.environment = lit.texture
        scene.environmentIntensity = sky.light
        // Turn the picture so its sun sits where the venue's own sun light comes from.
        scene.backgroundRotation.set(0, THREE.MathUtils.degToRad(sky.sunAt) - Math.atan2(sun.position.z, sun.position.x), 0)
        scene.environmentRotation.copy(scene.backgroundRotation)
        fog.color.setHex(sky.horizon)
        hemi.intensity = hemiFull * sky.hemi
        sun.intensity = sunFull * sky.sun
        sun.color.setHex(sky.sunColour)
        onChange()
      },
      () => undefined,
    )
  }

  showFlat()
  apply()
  const stop = onThemeChange(() => {
    showFlat()
    apply()
  })

  return {
    setMood(next) {
      if (next === current) return
      current = next
      apply()
    },
    dispose() {
      disposed = true
      stop()
      lit?.dispose()
      pmrem.dispose()
      // The pictures stay cached for the next replay.
      if (scene.background instanceof THREE.Texture) scene.background = null
      scene.environment = null
    },
  }
}
