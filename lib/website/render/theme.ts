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

/**
 * Sektöre göre uyumlu renk paletleri (tasarımcı kararı).
 * Her palet: ink (koyu metin/koyu bölüm zemini) · accent (marka aksanı/buton) ·
 * surface (çok açık tematik bölüm zemini) · onAccent (aksan üstü metin).
 * Amber/sarı YASAK kuralına uyar (otel paleti şampanya-bronz toprak tonu).
 */
export interface SitePalette { ink: string; accent: string; surface: string; onAccent: string }

const PALETTES: Record<string, SitePalette> = {
  hotel: { ink: '#142A38', accent: '#B0894C', surface: '#F2F6F5', onAccent: '#FFFFFF' },
  food: { ink: '#1E3326', accent: '#4C7A35', surface: '#F3F6EE', onAccent: '#FFFFFF' },
  beauty: { ink: '#3A1A28', accent: '#B23A6B', surface: '#FBF2F5', onAccent: '#FFFFFF' },
  health: { ink: '#0F2A30', accent: '#12877A', surface: '#EEF6F4', onAccent: '#FFFFFF' },
  corporate: { ink: '#16233C', accent: '#2C57A8', surface: '#F0F3F9', onAccent: '#FFFFFF' },
  realestate: { ink: '#232830', accent: '#B0542E', surface: '#F4F2EF', onAccent: '#FFFFFF' },
  tech: { ink: '#131726', accent: '#3B5BDB', surface: '#EFF1F8', onAccent: '#FFFFFF' },
  food_service: { ink: '#2A1815', accent: '#A33523', surface: '#F7F1EC', onAccent: '#FFFFFF' },
  education: { ink: '#15243F', accent: '#2867A6', surface: '#EFF3F8', onAccent: '#FFFFFF' },
  fitness: { ink: '#15191C', accent: '#159A47', surface: '#EFF3EF', onAccent: '#FFFFFF' },
  default: { ink: '#18202B', accent: '#0E7C73', surface: '#F1F5F4', onAccent: '#FFFFFF' },
}

/** Türkçe-güvenli normalize (İ/I tuzağına düşmeden anahtar kelime arama). */
function norm(s: string): string {
  return s
    .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
    .replace(/Ş/g, 's').replace(/Ğ/g, 'g').replace(/Ü/g, 'u').replace(/Ö/g, 'o').replace(/Ç/g, 'c')
    .toLowerCase()
}

// Sektör tahmini için anahtar kelime → palet eşlemesi (TR + EN). İlk eşleşen kazanır.
const SECTOR_KEYWORDS: { keys: string[]; palette: keyof typeof PALETTES }[] = [
  { keys: ['otel', 'hotel', 'turizm', 'tourism', 'tatil', 'resort', 'villa', 'konaklama', 'pansiyon', 'seyahat', 'travel', 'tur ', 'booking', 'bilet', 'ferry', 'feribot'], palette: 'hotel' },
  { keys: ['restoran', 'restaurant', 'cafe', 'kafe', 'lokanta', 'yemek', 'food court', 'pastane', 'firin', 'patisserie', 'bistro', 'bar ', 'pizza', 'burger', 'mutfak'], palette: 'food_service' },
  { keys: ['gida', 'food', 'dogal', 'organik', 'organic', 'natural', 'tarim', 'agri', 'zeytin', 'bal ', 'cay', 'kahve', 'ciftlik', 'farm', 'market', 'bakkal', 'manav'], palette: 'food' },
  { keys: ['guzellik', 'beauty', 'kozmetik', 'cosmetic', 'spa', 'cilt', 'skin', 'kuafor', 'berber', 'salon', 'estetik', 'makyaj', 'sac', 'bakim', 'wellness'], palette: 'beauty' },
  { keys: ['saglik', 'health', 'klinik', 'clinic', 'dis ', 'dental', 'hastane', 'hospital', 'doktor', 'tip', 'medical', 'eczane', 'pharma', 'fizyoterapi', 'psikolog', 'veteriner'], palette: 'health' },
  { keys: ['insaat', 'construction', 'mimar', 'architect', 'emlak', 'gayrimenkul', 'realestate', 'real estate', 'yapi', 'dekorasyon', 'mobilya', 'furniture', 'tadilat', 'peyzaj'], palette: 'realestate' },
  { keys: ['teknoloji', 'technology', 'yazilim', 'software', 'dijital', 'digital', 'tech', 'ajans', 'agency', 'e-ticaret', 'ecommerce', 'startup', 'saas', 'uygulama', 'app ', 'web '], palette: 'tech' },
  { keys: ['danismanlik', 'consulting', 'finans', 'finance', 'hukuk', 'avukat', 'law', 'legal', 'muhasebe', 'accounting', 'sigorta', 'insurance', 'kurumsal', 'corporate', 'banka'], palette: 'corporate' },
  { keys: ['egitim', 'education', 'kurs', 'course', 'okul', 'school', 'akademi', 'academy', 'universite', 'dershane', 'kolej', 'anaokulu'], palette: 'education' },
  { keys: ['spor', 'sport', 'fitness', 'gym', 'yoga', 'pilates', 'crossfit', 'antrenor', 'koc '], palette: 'fitness' },
]

