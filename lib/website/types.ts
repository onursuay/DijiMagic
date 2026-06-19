// Web Site Yöneticisi — alan tipleri (domain) + DB row tipleri + mapper'lar.

export type SiteType = 'landing' | 'multipage'
export type WebsiteStatus = 'draft' | 'published' | 'unpublished'
export type VersionReason = 'initial' | 'revision' | 'rollback'
export type PageRole =
  | 'home' | 'about' | 'services' | 'products' | 'contact' | 'blog' | 'faq' | 'gallery' | 'custom'

export interface ThemeTokens {
  primaryColor: string | null
  secondaryColor?: string | null
  /** Tematik açık zemin tonu (bölüm arka planları). theme jsonb'sinde tutulur — migration gerekmez. */
  surfaceColor?: string | null
  /** Aksan rengin yumuşak/şeffaf tonu (rozet, ikon zemini). theme jsonb'sinde tutulur. */
  accentSoftColor?: string | null
  fontHeading?: string | null
  fontBody?: string | null
  /** Bu sitenin Google Fonts linki (yalnız kendi fontlarını yükler). */
  fontHref?: string | null
  logoUrl?: string | null
  /** AI üretiminde ilham alınacak referans site URL'leri (birebir kopya DEĞİL). theme jsonb'sinde tutulur. */
  referenceUrls?: string[] | null
  /**
   * Veri önceliği (sihirbazda seçilir) — üretimin HANGİ kaynağı yetkili sayacağı:
   *   'reference' → site, referans/örnek siteler taranarak ona göre inşa edilir;
   *                 global işletme profili/zekâsı kullanılMAZ (referans yönlendirir).
   *   'manual'    → site, işletme profilin/girdiğin bilgilerle inşa edilir;
   *                 referans özetleri içeriğe ENJEKTE EDİLMEZ (refUrls içerik için yok sayılır).
   *   null/undefined → otomatik (geriye dönük): referans içeriği varsa onu kullan,
   *                 yoksa global profile düş. theme jsonb'sinde tutulur — migration gerekmez.
   */
  dataSourcePriority?: 'reference' | 'manual' | null
  /** Faz 3: siteye bağlı kullanıcı domaini (ör. firma.com). theme jsonb'sinde tutulur. */
  customDomain?: string | null
  /** Wizard'da girilen ilk marka açıklaması/tarif (ilk AI üretim talimatı). theme jsonb'sinde tutulur. */
  initialInstructions?: string | null
  /** Faz B: site tarzı (modern|corporate|playful|luxury|minimal|vibrant). theme jsonb'sinde tutulur. */
  style?: string | null
  /**
   * Codegen v2 üretim MODU (#builder-5a):
   *   'library'  → VARSAYILAN — blueprint + composition + bileşen kütüphanesi yolu
   *                (Opus blueprint üretir, kütüphaneden bileşen seçilir, deterministik
   *                render edilir, gate'ten geçer; fallback blueprint garantili gate-geçer).
   *   'freeform' → eski serbest-HTML motoru (custom/Pro) — byte-byte korunur.
   *   null/undefined → 'library' (varsayılan). theme jsonb'sinde tutulur — migration gerekmez.
   */
  generationMode?: 'library' | 'freeform' | null
  /**
   * Codegen (format='html') siteleri için mobil menü açılış animasyonu (perde yönü):
   * 'left' (soldan), 'right' (sağdan), 'top' (yukarıdan). Üretimde
   * `data-yoai-mobile-anim="<value>"` olarak basılır. Tanımsızsa 'left' varsayılır
   * (geriye dönük uyumlu). theme jsonb'sinde tutulur — migration gerekmez.
   */
  mobileMenuAnim?: 'left' | 'right' | 'top' | null
  /** Faz C: alan bazlı tasarım override (header/body/footer). theme jsonb'sinde tutulur — migration yok. */
  areaStyles?: AreaStyles | null
  /**
   * Codegen (format='html') siteleri için Stage-1 DesignSystem'den türetilen CSS custom property
   * haritası (`--ink`, `--accent`, … → değer). assembleDocument'in `:root` bloğuna yazılır.
   * Task 15 (generate/persist) tarafından yazılır; sections sitelerinde tanımsızdır (kullanılmaz).
   * theme jsonb'sinde tutulur — migration gerekmez.
   */
  designVars?: Record<string, string> | null
  /**
   * Codegen (format='html') siteleri için per-site derlenmiş CSS önbellek anahtarı. Her yeni üretim/
   * revizyon bunu yeni bir değere (ISO zaman damgası) çevirir; tailwindCompile bunu görerek eski
   * derlemeyi geçersiz kılar. Task 15 yazar; sections sitelerinde tanımsızdır. theme jsonb'sinde tutulur.
   */
  compiledCssVersion?: string | null
}

