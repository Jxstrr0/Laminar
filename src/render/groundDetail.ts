/**
 * The replays' ground detail (PR 13az): one shared greyscale texture per
 * kind of surface, tiled by the metre. Flat until it has loaded.
 */
import * as THREE from 'three'
import { GROUND_TILE, type GroundKind } from '../data/ground'

const loader = new THREE.TextureLoader()
const textures = new Map<GroundKind, { tex: THREE.Texture; loaded: Promise<void> }>()

/** The detail texture for a surface, shared by every replay; it fills in once loaded, and `onLoad` is called then (PR 13bc: a still frame draws again). */
export function groundDetail(kind: GroundKind, renderer: THREE.WebGLRenderer, onLoad?: () => void): THREE.Texture {
  let entry = textures.get(kind)
  if (!entry) {
    let landed: () => void = () => undefined
    const loaded = new Promise<void>((resolve) => (landed = resolve))
    const fresh = loader.load(`${import.meta.env.BASE_URL}tex/${kind}.jpg`, () => landed())
    // The values are multipliers on the venue's colour, not colours of their own.
    fresh.colorSpace = THREE.NoColorSpace
    fresh.wrapS = fresh.wrapT = THREE.RepeatWrapping
    fresh.repeat.setScalar(1 / GROUND_TILE[kind])
    entry = { tex: fresh, loaded }
    textures.set(kind, entry)
  }
  const tex = entry.tex
  if (onLoad) void entry.loaded.then(onLoad)
  // Sharp at a low angle, as the chase camera sees the road.
  tex.anisotropy = Math.max(tex.anisotropy, Math.min(8, renderer.capabilities.getMaxAnisotropy()))
  return tex
}

/** A flat w × h plane whose texture coordinates are in metres, so a texture tiles at its own size. */
export function metrePlane(w: number, h: number): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(w, h)
  const uv = geo.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h)
  return geo
}