/** Verilen sektör/kategori metninden palet anahtarını seçer (eşleşme yoksa 'default'). */
export function sectorKeyFor(sector: string | null | undefined): keyof typeof PALETTES {
  const s = sector ? ` ${norm(sector)} ` : ''
  if (s.trim()) {
    for (const { keys, palette } of SECTOR_KEYWORDS) {
      if (keys.some((k) => s.includes(k))) return palette
    }
  }
  return 'default'
}

/** Verilen sektör/kategori metninden uygun paleti seçer (eşleşme yoksa default). */
export function paletteForSector(sector: string | null | undefined): SitePalette {
  return PALETTES[sectorKeyFor(sector)]
}

/** Sektöre göre İngilizce stok görsel sorgu temaları (deterministik üretim + AI fallback). */
const STOCK_THEME: Record<keyof typeof PALETTES, { hero: string; about: string; detail: string; gallery: string; service: string }> = {
  hotel: { hero: 'luxury hotel resort exterior sea view', about: 'elegant hotel lobby interior', detail: 'hotel room comfort detail', gallery: 'boutique hotel rooms and pool', service: 'hotel amenity' },
  food: { hero: 'fresh organic natural produce farm', about: 'natural food production workshop', detail: 'organic food ingredients closeup', gallery: 'natural organic food products', service: 'organic product' },
  beauty: { hero: 'modern beauty spa salon interior', about: 'beauty treatment professional', detail: 'skincare cosmetic products', gallery: 'beauty salon treatments', service: 'beauty treatment' },
  health: { hero: 'modern medical clinic interior bright', about: 'professional doctor healthcare team', detail: 'medical equipment closeup', gallery: 'modern clinic facilities', service: 'medical service' },
  corporate: { hero: 'modern corporate office building', about: 'professional business team meeting', detail: 'business handshake closeup', gallery: 'corporate office workspace', service: 'business service' },
  realestate: { hero: 'modern architecture luxury building', about: 'architect construction professional', detail: 'modern interior design detail', gallery: 'modern real estate properties', service: 'property service' },
  tech: { hero: 'modern technology office workspace', about: 'software development team', detail: 'technology code screen closeup', gallery: 'modern tech workspace', service: 'technology service' },
  food_service: { hero: 'cozy restaurant interior ambience', about: 'chef cooking professional kitchen', detail: 'gourmet plated dish closeup', gallery: 'restaurant dishes and interior', service: 'restaurant dish' },
  education: { hero: 'modern classroom learning environment', about: 'teacher students learning', detail: 'books study materials closeup', gallery: 'education campus facilities', service: 'course' },
  fitness: { hero: 'modern fitness gym interior', about: 'personal trainer workout', detail: 'fitness equipment closeup', gallery: 'gym training facilities', service: 'fitness program' },
  default: { hero: 'modern professional business workspace', about: 'professional team at work', detail: 'professional detail closeup', gallery: 'modern professional showcase', service: 'professional service' },
}

/** Sektöre göre stok görsel sorgu temaları (deterministik üretimde + AI fallback'te kullanılır). */
export function stockThemeForSector(sector: string | null | undefined) {
  return STOCK_THEME[sectorKeyFor(sector)]
}

