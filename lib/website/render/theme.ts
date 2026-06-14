import type { CSSProperties } from 'react'
import type { ThemeTokens } from '../types'

/** Üretilen siteler için yazı ailesi eşleşmeleri (display/serif + temiz sans). */
export interface FontPairing { id: string; heading: string; body: string }

export const FONT_PAIRINGS: Record<string, FontPairing> = {
  modern: {
    id: 'modern',
    heading: "'Plus Jakarta Sans', system-ui, sans-serif",
    body: "'Plus Jakarta Sans', system-ui, sans-serif",
  },
  elegant: {
    id: 'elegant',
    heading: "'Fraunces', Georgia, serif",
    body: "'Plus Jakarta Sans', system-ui, sans-serif",
  },
  classic: {
    id: 'classic',
    heading: "'Playfair Display', Georgia, serif",
    body: "'Source Sans 3', system-ui, sans-serif",
  },
}

export const DEFAULT_FONT_PAIRING = FONT_PAIRINGS.elegant

/** Üretilen sitelerde yüklenen Google Fonts (tüm pairing fontları tek link). */
export const WEBSITE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&family=Source+Sans+3:wght@400;500;600&display=swap'

export const DEFAULT_SITE_THEME: Required<Pick<ThemeTokens, 'primaryColor'>> &
  Pick<ThemeTokens, 'secondaryColor' | 'fontHeading' | 'fontBody' | 'logoUrl'> = {
  primaryColor: '#0f172a', // ink (slate-900)
  secondaryColor: '#0f766e', // accent (teal-700) — markasız varsayılan, jenerik değil
  fontHeading: DEFAULT_FONT_PAIRING.heading,
  fontBody: DEFAULT_FONT_PAIRING.body,
  logoUrl: null,
}

/** Tema tokenlarını CSS değişkenlerine çevirir (renderer kökünde inline uygulanır). */
export function themeToCssVars(theme: ThemeTokens | null | undefined): CSSProperties {
  const t: Partial<ThemeTokens> = theme ?? {}
  const ink = t.primaryColor || DEFAULT_SITE_THEME.primaryColor
  const accent = t.secondaryColor || DEFAULT_SITE_THEME.secondaryColor || ink
  return {
    ['--site-ink' as string]: ink,
    ['--site-accent' as string]: accent,
    ['--site-font-heading' as string]: t.fontHeading || DEFAULT_SITE_THEME.fontHeading,
    ['--site-font-body' as string]: t.fontBody || DEFAULT_SITE_THEME.fontBody,
  }
}
