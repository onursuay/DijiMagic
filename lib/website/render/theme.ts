import type { CSSProperties } from 'react'
import type { ThemeTokens } from '../types'

/** Üretilen siteler için yazı ailesi eşleşmeleri (gerçek Google Fonts). */
export interface FontPairing { id: string; label: string; heading: string; body: string; href: string }

const GF = 'https://fonts.googleapis.com/css2?'
const gfHref = (...fams: string[]) => `${GF}${fams.map((f) => `family=${f}`).join('&')}&display=swap`
const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif'
const SERIF = 'Georgia, "Times New Roman", serif'

/** hGf/bGf = Google Fonts css2 family parametresi (boşluk yerine +). */
function mk(
  id: string, label: string,
  hName: string, hGf: string, hSerif: boolean,
  bName: string, bGf: string, bSerif: boolean,
): FontPairing {
  return {
    id, label,
    heading: `'${hName}', ${hSerif ? SERIF : SANS}`,
    body: `'${bName}', ${bSerif ? SERIF : SANS}`,
    href: hGf === bGf ? gfHref(hGf) : gfHref(hGf, bGf),
  }
}

const JAKARTA = 'Plus+Jakarta+Sans:wght@400;500;600;700;800'
const INTER = 'Inter:wght@400;500;600;700'
const POPPINS = 'Poppins:wght@400;500;600;700'
const MONTSERRAT = 'Montserrat:wght@400;500;600;700'

