import { useEffect, useState } from 'react'
import type { Product } from './types'
import { IconBox } from './icons'

// id -> picture (data URL). Cached for the session so scrolling and tab changes never refetch.
const cache = new Map<number, string>()

export const invalidateImage = (id: number) => cache.delete(id)

/** Loads pictures for the given products in small batches; returns a lookup that is '' while loading or when there is none. */
export function useProductImages(products: Product[]): (id: number) => string {
  const [, bump] = useState(0)
  useEffect(() => {
    const need = products.filter((p) => p.has_image && !cache.has(p.id)).map((p) => p.id)
    if (!need.length) return
    let alive = true
    ;(async () => {
      for (let i = 0; i < need.length; i += 40) {
        const batch = need.slice(i, i + 40)
        const got = await window.api.productImages(batch).catch(() => ({}) as Record<number, string>)
        for (const id of batch) cache.set(id, got[id] ?? '')
        if (!alive) return
        bump((n) => n + 1)
      }
    })()
    return () => {
      alive = false
    }
  }, [products])
  return (id) => cache.get(id) ?? ''
}

/** The product picture, or a neutral default (a box) when the product has none. */
export function ProductThumb({ src, tint = 't0', small = false, name = '' }: { src?: string; tint?: string; small?: boolean; name?: string }) {
  const cls = `thumb ${small ? 'sm ' : ''}`
  if (src) {
    return (
      <div className={cls + 'has-img'}>
        <img src={src} alt={name} loading="lazy" draggable={false} />
      </div>
    )
  }
  return (
    <div className={cls + 'default ' + tint} role="img" aria-label={name ? `No picture for ${name}` : 'No picture'}>
      <IconBox style={{ width: small ? 22 : 40, height: small ? 22 : 40 }} strokeWidth={1.5} />
    </div>
  )
}
