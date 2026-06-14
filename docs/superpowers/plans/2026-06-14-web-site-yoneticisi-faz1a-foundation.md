# Web Site Yöneticisi — Faz 1a (Temel/Foundation) Implementasyon Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "Web Site Yöneticisi" modülünün gezilebilir iskeletini kur — DB tabloları, tipler, kredi hesabı, store (CRUD), API route'ları, nav/route/i18n wiring ve modül sayfaları. Bu plan bitince kullanıcı modüle girip boş site listesini görür, taslak site kaydı oluşturur, listeler, siler.

**Architecture:** Üretilen site = veridir (`websites` + `website_pages` + `website_versions`, JSON model). Faz 1a yalnız **veri katmanı + modül kabuğu**'nu kurar; paylaşımlı renderer Faz 1b'de, AI üretim + intake Faz 1c'de gelir. Tüm veri `user_id` ile scope'lanır; Supabase service-role client (RLS bypass + app-katmanı filtre) kullanılır — mevcut `lib/billing/db.ts` deseniyle birebir.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Supabase (omddq, `pg` migration script), next-intl (TR/EN), lucide-react, mevcut `chargeFeature`/`featureAccessMap` billing altyapısı.

**Bu Faz 1'in 3 planından 1.'sidir:** 1a Temel (bu) → 1b Renderer (subdomain + responsive bölüm bileşenleri) → 1c Üretim & Intake (AI hattı + stok görsel + Inngest + yönlendirilmiş diyalog UI).

> **Doğrulama felsefesi (ÖNEMLİ):** Bu projede birim-test koşucusu (jest/vitest) **yoktur**. Doğrulama, projenin mevcut pratiğiyle yapılır: `npx tsc --noEmit` (tip/imza), `npm run lint`, `npm run build` (derleme), `scripts/verify-*.mjs` node script'leri (saf JS mantık) ve **gerçek app**'te manuel kontrol. Plan adımları bu araçları kullanır — uydurma test komutu yoktur.

---

## Dosya Yapısı (bu planda dokunulan)