/** Faz C — bir alanın (header/body/footer) global temayı ezen tasarımı. */
export interface AreaStyle {
  /** FONT_PAIRINGS id'si (alan yazı ailesi). */
  fontPairing?: string | null
  /** Metin/başlık rengi (--site-ink). */
  textColor?: string | null
  /** Arka plan rengi (header/footer için --site-area-bg; gövde için --site-surface). */
  bgColor?: string | null
  /** Faz C2: yazı boyutu ölçeği ('0.9'|'1'|'1.1'|'1.25') → --site-text-scale. */
  textScale?: string | null
  /** Faz C2: alan vurgu rengi (#rrggbb) → --site-accent + türetilen soft/on-accent. */
  accentColor?: string | null
  /** Faz C2: zemin opaklığı (0..100; yalnız bgColor ile anlamlı) → color-mix saydamlık. */
  bgOpacity?: number | null
}

export interface AreaStyles {
  header?: AreaStyle | null
  body?: AreaStyle | null
  footer?: AreaStyle | null
}

export interface SectionBlock {
  id: string
  // 'header' | 'hero' | 'stats' | 'services' | 'features' | 'split' | 'gallery'
  // | 'about' | 'testimonial' | 'cta' | 'contact' | 'footer'
  type: string
  content: Record<string, unknown>
}

export interface PageSeo {
  title?: string
  description?: string
}

export interface Website {
  id: string
  userId: string
  label: string
  subdomain: string
  siteType: SiteType
  defaultLocale: string
  locales: string[]
  category: string | null
  status: WebsiteStatus
  theme: ThemeTokens
  publishedVersionId: string | null
  createdAt: string
  updatedAt: string
}

export interface WebsitePage {
  id: string
  websiteId: string
  locale: string
  slug: string
  pageRole: PageRole
  sections: SectionBlock[]
  seo: PageSeo
  orderIndex: number
  html?: string | null
  format: 'sections' | 'html'
}

export interface WebsiteSnapshot {
  website: Pick<Website, 'label' | 'siteType' | 'defaultLocale' | 'locales' | 'category' | 'theme'>
  pages: WebsitePage[]
}

export interface WebsiteVersion {
  id: string
  websiteId: string
  snapshot: WebsiteSnapshot
  reason: VersionReason
  creditCharged: number
  createdAt: string
}

/** Sürüm geçmişi listesi için hafif meta (snapshot olmadan). */
export interface WebsiteVersionMeta {
  id: string
  reason: VersionReason
  creditCharged: number
  createdAt: string
}

/** Yeni taslak site oluştururken kabul edilen alanlar. */
export interface WebsiteDraftInput {
  label: string
  siteType?: SiteType
  category?: string | null
  defaultLocale?: string
  locales?: string[]
  theme?: Partial<ThemeTokens>
}

/** PATCH ile güncellenebilen alanlar. */
export interface WebsitePatchInput {
  label?: string
  siteType?: SiteType
  category?: string | null
  defaultLocale?: string
  locales?: string[]
  theme?: Partial<ThemeTokens>
  status?: WebsiteStatus
}

/** Sayfa yazarken kabul edilen alanlar (builder + ileride AI üretimi). */
export interface WebsitePageInput {
  locale: string
  slug: string
  pageRole: PageRole
  sections: SectionBlock[]
  seo?: PageSeo
  orderIndex?: number
  html?: string | null
  format?: 'sections' | 'html'
}

/** Public render için: yayınlanmış site + sayfaları. */
export interface PublishedSite {
  website: Website
  pages: WebsitePage[]
}

// --- DB row tipleri (snake_case) + mapper ---

export interface WebsiteRow {
  id: string
  user_id: string
  label: string
  subdomain: string
  site_type: SiteType
  default_locale: string
  locales: string[]
  category: string | null
  status: WebsiteStatus
  theme: ThemeTokens | null
  published_version_id: string | null
  created_at: string
  updated_at: string
}

export function rowToWebsite(r: WebsiteRow): Website {
  return {
    id: r.id,
    userId: r.user_id,
    label: r.label,
    subdomain: r.subdomain,
    siteType: r.site_type,
    defaultLocale: r.default_locale,
    locales: r.locales ?? [r.default_locale],
    category: r.category,
    status: r.status,
    theme: r.theme ?? { primaryColor: null },
    publishedVersionId: r.published_version_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export interface WebsitePageRow {
  id: string
  website_id: string
  locale: string
  slug: string
  page_role: PageRole
  sections: SectionBlock[] | null
  seo: PageSeo | null
  order_index: number
  html?: string | null
  format?: string
}

export function rowToPage(r: WebsitePageRow): WebsitePage {
  return {
    id: r.id,
    websiteId: r.website_id,
    locale: r.locale,
    slug: r.slug,
    pageRole: r.page_role,
    sections: r.sections ?? [],
    seo: r.seo ?? {},
    orderIndex: r.order_index,
    html: r.html ?? null,
    format: (r.format as 'sections' | 'html') ?? 'sections',
  }
}
