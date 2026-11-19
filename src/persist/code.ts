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

/**
 * Size limits for a pasted code. A code can come from anyone, and a small one
 * can be built to unpack to gigabytes and freeze the phone, so reading stops
 * at these sizes and the code is called damaged. Both are far above any real
 * career: the longest save the game can make is a few megabytes of text.
 */
export const CODE_LIMITS = {
  /** Longest code that is looked at, in characters. */
  maxCodeChars: 24_000_000,
  /** Most a code may unpack to, in bytes. */
  maxTextBytes: 64_000_000,
}

const canSqueeze = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined'

/**
 * Run bytes through a squeeze or unsqueeze stream. With a `limit`, reading
 * stops (and this throws) as soon as more than that many bytes have come out,
 * so the rest is never unpacked.
 */
async function through(bytes: Uint8Array, stream: CompressionStream | DecompressionStream, limit = Infinity): Promise<Uint8Array> {
  const reader = (new Blob([bytes as BlobPart]).stream().pipeThrough(stream) as ReadableStream<Uint8Array>).getReader()
  const parts: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > limit) {
      await reader.cancel()
      throw new Error('unpacks to more than the limit')
    }
    parts.push(value)
  }
  const out = new Uint8Array(size)
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
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

/** Why a code couldn't be read. */
export type WrapError = 'prefix' | 'check' | 'damaged'

/**
 * Wrap text as a code: `<prefix><flag><body>.<check>`, the body deflated
 * where the browser can. Save codes and design codes (PR 11h) both use it.
 */
export async function wrapText(prefix: string, text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const squeeze = canSqueeze()
  const body = squeeze ? await through(bytes, new CompressionStream('deflate-raw')) : bytes
  const head = `${prefix}${squeeze ? 'z' : 'p'}${toBase64Url(body)}`
  return `${head}.${check(head)}`
}

/** The text inside a code, or why it can't be read. `limits` defaults to CODE_LIMITS. */
export async function unwrapText(
  prefix: string,
  input: string,
  limits: { maxCodeChars: number; maxTextBytes: number } = CODE_LIMITS,
): Promise<{ ok: true; text: string } | { ok: false; error: WrapError }> {
  // Too long to be a code at all: don't even tidy it.
  if (input.length > limits.maxCodeChars) return { ok: false, error: 'damaged' }
  // Phones and chat apps add line breaks and spaces when a long code is pasted.
  const code = input.replace(/\s+/g, '')
  if (!code.startsWith(prefix)) return { ok: false, error: 'prefix' }
  const dot = code.lastIndexOf('.')
  if (dot < 0 || check(code.slice(0, dot)) !== code.slice(dot + 1)) return { ok: false, error: 'check' }
  const flag = code[prefix.length]
  try {
    const bytes = fromBase64Url(code.slice(prefix.length + 1, dot))
    if (flag === 'z') {
      if (!canSqueeze()) return { ok: false, error: 'damaged' }
      return { ok: true, text: new TextDecoder().decode(await through(bytes, new DecompressionStream('deflate-raw'), limits.maxTextBytes)) }
    }
    if (flag === 'p') return bytes.length > limits.maxTextBytes ? { ok: false, error: 'damaged' } : { ok: true, text: new TextDecoder().decode(bytes) }
    return { ok: false, error: 'damaged' }
  } catch {
    return { ok: false, error: 'damaged' }
  }
}

export async function encodeSave(save: SaveFile): Promise<string> {
  return wrapText(CODE_PREFIX, packSave(save))
}

export async function decodeSave(input: string): Promise<Decoded> {
  const open = await unwrapText(CODE_PREFIX, input)
  if (!open.ok) return open
  const text = open.text
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