/** #RRGGBB → "r, g, b" (rgba bileşimi için). Geçersizse null. */
function hexToRgb(hex: string | null | undefined): string | null {
  if (!hex) return null
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

/**
 * Üretim anında siteye yazılacak tema renklerini çözer.
 * Marka rengi (primaryColor) varsa aksan onu alır; ink/surface uyum için sektör paletinden.
 * Sonuç theme jsonb'sine yazılır (migration gerekmez) → render `themeToCssVars` ile okur.
 */
export function resolveSiteColors(opts: {
  brandColor?: string | null
  sector?: string | null
}): Pick<ThemeTokens, 'primaryColor' | 'secondaryColor' | 'surfaceColor' | 'accentSoftColor'> {
  const pal = paletteForSector(opts.sector)
  const brand = typeof opts.brandColor === 'string' && /^#?[0-9a-f]{6}$/i.test(opts.brandColor.trim())
    ? (opts.brandColor.trim().startsWith('#') ? opts.brandColor.trim() : `#${opts.brandColor.trim()}`)
    : null
  const accent = brand || pal.accent
  const rgb = hexToRgb(accent)
  return {
    primaryColor: pal.ink,
    secondaryColor: accent,
    surfaceColor: pal.surface,
    accentSoftColor: rgb ? `rgba(${rgb}, 0.10)` : null,
  }
}

export const DEFAULT_SITE_THEME: Required<Pick<ThemeTokens, 'primaryColor'>> &
  Pick<ThemeTokens, 'secondaryColor' | 'surfaceColor' | 'fontHeading' | 'fontBody' | 'logoUrl'> = {
  primaryColor: PALETTES.default.ink,
  secondaryColor: PALETTES.default.accent,
  surfaceColor: PALETTES.default.surface,
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
  const surface = t.surfaceColor || DEFAULT_SITE_THEME.surfaceColor || '#F4F6F8'
  const rgb = hexToRgb(accent)
  const accentSoft = t.accentSoftColor || (rgb ? `rgba(${rgb}, 0.10)` : 'rgba(0,0,0,0.05)')
  return {
    ['--site-ink' as string]: ink,
    ['--site-accent' as string]: accent,
    ['--site-accent-soft' as string]: accentSoft,
    ['--site-surface' as string]: surface,
    ['--site-on-accent' as string]: '#FFFFFF',
    ['--site-font-heading' as string]: t.fontHeading || DEFAULT_SITE_THEME.fontHeading,
    ['--site-font-body' as string]: t.fontBody || DEFAULT_SITE_THEME.fontBody,
  }
}

/** Faz B — site tarzı: AI üretim tonu yönergesi + wizard'da önerilen yazı ailesi. */
export interface SiteStylePreset { id: string; label: string; directive: string; fontHint: string }
export const SITE_STYLE_PRESETS: SiteStylePreset[] = [
  { id: 'modern', label: 'Modern', directive: 'Temiz, çağdaş ve ferah; bol beyaz alan, net sans-serif tipografi, sade ve dengeli renk; gereksiz süsten kaçın.', fontHint: 'inter' },
  { id: 'corporate', label: 'Kurumsal', directive: 'Profesyonel, güven veren ve yapılandırılmış; ciddi ve net dil, nötr/lacivert ton, düzenli hizalama.', fontHint: 'classic' },
  { id: 'playful', label: 'Keyifli', directive: 'Sıcak, samimi ve enerjik; davetkâr dil, yuvarlak hatlar, canlı ama dengeli renk.', fontHint: 'poppins' },
  { id: 'luxury', label: 'Lüks', directive: 'Zarif, premium ve sofistike; ölçülü ve şık dil, serif başlık hissi, koyu zemin + metalik/altın aksan vurgusu, geniş nefes alanı.', fontHint: 'elegant' },
  { id: 'minimal', label: 'Minimal', directive: 'Sade ve tipografi-odaklı; çok boşluk, az renk, kısa ve öz metin; her öğe amaçlı.', fontHint: 'manrope' },
  { id: 'vibrant', label: 'Canlı', directive: 'Cesur, enerjik ve dikkat çekici; parlak renkler, büyük tipografi, güçlü ve iddialı ifadeler.', fontHint: 'syne' },
]
export const SITE_STYLE_MAP: Record<string, SiteStylePreset> = Object.fromEntries(SITE_STYLE_PRESETS.map((p) => [p.id, p]))

/** Tarz id'sinden AI prompt'a verilecek tasarım yönergesi (yoksa boş). */
export function styleDirective(style: string | null | undefined): string {
  return (style && SITE_STYLE_MAP[style]?.directive) || ''
}