const PAIRINGS: FontPairing[] = [
  // ── Serif başlık + temiz sans (zarif/kurumsal) ──
  mk('elegant', 'Fraunces + Jakarta', 'Fraunces', 'Fraunces:opsz,wght@9..144,400;500;600;700', true, 'Plus Jakarta Sans', JAKARTA, false),
  mk('classic', 'Playfair + Source Sans', 'Playfair Display', 'Playfair+Display:wght@500;600;700', true, 'Source Sans 3', 'Source+Sans+3:wght@400;500;600', false),
  mk('dmserif', 'DM Serif + DM Sans', 'DM Serif Display', 'DM+Serif+Display', true, 'DM Sans', 'DM+Sans:wght@400;500;600;700', false),
  mk('luxury', 'Cormorant + Montserrat', 'Cormorant Garamond', 'Cormorant+Garamond:wght@500;600;700', true, 'Montserrat', MONTSERRAT, false),
  mk('libre', 'Libre Baskerville + Inter', 'Libre Baskerville', 'Libre+Baskerville:wght@400;700', true, 'Inter', INTER, false),
  mk('lora', 'Lora + Inter', 'Lora', 'Lora:wght@400;500;600;700', true, 'Inter', INTER, false),
  mk('merriweather', 'Merriweather + Inter', 'Merriweather', 'Merriweather:wght@400;700', true, 'Inter', INTER, false),
  mk('ebgaramond', 'EB Garamond + Inter', 'EB Garamond', 'EB+Garamond:wght@400;500;600;700', true, 'Inter', INTER, false),
  mk('spectral', 'Spectral + Inter', 'Spectral', 'Spectral:wght@400;500;600;700', true, 'Inter', INTER, false),
  mk('sourceserif', 'Source Serif + Inter', 'Source Serif 4', 'Source+Serif+4:wght@400;500;600;700', true, 'Inter', INTER, false),
  mk('marcellus', 'Marcellus + Inter', 'Marcellus', 'Marcellus', true, 'Inter', INTER, false),
  mk('crimson', 'Crimson Pro + Inter', 'Crimson Pro', 'Crimson+Pro:wght@400;500;600;700', true, 'Inter', INTER, false),
  mk('bodoni', 'Bodoni Moda + Montserrat', 'Bodoni Moda', 'Bodoni+Moda:opsz,wght@6..96,400;500;600;700', true, 'Montserrat', MONTSERRAT, false),
  // ── Modern sans (tek aile) ──
  mk('modern', 'Plus Jakarta Sans', 'Plus Jakarta Sans', JAKARTA, false, 'Plus Jakarta Sans', JAKARTA, false),
  mk('inter', 'Inter', 'Inter', INTER, false, 'Inter', INTER, false),
  mk('poppins', 'Poppins', 'Poppins', POPPINS, false, 'Poppins', POPPINS, false),
  mk('montserrat', 'Montserrat', 'Montserrat', MONTSERRAT, false, 'Montserrat', MONTSERRAT, false),
  mk('manrope', 'Manrope', 'Manrope', 'Manrope:wght@400;500;600;700;800', false, 'Manrope', 'Manrope:wght@400;500;600;700;800', false),
  mk('outfit', 'Outfit', 'Outfit', 'Outfit:wght@400;500;600;700', false, 'Outfit', 'Outfit:wght@400;500;600;700', false),
  mk('worksans', 'Work Sans', 'Work Sans', 'Work+Sans:wght@400;500;600;700', false, 'Work Sans', 'Work+Sans:wght@400;500;600;700', false),
  mk('nunito', 'Nunito', 'Nunito', 'Nunito:wght@400;500;600;700;800', false, 'Nunito', 'Nunito:wght@400;500;600;700;800', false),
  mk('lexend', 'Lexend', 'Lexend', 'Lexend:wght@400;500;600;700', false, 'Lexend', 'Lexend:wght@400;500;600;700', false),
  mk('figtree', 'Figtree', 'Figtree', 'Figtree:wght@400;500;600;700', false, 'Figtree', 'Figtree:wght@400;500;600;700', false),
  mk('dmsans', 'DM Sans', 'DM Sans', 'DM+Sans:wght@400;500;600;700', false, 'DM Sans', 'DM+Sans:wght@400;500;600;700', false),
  mk('rubik', 'Rubik', 'Rubik', 'Rubik:wght@400;500;600;700', false, 'Rubik', 'Rubik:wght@400;500;600;700', false),
  mk('urbanist', 'Urbanist', 'Urbanist', 'Urbanist:wght@400;500;600;700', false, 'Urbanist', 'Urbanist:wght@400;500;600;700', false),
  mk('jost', 'Jost', 'Jost', 'Jost:wght@400;500;600;700', false, 'Jost', 'Jost:wght@400;500;600;700', false),
  mk('mulish', 'Mulish', 'Mulish', 'Mulish:wght@400;500;600;700', false, 'Mulish', 'Mulish:wght@400;500;600;700', false),
  mk('karla', 'Karla', 'Karla', 'Karla:wght@400;500;600;700', false, 'Karla', 'Karla:wght@400;500;600;700', false),
  mk('hanken', 'Hanken Grotesk', 'Hanken Grotesk', 'Hanken+Grotesk:wght@400;500;600;700', false, 'Hanken Grotesk', 'Hanken+Grotesk:wght@400;500;600;700', false),
  mk('onest', 'Onest', 'Onest', 'Onest:wght@400;500;600;700', false, 'Onest', 'Onest:wght@400;500;600;700', false),
  mk('raleway', 'Raleway', 'Raleway', 'Raleway:wght@400;500;600;700', false, 'Raleway', 'Raleway:wght@400;500;600;700', false),
  // ── Karakterli sans başlık + nötr sans gövde ──
  mk('sora', 'Sora + Inter', 'Sora', 'Sora:wght@400;500;600;700', false, 'Inter', INTER, false),
  mk('space', 'Space Grotesk + Inter', 'Space Grotesk', 'Space+Grotesk:wght@400;500;600;700', false, 'Inter', INTER, false),
  mk('syne', 'Syne + Inter', 'Syne', 'Syne:wght@400;500;600;700;800', false, 'Inter', INTER, false),
  mk('unbounded', 'Unbounded + Inter', 'Unbounded', 'Unbounded:wght@400;500;600;700', false, 'Inter', INTER, false),
  mk('archivo', 'Archivo + Inter', 'Archivo', 'Archivo:wght@400;500;600;700', false, 'Inter', INTER, false),
  mk('montserratopen', 'Montserrat + Open Sans', 'Montserrat', MONTSERRAT, false, 'Open Sans', 'Open+Sans:wght@400;500;600;700', false),
  mk('poppinsinter', 'Poppins + Inter', 'Poppins', POPPINS, false, 'Inter', INTER, false),
]

export const FONT_PAIRINGS: Record<string, FontPairing> = Object.fromEntries(PAIRINGS.map((p) => [p.id, p]))
export const FONT_PAIRING_LIST: FontPairing[] = PAIRINGS
export const DEFAULT_FONT_PAIRING = FONT_PAIRINGS.elegant

export const DEFAULT_SITE_THEME: Required<Pick<ThemeTokens, 'primaryColor'>> &
  Pick<ThemeTokens, 'secondaryColor' | 'fontHeading' | 'fontBody' | 'logoUrl'> = {
  primaryColor: '#0f172a',
  secondaryColor: '#0f766e',
  fontHeading: DEFAULT_FONT_PAIRING.heading,
  fontBody: DEFAULT_FONT_PAIRING.body,
  logoUrl: null,
}

/** Sitenin temasına göre yüklenecek Google Fonts linki (yalnız o sitenin fontları). */
export function fontHrefFor(theme: ThemeTokens | null | undefined): string {
  return theme?.fontHref || DEFAULT_FONT_PAIRING.href
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
