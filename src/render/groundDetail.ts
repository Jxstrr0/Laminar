/**
 * The replays' ground detail (PR 13az): one shared greyscale texture per
 * kind of surface, tiled by the metre. Flat until it has loaded.
 */
import * as THREE from 'three'
import { GROUND_TILE, type GroundKind } from '../data/ground'

const loader = new THREE.TextureLoader()
const textures = new Map<GroundKind, THREE.Texture>()

/** The detail texture for a surface, shared by every replay; it fills in once loaded. */
export function groundDetail(kind: GroundKind, renderer: THREE.WebGLRenderer): THREE.Texture {
  let tex = textures.get(kind)
  if (!tex) {
    tex = loader.load(`${import.meta.env.BASE_URL}tex/${kind}.jpg`)
    // The values are multipliers on the venue's colour, not colours of their own.
    tex.colorSpace = THREE.NoColorSpace
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping
    tex.repeat.setScalar(1 / GROUND_TILE[kind])
    textures.set(kind, tex)
  }
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