**Oluşturulacak:**
- `supabase/migrations/20260614120000_create_website_tables.sql` — 3 tablo + index + RLS
- `scripts/apply-website-tables-migration.mjs` — migration uygulayıcı (omddq)
- `lib/website/types.ts` — Website/Page/Version/Section/Theme tipleri + DB row tipleri + mapper'lar
- `lib/website/credits.ts` — kredi sabitleri + `computeGenerationCost` + `WEBSITE_REVISION_COST`
- `lib/website/subdomain.ts` — `slugifySubdomain` + `ensureUniqueSubdomain`
- `lib/website/store.ts` — CRUD (userId scope'lu)
- `scripts/verify-website-credits.mjs` — kredi hesabı doğrulama (saf JS port + assert)
- `app/api/website/route.ts` — `GET` liste / `POST` yeni taslak
- `app/api/website/[id]/route.ts` — `GET` / `PATCH` / `DELETE`
- `app/web-site-yoneticisi/layout.tsx` — guard + sidebar
- `app/web-site-yoneticisi/page.tsx` — site listesi + "Yeni Site Oluştur"
- `app/web-site-yoneticisi/[id]/page.tsx` — site detay (Faz 1c intake'i barındıracak stub)
- `components/website/SiteList.tsx` — liste bileşeni (kart grid)

**Değiştirilecek:**
- `lib/billing/featureAccessMap.ts` — `website_generation` feature ekle
- `lib/nav.ts` — NavItem ekle (`Globe` ikonu)
- `lib/routes.ts` — `ROUTES.WEBSITE_MANAGER` + slug eşlemesi
- `locales/tr.json` + `locales/en.json` — `sidebar.webSiteYoneticisi` + `dashboard.webSiteYoneticisi` namespace
- `package.json` — `db:migrate:website` script

---

## Task 1: Veritabanı tabloları (migration + uygulayıcı)

**Files:**
- Create: `supabase/migrations/20260614120000_create_website_tables.sql`
- Create: `scripts/apply-website-tables-migration.mjs`
- Modify: `package.json:25` (scripts bloğuna ekleme)

- [ ] **Step 1: Migration SQL'ini yaz**

`supabase/migrations/20260614120000_create_website_tables.sql`:

```sql
-- Web Site Yöneticisi — Faz 1a temel tablolar (additive + idempotent). CANONICAL (omddq).
-- websites = site kaydı + tema; website_pages = sayfa modeli (JSON bölümler); website_versions = sürüm/rollback.

CREATE TABLE IF NOT EXISTS public.websites (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              TEXT NOT NULL,
  label                TEXT NOT NULL,
  subdomain            TEXT NOT NULL,
  site_type            TEXT NOT NULL DEFAULT 'multipage' CHECK (site_type IN ('landing','multipage')),
  default_locale       TEXT NOT NULL DEFAULT 'tr',
  locales              TEXT[] NOT NULL DEFAULT '{tr}',
  category             TEXT,
  status               TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','unpublished')),
  theme                JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_version_id UUID,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_websites_subdomain ON public.websites (subdomain);
CREATE INDEX IF NOT EXISTS idx_websites_user_created ON public.websites (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.website_pages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id   UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  locale       TEXT NOT NULL,
  slug         TEXT NOT NULL,
  page_role    TEXT NOT NULL,
  sections     JSONB NOT NULL DEFAULT '[]'::jsonb,
  seo          JSONB NOT NULL DEFAULT '{}'::jsonb,
  order_index  INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_website_pages_unique ON public.website_pages (website_id, locale, slug);
CREATE INDEX IF NOT EXISTS idx_website_pages_website ON public.website_pages (website_id);

CREATE TABLE IF NOT EXISTS public.website_versions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id     UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  snapshot       JSONB NOT NULL,
  reason         TEXT NOT NULL CHECK (reason IN ('initial','revision','rollback')),
  credit_charged INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_website_versions_website ON public.website_versions (website_id, created_at DESC);

-- RLS (service-role bypass + app-katmanı user_id filtresi; mevcut desenle aynı).
ALTER TABLE public.websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "websites_own" ON public.websites;
CREATE POLICY "websites_own" ON public.websites
  USING (user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true)))
  WITH CHECK (user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true)));

DROP POLICY IF EXISTS "website_pages_own" ON public.website_pages;
CREATE POLICY "website_pages_own" ON public.website_pages
  USING (EXISTS (SELECT 1 FROM public.websites w WHERE w.id = website_id
    AND w.user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))));

DROP POLICY IF EXISTS "website_versions_own" ON public.website_versions;
CREATE POLICY "website_versions_own" ON public.website_versions
  USING (EXISTS (SELECT 1 FROM public.websites w WHERE w.id = website_id
    AND w.user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))));

COMMENT ON TABLE public.websites IS 'Web Site Yöneticisi Faz 1 — site kaydı + tema. RLS bypass via service role (app-layer scope).';
```

- [ ] **Step 2: Uygulayıcı script'i yaz** (`scripts/apply-site-content-briefs-migration.mjs` desenini birebir izle)

`scripts/apply-website-tables-migration.mjs`:

```javascript
#!/usr/bin/env node
/**
 * YoAi — Web Site Yöneticisi temel tablolar migration uygulayıcı.
 * Additive + idempotent. CANONICAL (omddq) projeye uygulanır.
 * Gerekli env (.env.local): DATABASE_URL (Transaction mode, port 6543).
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import pg from 'pg'

const { Client } = pg
const ROOT = process.cwd()
try {
  const env = readFileSync(resolve(ROOT, '.env.local'), 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch {}

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
if (!DATABASE_URL) {
  console.error('\n❌  DATABASE_URL bulunamadı (.env.local). omddq Transaction mode (6543) bağlantısı gerekli.')
  console.error('   Alternatif: SQL\'i Supabase Dashboard > SQL Editor (omddq) içine yapıştır.\n')
  process.exit(1)
}
const FILE = 'supabase/migrations/20260614120000_create_website_tables.sql'
async function main() {
  console.log('\n🚀  Web Site Yöneticisi temel tablolar migration\n')
  const client = new Client({ connectionString: DATABASE_URL })
  await client.connect()
  try {
    const sql = readFileSync(resolve(ROOT, FILE), 'utf8')
    console.log(`▶  ${FILE}`)
    await client.query(sql)
    console.log('   ✓  Başarılı\n')
  } finally {
    await client.end()
  }
}
main().catch((e) => { console.error('❌ ', e.message); process.exit(1) })
```

- [ ] **Step 3: package.json'a script ekle**

`package.json` scripts bloğuna (`db:migrate:site-briefs` satırının altına) ekle:

```json
    "db:migrate:website": "node scripts/apply-website-tables-migration.mjs",
```

- [ ] **Step 4: Migration'ı omddq'ya uygula**

Run: `npm run db:migrate:website`
Expected: `✓  Başarılı`. (DATABASE_URL yoksa SQL'i Supabase omddq SQL Editor'e yapıştır.)

- [ ] **Step 5: Tabloların oluştuğunu doğrula**

Supabase omddq SQL Editor'de çalıştır:
`SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'website%';`
Expected: `websites`, `website_pages`, `website_versions` döner.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260614120000_create_website_tables.sql scripts/apply-website-tables-migration.mjs package.json
git commit -m "feat(web-site-yoneticisi): Faz 1a — websites/website_pages/website_versions tabloları + migration"
```

---

## Task 2: Tip tanımları

**Files:**
- Create: `lib/website/types.ts`

- [ ] **Step 1: Tipleri yaz**

`lib/website/types.ts`:

```typescript
// Web Site Yöneticisi — alan tipleri (domain) + DB row tipleri + mapper'lar.

export type SiteType = 'landing' | 'multipage'
export type WebsiteStatus = 'draft' | 'published' | 'unpublished'
export type VersionReason = 'initial' | 'revision' | 'rollback'
export type PageRole =
  | 'home' | 'about' | 'services' | 'products' | 'contact' | 'blog' | 'faq' | 'gallery' | 'custom'

export interface ThemeTokens {
  primaryColor: string | null
  secondaryColor?: string | null
  fontHeading?: string | null
  fontBody?: string | null
  logoUrl?: string | null
}

export interface SectionBlock {
  id: string
  type: string // 'hero' | 'features' | 'about' | 'cta' | 'contact' | ... (Faz 1b'de genişler)
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
```

- [ ] **Step 2: Tip kontrolü**

Run: `npx tsc --noEmit`
Expected: Yeni dosyaya ait hata yok (mevcut hatalar varsa bu dosyayı içermez).

- [ ] **Step 3: Commit**

```bash
git add lib/website/types.ts
git commit -m "feat(web-site-yoneticisi): Faz 1a — domain tipleri + DB row mapper"
```

---

## Task 3: Kredi hesabı

**Files:**
- Create: `lib/website/credits.ts`
- Create: `scripts/verify-website-credits.mjs`
- Modify: `package.json` (scripts'e `verify:website-credits`)

- [ ] **Step 1: Kredi mantığını yaz**

`lib/website/credits.ts`:

```typescript
import type { SiteType } from './types'

/**
 * Kredi sabitleri — kalibre edilebilir. Açık karar (§7): gerçek üretim maliyetine göre ayarlanır.
 * Mantık: perLocaleCost = base + ekSayfa * perExtraPage; toplam = perLocaleCost * dilSayısı.
 * (Her ek dil ayrı içerik üretimi → maliyet dil sayısıyla çarpan olur.)
 */
export const WEBSITE_CREDITS = {
  base: 40, // landing (tek sayfa), tek dil tabanı
  perExtraPage: 15, // ilk sayfadan sonraki her sayfa
} as const

/** Bir revizyon talebinin sabit kredi maliyeti. */
export const WEBSITE_REVISION_COST = 10

export interface GenerationCostInput {
  siteType: SiteType
  pageCount: number
  localeCount: number
}

/** İlk üretim (veya tam yeniden üretim) kredi maliyeti. */
export function computeGenerationCost(input: GenerationCostInput): number {
  const pages = Math.max(1, Math.floor(input.pageCount || 1))
  const locales = Math.max(1, Math.floor(input.localeCount || 1))
  const extraPages = pages - 1
  const perLocaleCost = WEBSITE_CREDITS.base + extraPages * WEBSITE_CREDITS.perExtraPage
  return perLocaleCost * locales
}
```

- [ ] **Step 2: Doğrulama script'ini yaz** (`scripts/verify-budget-conversion.mjs` desenindeki gibi saf JS port + assert)

`scripts/verify-website-credits.mjs`:

```javascript
#!/usr/bin/env node
/**
 * Web Site Yöneticisi kredi hesabı doğrulaması.
 * lib/website/credits.ts mantığının JS portu üzerinde assert eder (proje TS unit runner kullanmaz).
 * credits.ts değişirse bu port da güncellenmeli.
 */
const WEBSITE_CREDITS = { base: 40, perExtraPage: 15 }
function computeGenerationCost({ pageCount, localeCount }) {
  const pages = Math.max(1, Math.floor(pageCount || 1))
  const locales = Math.max(1, Math.floor(localeCount || 1))
  const perLocaleCost = WEBSITE_CREDITS.base + (pages - 1) * WEBSITE_CREDITS.perExtraPage
  return perLocaleCost * locales
}

const cases = [
  { in: { pageCount: 1, localeCount: 1 }, want: 40 },   // landing, tek dil
  { in: { pageCount: 4, localeCount: 1 }, want: 85 },   // 40 + 3*15
  { in: { pageCount: 4, localeCount: 2 }, want: 170 },  // 85 * 2
  { in: { pageCount: 1, localeCount: 3 }, want: 120 },  // 40 * 3
  { in: { pageCount: 0, localeCount: 0 }, want: 40 },   // alt sınır koruması
]
let fail = 0
for (const c of cases) {
  const got = computeGenerationCost(c.in)
  const ok = got === c.want
  if (!ok) fail++
  console.log(`${ok ? '✓' : '✗'} ${JSON.stringify(c.in)} => ${got} (beklenen ${c.want})`)
}
if (fail) { console.error(`\n❌ ${fail} hata`); process.exit(1) }
console.log('\n✓ Tüm kredi hesabı senaryoları geçti')
```

- [ ] **Step 3: package.json'a script ekle**

```json
    "verify:website-credits": "node scripts/verify-website-credits.mjs",
```

- [ ] **Step 4: Doğrulamayı çalıştır**

Run: `npm run verify:website-credits`
Expected: `✓ Tüm kredi hesabı senaryoları geçti`

- [ ] **Step 5: Tip kontrolü + commit**

Run: `npx tsc --noEmit` → yeni dosyada hata yok.

```bash
git add lib/website/credits.ts scripts/verify-website-credits.mjs package.json
git commit -m "feat(web-site-yoneticisi): Faz 1a — kredi hesabı (sayfa × dil) + doğrulama script"
```

---

## Task 4: featureAccessMap'e feature ekle

**Files:**
- Modify: `lib/billing/featureAccessMap.ts`

- [ ] **Step 1: `FEATURE_ACCESS` objesine yeni entry ekle**

`lib/billing/featureAccessMap.ts` içinde, kredi gerektiren feature'ların yanına ekle:

```typescript
  website_generation: {
    key: 'website_generation',
    label: 'Web Sitesi Üretimi',
    tier: 'credit_required',
    description: 'Web sitesi üretmek ve revize etmek için yeterli kredi bakiyesine sahip olmanız gerekir.',
  },
```

- [ ] **Step 2: Tip kontrolü**

Run: `npx tsc --noEmit`
Expected: Hata yok (`FeatureKey` union otomatik genişler).

- [ ] **Step 3: Commit**

```bash
git add lib/billing/featureAccessMap.ts
git commit -m "feat(web-site-yoneticisi): Faz 1a — website_generation feature (credit_required)"
```

---

## Task 5: Subdomain yardımcıları + Store

**Files:**
- Create: `lib/website/subdomain.ts`
- Create: `lib/website/store.ts`

- [ ] **Step 1: Subdomain yardımcısını yaz**

`lib/website/subdomain.ts`:

```typescript
import 'server-only'
import { supabase } from '@/lib/supabase/client'

const TR_MAP: Record<string, string> = {
  ç: 'c', ğ: 'g', ı: 'i', İ: 'i', ö: 'o', ş: 's', ü: 'u',
  Ç: 'c', Ğ: 'g', Ö: 'o', Ş: 's', Ü: 'u',
}

/** Türkçe-güvenli, DNS-uyumlu subdomain slug'ı (a-z0-9-, 3-40 char). */
export function slugifySubdomain(input: string): string {
  const replaced = (input || '').replace(/[çğıİöşüÇĞÖŞÜ]/g, (ch) => TR_MAP[ch] ?? ch)
  let slug = replaced
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  if (slug.length < 3) slug = `site-${slug}`.slice(0, 40).replace(/-+$/g, '')
  return slug
}

/** Çakışmada -2, -3 … ekleyerek benzersiz subdomain üretir. */
export async function ensureUniqueSubdomain(base: string): Promise<string> {
  const root = slugifySubdomain(base)
  if (!supabase) return root
  let candidate = root
  let n = 1
  // En fazla 50 deneme; her birinde varlık kontrolü.
  // eslint-disable-next-line no-constant-condition
  while (n <= 50) {
    const { data } = await supabase
      .from('websites')
      .select('id')
      .eq('subdomain', candidate)
      .maybeSingle()
    if (!data) return candidate
    n += 1
    candidate = `${root}-${n}`.slice(0, 40)
  }
  return `${root}-${Date.now().toString(36)}`.slice(0, 40)
}
```

- [ ] **Step 2: Store'u yaz** (`lib/billing/db.ts`'deki `requireClient()` + service-client deseni)

`lib/website/store.ts`:

```typescript
import 'server-only'
import { supabase } from '@/lib/supabase/client'
import { ensureUniqueSubdomain } from './subdomain'
import {
  rowToWebsite,
  type Website,
  type WebsiteRow,
  type WebsiteDraftInput,
  type WebsitePatchInput,
  type ThemeTokens,
} from './types'

function requireClient() {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  return supabase
}

const DEFAULT_THEME: ThemeTokens = { primaryColor: null }

/** Kullanıcının tüm sitelerini (yeni → eski) döner. */
export async function listWebsites(userId: string): Promise<Website[]> {
  const db = requireClient()
  const { data, error } = await db
    .from('websites')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as WebsiteRow[]).map(rowToWebsite)
}

/** Tek siteyi döner (sahiplik kontrolü: user_id eşleşmesi). */
export async function getWebsite(userId: string, id: string): Promise<Website | null> {
  const db = requireClient()
  const { data, error } = await db
    .from('websites')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? rowToWebsite(data as WebsiteRow) : null
}

/** Yeni taslak site oluşturur (status='draft'). Üretim/kredi bu adımda DEĞİL — Faz 1c. */
export async function createWebsite(userId: string, input: WebsiteDraftInput): Promise<Website> {
  const db = requireClient()
  const label = input.label?.trim() || 'Yeni Web Sitesi'
  const subdomain = await ensureUniqueSubdomain(label)
  const defaultLocale = input.defaultLocale || 'tr'
  const locales = input.locales?.length ? input.locales : [defaultLocale]
  const theme: ThemeTokens = { ...DEFAULT_THEME, ...(input.theme ?? {}) }

  const { data, error } = await db
    .from('websites')
    .insert({
      user_id: userId,
      label,
      subdomain,
      site_type: input.siteType ?? 'multipage',
      default_locale: defaultLocale,
      locales,
      category: input.category ?? null,
      status: 'draft',
      theme,
    })
    .select('*')
    .single()
  if (error) throw error
  return rowToWebsite(data as WebsiteRow)
}

/** Siteyi günceller (yalnız sahibinin kaydında). */
export async function updateWebsite(
  userId: string,
  id: string,
  patch: WebsitePatchInput,
): Promise<Website | null> {
  const db = requireClient()
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.label !== undefined) row.label = patch.label.trim()
  if (patch.siteType !== undefined) row.site_type = patch.siteType
  if (patch.category !== undefined) row.category = patch.category
  if (patch.defaultLocale !== undefined) row.default_locale = patch.defaultLocale
  if (patch.locales !== undefined) row.locales = patch.locales
  if (patch.theme !== undefined) row.theme = patch.theme
  if (patch.status !== undefined) row.status = patch.status

  const { data, error } = await db
    .from('websites')
    .update(row)
    .eq('user_id', userId)
    .eq('id', id)
    .select('*')
    .maybeSingle()
  if (error) throw error
  return data ? rowToWebsite(data as WebsiteRow) : null
}

/** Siteyi siler (cascade: pages + versions). Silinen satır sayısı 0 ise false. */
export async function deleteWebsite(userId: string, id: string): Promise<boolean> {
  const db = requireClient()
  const { data, error } = await db
    .from('websites')
    .delete()
    .eq('user_id', userId)
    .eq('id', id)
    .select('id')
  if (error) throw error
  return Array.isArray(data) && data.length > 0
}
```

- [ ] **Step 3: Tip + derleme kontrolü**

Run: `npx tsc --noEmit`
Expected: Yeni dosyalarda hata yok.

- [ ] **Step 4: Commit**

```bash
git add lib/website/subdomain.ts lib/website/store.ts
git commit -m "feat(web-site-yoneticisi): Faz 1a — subdomain üretimi + site store (CRUD, userId scope)"
```

---

## Task 6: API route'ları

**Files:**
- Create: `app/api/website/route.ts`
- Create: `app/api/website/[id]/route.ts`

- [ ] **Step 1: Liste + oluştur route'unu yaz** (`getCurrentUser` auth deseni)

`app/api/website/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { listWebsites, createWebsite } from '@/lib/website/store'
import type { WebsiteDraftInput } from '@/lib/website/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
  try {
    const websites = await listWebsites(user.id)
    return NextResponse.json({ ok: true, websites })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Liste alınamadı'
    console.error('[website:list]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<WebsiteDraftInput>
    const website = await createWebsite(user.id, {
      label: body.label ?? 'Yeni Web Sitesi',
      siteType: body.siteType,
      category: body.category ?? null,
      defaultLocale: body.defaultLocale,
      locales: body.locales,
      theme: body.theme,
    })
    return NextResponse.json({ ok: true, website }, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Oluşturulamadı'
    console.error('[website:create]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Detay (get/patch/delete) route'unu yaz**

`app/api/website/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { getWebsite, updateWebsite, deleteWebsite } from '@/lib/website/store'
import type { WebsitePatchInput } from '@/lib/website/types'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
  try {
    const website = await getWebsite(user.id, params.id)
    if (!website) return NextResponse.json({ ok: false, error: 'Bulunamadı' }, { status: 404 })
    return NextResponse.json({ ok: true, website })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Alınamadı'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
  try {
    const patch = (await req.json().catch(() => ({}))) as WebsitePatchInput
    const website = await updateWebsite(user.id, params.id, patch)
    if (!website) return NextResponse.json({ ok: false, error: 'Bulunamadı' }, { status: 404 })
    return NextResponse.json({ ok: true, website })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Güncellenemedi'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
  try {
    const removed = await deleteWebsite(user.id, params.id)
    if (!removed) return NextResponse.json({ ok: false, error: 'Bulunamadı' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Silinemedi'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
```

- [ ] **Step 3: Tip + derleme kontrolü**

Run: `npx tsc --noEmit && npm run lint`
Expected: Yeni dosyalarda hata/uyarı yok.

- [ ] **Step 4: Commit**

```bash
git add app/api/website/route.ts app/api/website/[id]/route.ts
git commit -m "feat(web-site-yoneticisi): Faz 1a — site CRUD API route'ları (auth + scope)"
```

---

## Task 7: Nav + Routes + i18n wiring

**Files:**
- Modify: `lib/routes.ts`
- Modify: `lib/nav.ts`
- Modify: `locales/tr.json`
- Modify: `locales/en.json`

- [ ] **Step 1: `lib/routes.ts` — route + slug eşlemesi ekle**

`ROUTES` objesine ekle:

```typescript
  WEBSITE_MANAGER: '/web-site-yoneticisi',
```

`SLUG_TR_TO_EN`'e ekle:

```typescript
  'web-site-yoneticisi': 'website-manager',
```

`SLUG_EN_TO_TR`'ye ekle:

```typescript
  'website-manager': 'web-site-yoneticisi',
```

- [ ] **Step 2: `lib/nav.ts` — NavItem ekle**

Dosyanın üstündeki lucide-react import satırına `Globe` ekle (zaten import edilmiş ikonların yanına):

```typescript
import { Globe } from 'lucide-react'
```

`navItems` array'ine yeni öğe ekle (örn. `strateji` öğesinin yakınına):

```typescript
  {
    id: 'web-site-yoneticisi',
    label: 'Web Site Yöneticisi',
    href: ROUTES.WEBSITE_MANAGER,
    icon: Globe,
  },
```

> Not: `label` yalnız fallback; gerçek metin `SidebarNav` içinde `t(getTranslationKey('web-site-yoneticisi'))` → `sidebar.webSiteYoneticisi`'den gelir. `getTranslationKey` id'yi camelCase'e çevirir (`web-site-yoneticisi` → `webSiteYoneticisi`). Bunu doğrula: `components/SidebarNav.tsx` içindeki `getTranslationKey` fonksiyonunun kebab→camel dönüşümü yaptığını kontrol et; yapmıyorsa map'e elle `'web-site-yoneticisi': 'webSiteYoneticisi'` ekle.

- [ ] **Step 3: `locales/tr.json` — sidebar etiketi + modül namespace**

`sidebar` namespace'ine ekle:

```json
    "webSiteYoneticisi": "Web Site Yöneticisi",
```

Top-level'a yeni namespace ekle (`dashboard` objesinin içine `webSiteYoneticisi` anahtarı):

```json
    "webSiteYoneticisi": {
      "title": "Web Site Yöneticisi",
      "pageDescription": "Yapay zekâ ile markanıza uygun web sitesi oluşturun ve tek tuşla yayınlayın.",
      "newSite": "Yeni Site Oluştur",
      "emptyTitle": "Henüz web siteniz yok",
      "emptyDescription": "İlk web sitenizi oluşturmak için başlayın.",
      "statusDraft": "Taslak",
      "statusPublished": "Yayında",
      "statusUnpublished": "Yayından kaldırıldı",
      "open": "Aç",
      "delete": "Sil",
      "deleteConfirm": "Bu siteyi silmek istediğinize emin misiniz?",
      "createError": "Site oluşturulamadı.",
      "loadError": "Siteler yüklenemedi."
    }
```

- [ ] **Step 4: `locales/en.json` — aynı anahtarlar (İngilizce)**

`sidebar` namespace'ine:

```json
    "webSiteYoneticisi": "Website Manager",
```

`dashboard` objesine:

```json
    "webSiteYoneticisi": {
      "title": "Website Manager",
      "pageDescription": "Create an on-brand website with AI and publish it in one click.",
      "newSite": "Create New Site",
      "emptyTitle": "You don't have any websites yet",
      "emptyDescription": "Get started by creating your first website.",
      "statusDraft": "Draft",
      "statusPublished": "Published",
      "statusUnpublished": "Unpublished",
      "open": "Open",
      "delete": "Delete",
      "deleteConfirm": "Are you sure you want to delete this site?",
      "createError": "Could not create the site.",
      "loadError": "Could not load sites."
    }
```

- [ ] **Step 5: Derleme + JSON geçerlilik kontrolü**

Run: `npx tsc --noEmit && node -e "JSON.parse(require('fs').readFileSync('locales/tr.json','utf8')); JSON.parse(require('fs').readFileSync('locales/en.json','utf8')); console.log('JSON ok')"`
Expected: `JSON ok` ve tsc hatasız.

- [ ] **Step 6: Commit**

```bash
git add lib/routes.ts lib/nav.ts locales/tr.json locales/en.json
git commit -m "feat(web-site-yoneticisi): Faz 1a — nav + route + slug + TR/EN i18n wiring"
```

---

## Task 8: Modül sayfaları (layout + liste + detay stub)

**Files:**
- Create: `app/web-site-yoneticisi/layout.tsx`
- Create: `app/web-site-yoneticisi/page.tsx`
- Create: `app/web-site-yoneticisi/[id]/page.tsx`
- Create: `components/website/SiteList.tsx`

- [ ] **Step 1: Layout'u yaz** (`app/strateji/layout.tsx` deseni)

`app/web-site-yoneticisi/layout.tsx`:

```typescript
'use client'

import SidebarNav from '@/components/SidebarNav'
import BusinessProfileGuard from '@/components/yoai/BusinessProfileGuard'
import AccountApprovalGuard from '@/components/auth/AccountApprovalGuard'

export default function WebSiteYoneticisiLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AccountApprovalGuard>
      <div className="flex h-screen bg-gray-50">
        <SidebarNav />
        <div className="flex-1 flex flex-col overflow-hidden">
          <BusinessProfileGuard area="Web Site Yöneticisi">{children}</BusinessProfileGuard>
        </div>
      </div>
    </AccountApprovalGuard>
  )
}
```

- [ ] **Step 2: Liste bileşenini yaz** (kart grid, proje UI standardı: `animate-card-enter`, `hover:shadow-md transition-all`)

`components/website/SiteList.tsx`:

```typescript
'use client'

import { useTranslations } from 'next-intl'
import { Globe, Trash2 } from 'lucide-react'
import type { Website } from '@/lib/website/types'

interface SiteListProps {
  sites: Website[]
  onOpen: (id: string) => void
  onDelete: (id: string) => void
}

export default function SiteList({ sites, onOpen, onDelete }: SiteListProps) {
  const t = useTranslations('dashboard.webSiteYoneticisi')

  const statusLabel = (s: Website['status']) =>
    s === 'published' ? t('statusPublished') : s === 'unpublished' ? t('statusUnpublished') : t('statusDraft')

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {sites.map((site, index) => (
        <div
          key={site.id}
          className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3 animate-card-enter hover:shadow-md transition-all duration-300"
          style={{ ['--card-index' as string]: Math.min(index, 10) }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center">
              <Globe className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-gray-900 truncate">{site.label}</h3>
              <p className="text-sm text-gray-500 truncate">{site.subdomain}</p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center rounded-full bg-gray-100 text-gray-700 text-xs px-2.5 py-0.5">
            {statusLabel(site.status)}
          </span>
          <div className="mt-auto flex items-center gap-2">
            <button
              onClick={() => onOpen(site.id)}
              className="flex-1 rounded-lg bg-primary text-white text-sm font-medium py-2 active:scale-[0.97] transition-all"
            >
              {t('open')}
            </button>
            <button
              onClick={() => onDelete(site.id)}
              aria-label={t('delete')}
              className="rounded-lg border border-gray-200 text-gray-500 p-2 hover:bg-gray-50/60 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Liste sayfasını yaz** (`app/strateji/page.tsx` deseni: Topbar + max-w-7xl + toast)

`app/web-site-yoneticisi/page.tsx`:

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Topbar from '@/components/Topbar'
import { ToastContainer, type Toast } from '@/components/Toast'
import SiteList from '@/components/website/SiteList'
import type { Website } from '@/lib/website/types'

export default function WebSiteYoneticisiPage() {
  const router = useRouter()
  const t = useTranslations('dashboard.webSiteYoneticisi')
  const [sites, setSites] = useState<Website[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: Toast['type']) => {
    setToasts((prev) => [...prev, { id: crypto.randomUUID(), message, type }])
  }, [])
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id))
  }, [])

  const fetchSites = useCallback(async () => {
    try {
      const res = await fetch('/api/website')
      const json = await res.json()
      if (json.ok) setSites(json.websites ?? [])
      else addToast(t('loadError'), 'error')
    } catch {
      addToast(t('loadError'), 'error')
    } finally {
      setLoading(false)
    }
  }, [addToast, t])

  useEffect(() => { fetchSites() }, [fetchSites])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const res = await fetch('/api/website', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const json = await res.json()
      if (json.ok && json.website) router.push(`/web-site-yoneticisi/${json.website.id}`)
      else addToast(t('createError'), 'error')
    } catch {
      addToast(t('createError'), 'error')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('deleteConfirm'))) return
    const res = await fetch(`/api/website/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (json.ok) setSites((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <>
      <Topbar
        title={t('title')}
        description={t('pageDescription')}
        actionButton={{ label: t('newSite'), onClick: handleCreate, disabled: creating }}
      />
      <div className="flex-1 overflow-y-auto app-content-surface p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {loading ? (
            <p className="text-sm text-gray-500">…</p>
          ) : sites.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center animate-card-enter">
              <h3 className="text-base font-semibold text-gray-900">{t('emptyTitle')}</h3>
              <p className="mt-1 text-sm leading-relaxed text-gray-600">{t('emptyDescription')}</p>
            </div>
          ) : (
            <SiteList sites={sites} onOpen={(id) => router.push(`/web-site-yoneticisi/${id}`)} onDelete={handleDelete} />
          )}
        </div>
      </div>
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  )
}
```

> Not: `Topbar` ve `Toast` prop'larını kullanmadan önce gerçek imzalarını doğrula (`components/Topbar.tsx`, `components/Toast.tsx`). `actionButton` ve `ToastContainer` prop adları `app/strateji/page.tsx`'te kullanıldığı şekildedir; farklıysa oradaki kullanımı birebir kopyala.

- [ ] **Step 4: Detay stub sayfasını yaz** (Faz 1c intake buraya gelecek)

`app/web-site-yoneticisi/[id]/page.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import Topbar from '@/components/Topbar'
import type { Website } from '@/lib/website/types'

export default function WebSiteDetailPage() {
  const params = useParams()
  const id = String(params?.id ?? '')
  const t = useTranslations('dashboard.webSiteYoneticisi')
  const [site, setSite] = useState<Website | null>(null)

  useEffect(() => {
    if (!id) return
    fetch(`/api/website/${id}`)
      .then((r) => r.json())
      .then((j) => { if (j.ok) setSite(j.website) })
      .catch(() => {})
  }, [id])

  return (
    <>
      <Topbar title={site?.label ?? t('title')} description={site?.subdomain ?? ''} />
      <div className="flex-1 overflow-y-auto app-content-surface p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Faz 1c: yönlendirilmiş intake diyaloğu + önizleme + yayın buraya gelecek */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 animate-card-enter">
            <p className="text-sm leading-relaxed text-gray-600">
              {site ? `${site.label} — ${site.status}` : '…'}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 5: Derleme**

Run: `npm run build`
Expected: Derleme başarılı; `app/web-site-yoneticisi` route'ları derlenir, tip hatası yok.

- [ ] **Step 6: Commit**

```bash
git add app/web-site-yoneticisi components/website/SiteList.tsx
git commit -m "feat(web-site-yoneticisi): Faz 1a — modül layout + site listesi + detay stub"
```

---

## Task 9: Uçtan uca manuel doğrulama

**Files:** (yok — gerçek-app kontrolü)

- [ ] **Step 1: Dev sunucusunu başlat**

Run: `npm run dev`
(Zaten çalışıyorsa ikinci örnek başlatma.)

- [ ] **Step 2: Sidebar + modül erişimi**

Giriş yapmış bir kullanıcıyla `http://localhost:3000/web-site-yoneticisi` aç.
Expected: Sidebar'da "Web Site Yöneticisi" (Globe ikonu) görünür; sayfa boş-durum kartını gösterir.

- [ ] **Step 3: Site oluştur**

"Yeni Site Oluştur"a bas.
Expected: Yeni taslak oluşur, `/web-site-yoneticisi/<id>` detayına yönlenir; detayda label + status görünür.

- [ ] **Step 4: Liste + sil**

Listeye dön; yeni site kartını gör. "Sil" → onayla.
Expected: Kart listeden kalkar.

- [ ] **Step 5: Dil değişimi (TR/EN)**

`NEXT_LOCALE` cookie'sini `en` yap (veya dil değiştir), sayfayı yenile.
Expected: Tüm modül metinleri İngilizce; hardcoded TR string yok.

- [ ] **Step 6: Final lint + build + commit**

Run: `npm run lint && npm run build`
Expected: Temiz.

```bash
git commit --allow-empty -m "test(web-site-yoneticisi): Faz 1a — uçtan uca manuel doğrulama tamam"
```

---

## Self-Review (yazar kontrolü — tamamlandı)

**Spec kapsamı (Faz 1a payı):**
- Modül + sidebar + TR/EN → Task 7, 8 ✓
- Veri modeli (`websites`/`website_pages`/`website_versions`) → Task 1 ✓
- Kredi modeli (sayfa × dil; revizyon sabiti) → Task 3 ✓ (gerçek düşüm Faz 1c'de `chargeFeature` ile)
- `featureAccessMap` kaydı → Task 4 ✓
- Store + scope (`user_id`) → Task 5 ✓
- API CRUD → Task 6 ✓
- Çoklu site → Task 6/8 (her POST yeni kayıt) ✓
- Renderer / AI üretim / stok görsel / Inngest / intake diyaloğu → **Faz 1b + 1c** (bu plan dışı, bilinçli) ✓

**Placeholder taraması:** İki "doğrula" notu var (SidebarNav `getTranslationKey` kebab→camel; `Topbar`/`Toast` prop imzaları) — bunlar uydurma değil, mevcut bileşen imzasına hizalama uyarısıdır; ilgili dosya + birebir referans verildi.

**Tip tutarlılığı:** `Website`/`WebsiteRow`/`rowToWebsite` Task 2'de tanımlı; store (Task 5) ve route'lar (Task 6) aynı isim/şekilleri kullanır. `WebsiteDraftInput`/`WebsitePatchInput` tek kaynaktan. Kredi sabitleri Task 3 ↔ verify script JS portu uyumlu (port güncelleme notu eklendi).

---

## Sonraki planlar

- **Faz 1b — Renderer:** subdomain middleware (`firma.<wildcard>` → website_id), paylaşımlı dynamic-route renderer, responsive bölüm bileşeni kütüphanesi (Hero/Features/About/Services/Contact…), tema uygulama, önizleme, yayın (`status='published'` + `published_version_id`).
- **Faz 1c — Üretim & Intake:** stok görsel sağlayıcıları (`StockProvider`: Pexels/Unsplash/Pixabay; Freepik sonra) + FAL.ai, AI planlama+içerik hattı (`claudeJson`), Inngest üretim işi (`website/generate.user`), profilden tohumlama, yönlendirilmiş diyalog UI (öneri → "doğru mu?" → kullanıcı yazar → finalize), `chargeFeature('website_generation')` ile kredi düşümü + revizyon.
```
