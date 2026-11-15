/**
 * Save codes (plan section 13): a whole career as one line of text, to copy
 * to another phone or keep somewhere safe.
 *
 *   LAM1:<flag><body>.<check>
 *
 * The body is the packed save file, squeezed with deflate where the browser
 * can (flag `z`) or left plain (flag `p`), in URL-safe base64. The check is
 * an FNV-1a hash of everything before it, in base 36, so a code that was
 * cut short or mistyped is caught before anything is loaded. Decoding never
 * leaves the device.
 */
import { hashString } from '../sim/rng'
import { packSave, parseSave, SAVE_VERSION, type SaveFile } from './save'

export const CODE_PREFIX = 'LAM1:'

export type CodeError = 'prefix' | 'check' | 'damaged' | 'newer'

export type Decoded = { ok: true; save: SaveFile } | { ok: false; error: CodeError }

const canSqueeze = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined'

async function through(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

const check = (text: string) => hashString(text).toString(36)

export async function encodeSave(save: SaveFile): Promise<string> {
  const bytes = new TextEncoder().encode(packSave(save))
  const squeeze = canSqueeze()
  const body = squeeze ? await through(bytes, new CompressionStream('deflate-raw')) : bytes
  const head = `${CODE_PREFIX}${squeeze ? 'z' : 'p'}${toBase64Url(body)}`
  return `${head}.${check(head)}`
}

export async function decodeSave(input: string): Promise<Decoded> {
  // Phones and chat apps add line breaks and spaces when a long code is pasted.
  const code = input.replace(/\s+/g, '')
  if (!code.startsWith(CODE_PREFIX)) return { ok: false, error: 'prefix' }
  const dot = code.lastIndexOf('.')
  if (dot < 0 || check(code.slice(0, dot)) !== code.slice(dot + 1)) return { ok: false, error: 'check' }
  const flag = code[CODE_PREFIX.length]
  let text: string
  try {
    const bytes = fromBase64Url(code.slice(CODE_PREFIX.length + 1, dot))
    if (flag === 'z') {
      if (!canSqueeze()) return { ok: false, error: 'damaged' }
      text = new TextDecoder().decode(await through(bytes, new DecompressionStream('deflate-raw')))
    } else if (flag === 'p') text = new TextDecoder().decode(bytes)
    else return { ok: false, error: 'damaged' }
  } catch {
    return { ok: false, error: 'damaged' }
  }
  const save = parseSave(text)
  if (save) return { ok: true, save }
  // A later Laminar's save: say so rather than calling it damaged.
  try {
    const v = (JSON.parse(text) as { v?: unknown }).v
    if (typeof v === 'number' && v > SAVE_VERSION) return { ok: false, error: 'newer' }
  } catch {
    // Not JSON at all.
  }
  return { ok: false, error: 'damaged' }
}
