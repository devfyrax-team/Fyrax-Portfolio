import { Buffer } from './buffer'

// Demo stand-ins for node:crypto. PIN hashing here is NOT secure; the real app uses scrypt.
export function randomBytes(n: number) {
  const b = new Uint8Array(n)
  crypto.getRandomValues(b)
  return Buffer.from(b)
}

export function scryptSync(pin: string, salt: Uint8Array, len: number) {
  const out = new Uint8Array(len)
  let h = 2166136261
  const input = Buffer.concat([Buffer.from(String(pin)), Buffer.from(salt)])
  for (let i = 0; i < len; i++) {
    for (const byte of input) h = Math.imul(h ^ byte, 16777619) >>> 0
    h = Math.imul(h ^ (i + 1), 16777619) >>> 0
    out[i] = h & 255
  }
  return Buffer.from(out)
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]
  return d === 0
}
