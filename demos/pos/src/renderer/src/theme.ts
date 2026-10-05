export type Theme = 'system' | 'light' | 'dark'

const KEY = 'pos-theme'

export function getTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY)
    if (t === 'light' || t === 'dark') return t
  } catch {}
  return 'system'
}

export function applyTheme(t: Theme) {
  const root = document.documentElement
  if (t === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', t)
  try {
    localStorage.setItem(KEY, t)
  } catch {}
  window.dispatchEvent(new CustomEvent<Theme>('pos-theme', { detail: t }))
}

/** Calls fn whenever the theme is changed anywhere in the app. Returns an unsubscribe function. */
export function onThemeChange(fn: (t: Theme) => void) {
  const h = (e: Event) => fn((e as CustomEvent<Theme>).detail)
  window.addEventListener('pos-theme', h)
  return () => window.removeEventListener('pos-theme', h)
}
