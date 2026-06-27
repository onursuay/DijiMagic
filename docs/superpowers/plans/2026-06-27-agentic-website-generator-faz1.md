# İmplementasyon Planı — Agentic Website Generator (Faz 1)

## Goal

Mevcut tek-atış Claude website motorunu (sabit JSON şema → sabit şablon montaj, jenerik "WordPress-şablon" hissi), harici kalıcı bir sandbox'ta koşan Claude Agent SDK agentic döngüsüyle (yaz → build → ekran görüntüsü → öz-eleştiri → düzelt, ≥2 tur) değiştirmek. Çıktı, mevcut `format='html'` saklama/sunum sözleşmesine **tek gövde-içi HTML string** olarak teslim edilir. Hedef: promake.ai kalitesinde, görsel olarak çarpıcı, anti-jenerik statik pazarlama sitesi.

Bu plan **Faz 1**'in tamamını kapsar. FAZ 1 (anahtar GEREKMEZ — async iskelet) bite-sized TDD task'larla detaylandırılmıştır; sandbox/AI motoru olmadan dev-fallback ile uçtan uca çalışır. FAZ 2 (sandbox AI motoru — anahtar gerekir) ve FAZ 3 (POC + rollout) outline'dır.

## Architecture

Üç katman: **Vercel (API + UI)** → **Inngest (orkestratör)** → **Sandbox (işçi)**.

```
[Kullanıcı: "AI ile Oluştur"]
   ▼
[Vercel POST /api/website/[id]/generate]  (<3sn, BLOKE ETMEZ)
   ├─ chargeFeature('website_generation')   (kredi düş — mevcut)
   ├─ createWebsiteGenJob → status='queued' (YENİ tablo website_gen_jobs)
   └─ inngest.send('website/generate.agentic', {jobId, websiteId, userId, brief, locales, isRevision, creditSpent})
        (dev fallback: sandbox yoksa inline senkron motor — çökmesin)
        ▼
[Inngest websiteAgenticGenerate]  (CPU yakmadan DURAKLAR)
   ├─ step: mark-running
   ├─ step: dispatch-sandbox → POST {SANDBOX}/run (HMAC)
   ├─ step: waitForEvent('website/generate.sandbox-done', '12m')
   ├─ step: persist (IDEMPOTENT, jobId bazlı → persistGeneratedSite)
   │         → gateSiteHtml (SON OTORİTE) → replacePages(format='html') → createVersion
   └─ step: mark-done
        (hata/timeout → refundCreditsServer + job failed; BOZUK site ASLA persist edilmez)
        ▼
[Sandbox işçi: Agent SDK query() döngüsü]  (FAZ 2 — anahtar gerekir)
   her tur: POST .../progress → website_gen_jobs.stage/progress/step_log
   bitince: Storage'a yaz (idempotent) → POST .../complete + inngest.send('sandbox-done')
        ▼
[UI: GET /api/website/[id]/job her 1.5sn → WizardBuildingAnimation GERÇEK ilerleme]
        ▼
[Yedek bekçi: cron/website-jobs-reconcile → event kaybolsa toparlar]
        ▼
[Yayın / Sunum / Custom domain / Önizleme — HEPSİ DEĞİŞMEZ]
```

## Tech Stack

- **Sandbox compute:** E2B Pro (birincil), Daytona (yedek), Anthropic Managed Agents (hızlı POC alternatifi)
- **Orkestratör:** Inngest (`@/inngest/client` → `inngest`, mevcut)
- **API + UI:** Vercel Next.js (mevcut)
- **Model:** `claude-opus-4-8` @ effort=`xhigh` (vision-enabled), `max_tokens` 16K, `task_budget` 100K tavan, cache prefix ≥4096 token + `ttl:'1h'`
- **DB:** Supabase (PostgreSQL + RLS) — tek client `lib/supabase/client.ts` → `supabase` (service-role key ile; ayrı `supabaseService` YOK), `requireClient()` deseni store.ts'ten taşınır
- **Screenshot:** Playwright CDP cihaz emülasyonu (PNG diske → `Read`)

## Global Constraints (spec'ten BİREBİR — değişmez kurallar)

1. **Bayrak `WEBSITE_AGENTIC='1'`** açıkken job-başlat-ve-dön; **kapalıyken mevcut senkron yol BYTE-AYNI** (`WEBSITE_CODEGEN_V2` deseninin aynısı, `generate/route.ts:25,68`). Sıfır regresyon.
2. **Çıktı sözleşmesi `format='html'`** — Astro DEĞİL, tek sanitize-uyumlu gövde-içi Tailwind-class'lı HTML string.
3. **`gateSiteHtml` SON OTORİTE** — agentic öz-eleştirinin üstünde, Vercel-tarafı kesin kapı. Geçmezse persist YOK + kredi iade + job `failed`.
4. **Serve-time AI-JS YASAK** — build-time agentic, serve-time statik. CSP `script-src 'self'` + sanitize deny-by-default + gate korunur.
5. **Persist idempotent (jobId bazlı) + Storage-önce + gate-ardından** — BOZUK site ASLA persist edilmez, kredi kaçmaz.
6. **Repoda OLMAYAN tablo/fonksiyon kullanma:** `website_credit_events` YOK → `website_versions` (sürüm) + `chargeFeature`/`refundCreditsServer` (kredi).
7. **Wall-clock watchdog SIGTERM @ 8dk** — `maxTurns`/`task_budget` ZAMAN tavanı DEĞİL.
8. **Concurrency `[{limit:5},{key:'event.data.userId',limit:1}]`** — kullanıcı başına 1 eşzamanlı, toplam 5.
9. **EN/TR iki dil zorunlu** — yeni UI metni HEM `locales/tr.json` HEM `locales/en.json`.

## Repo Gerçeği — Kilit Düzeltmeler (plan boyunca uygulanır)

> Bu bölüm, planı repoya hizalayan **doğrulanmış** sözleşmelerdir. Her task bunlara uyar.

- **A. Route params Promise DEĞİL.** Mevcut tüm website route'ları Next 14 stili `{ params }: { params: { id: string } }` kullanır (`generate/route.ts:34`, `pages/route.ts:8`, `versions/route.ts:8`, `build/route.ts:17` — hepsi doğrulandı). Yeni route'lar **aynı imzayı** kullanır; `Promise<...>` + `await params` **YASAK** (repo o sürümde değil).
- **B. Supabase client tek: `supabase`.** `lib/supabase/client.ts` yalnız `export const supabase` verir (service-role key `resolveSupabaseServiceKey()` ile bağlı). `supabaseService` adı **YOK**. Yeni store helper'ları store.ts'in `requireClient()` desenini birebir kopyalar: `import { supabase } from '@/lib/supabase/client'` + yerel `requireClient()`.
- **C. Inngest `createFunction` 2-ARG form.** Repo `inngest.createFunction({ id, name, concurrency, retries, triggers: [{ event }] }, async ({ event, step, logger }) => {...})` kullanır (`perCampaignImprovements.ts:78-92` doğrulandı). `triggers` config NESNESİNİN İÇİNDE; ayrı 2.-arg `{ event }` **YOK**.
- **D. `WebsitePageInput.sections` ZORUNLU alandır** (`types.ts:171-180`). Persist'e giden her `WebsitePageInput` `sections: SectionBlock[]` taşır. `generateHtmlSite` zaten dolu `result.pages` döndürür (her biri `sections` içerir) → persist o diziyi olduğu gibi geçirir, elle `{locale,slug,html,format,pageRole}` objesi KURMAZ.
- **E. `WebsiteStatus` enum `'generating'` İÇERMEZ** (`types.ts:4` → `'draft'|'published'|'unpublished'`). İş durumu **doğru-kaynak = `website_gen_jobs.status`**; `updateWebsite` status'una agentic yolda DOKUNULMAZ. UI polling job'dan okur.
- **F. `refundCreditsServer(userId, amount, reason)`** `@/lib/billing/db`'dedir (`db.ts:213`). `refundFeature` adlı serbest fonksiyon yok; ayrıca `chargeFeature` dönüşündeki `access.refund()` closure'ı vardır — route içinde `access.refund()`, Inngest içinde (access nesnesi yokken) `refundCreditsServer(userId, creditSpent, 'website_generation_refund')` kullanılır.
- **G. `.test.mjs` plain `node` ile `.ts` IMPORT EDEMEZ.** Repoda `tsx`/`ts-node` YOK; test deseni `scripts/verify-website-codegen.mjs` gibi **`.mjs` modülleri + npm paketlerini** içe aktarır (`renderGate.mjs`, `sanitizeAllowlist.mjs` zaten `.mjs`). Bu yüzden: **saf-mantık yardımcıları (`jobProgress`, `sandboxHmac`) `.mjs` olarak yazılır** ve `.mjs` testle doğrulanır; **DB/store/route mantığı** (`.ts`) için unit-import testi yapılmaz → bunlar `npm run build` + `npx tsc --noEmit` tip-kontrolü + (opsiyonel) gerçek-DB smoke script'i ile doğrulanır.
- **H. Regresyon komutu = `node scripts/verify-website-codegen.mjs`** (npm script adı yok). `getCurrentUser()` → `{ id, email, name }` döndürür (`user.ts:28`).
- **I. `GET /api/website/[id]/pages` ZATEN VAR** (`pages/route.ts`, `{ ok, pages }` döndürür) → UI polling `done` sonrası bu route'u çağırır; yeni route gerekmez.

---

# FAZ 1 — Async İskelet (anahtar GEREKMEZ)

> Bu fazın sonunda: `WEBSITE_AGENTIC='1'` ile uçtan uca async iş akışı çalışır. Sandbox olmadan, Inngest fonksiyonu **dev-fallback inline mevcut motoru** çağırarak gerçek site üretir; job tablosu + polling + reconcile + UI gerçek progress çalışır. `WEBSITE_AGENTIC='0'` ile mevcut senkron yol byte-aynıdır.

---

## Task 1.1 — `website_gen_jobs` migration + `genJobStore.ts`

**Files:**
- create: `supabase/migrations/20260627000000_website_gen_jobs.sql`
- create: `lib/website/genJobStore.ts`
- create: `scripts/smoke-website-gen-jobs.mjs` (gerçek-DB smoke; `.env.local` ister — CI'da koşmaz, yerel doğrulama)

**Interfaces:**
- consumes: `supabase` (`@/lib/supabase/client`) + yerel `requireClient()` (store.ts deseni)
- produces: `createWebsiteGenJob`, `getWebsiteGenJob`, `updateJobStatus`, `appendJobLog`, `markJobComplete`, `markJobFailed`, `getLatestJobForWebsite`, `reconcileStaleJobs`, tipler `WebsiteGenJob` + `JobStatus`

> Test notu (Repo Gerçeği G): `genJobStore.ts` Supabase'e gider ve `.ts`'dir → plain `node` ile import edilemez. Bu yüzden TDD "kırmızı test"i, **gerçek-DB smoke script'i** (`scripts/smoke-website-gen-jobs.mjs`) olarak yazılır; bu script `genJobStore`'u **build edilmiş** biçimde değil, Next runtime gerektirmeyen saf supabase-js çağrılarıyla doğrular. Pratikte smoke, `@supabase/supabase-js`'i doğrudan kullanıp tablo CRUD'unu test eder (store helper'larının yaptığı SQL ile aynı). Asıl tip güvenliği `npx tsc --noEmit` ile.

### Adımlar

**1. Migration yaz** — `supabase/migrations/20260627000000_website_gen_jobs.sql`:

```sql
CREATE TABLE IF NOT EXISTS website_gen_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id    UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL,
  status        TEXT NOT NULL DEFAULT 'queued',
  stage         TEXT NOT NULL DEFAULT 'queued',
  progress      INTEGER NOT NULL DEFAULT 0,
  step_log      TEXT[] NOT NULL DEFAULT '{}',
  brief         TEXT,
  locales       TEXT[] NOT NULL DEFAULT '{}',
  site_type     TEXT NOT NULL DEFAULT 'landing',
  generated_html TEXT,
  design_vars   JSONB,
  error_reason  TEXT,
  inngest_run_id TEXT,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_website_gen_jobs_website ON website_gen_jobs(website_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_gen_jobs_user ON website_gen_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_gen_jobs_status ON website_gen_jobs(status);

-- Erişim service-role client üzerinden (websites tablosuyla aynı desen). RLS açık;
-- service key RLS'i bypass eder, anon/auth doğrudan erişemez.
ALTER TABLE website_gen_jobs ENABLE ROW LEVEL SECURITY;
```

> Migration uygulaması: repo `supabase migration up` kullanmıyor; mevcut desen `scripts/apply-*-migration.mjs` (örn. `apply-hierarchical-improvements-migration.mjs`). Aynı kalıpta `scripts/apply-website-gen-jobs-migration.mjs` yaz (supabase-js `rpc('exec_sql')` ya da projedeki mevcut migration-runner deseni neyse onu kopyala) ve `package.json` scripts'e `"db:migrate:website-jobs": "node scripts/apply-website-gen-jobs-migration.mjs"` ekle.

**2. Impl** — `lib/website/genJobStore.ts` (store.ts `requireClient()` deseni — `supabaseService` YOK):

```typescript
import 'server-only'
import { supabase } from '@/lib/supabase/client'
import { randomUUID } from 'node:crypto'

function requireClient() {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  return supabase
}

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'timeout'

export interface WebsiteGenJob {
  id: string
  websiteId: string
  userId: string
  status: JobStatus
  stage: string
  progress: number
  stepLog: string[]
  brief: string | null
  locales: string[]
  siteType: string
  generatedHtml: string | null
  designVars: Record<string, string> | null
  errorReason: string | null
  inngestRunId: string | null
}

function rowToJob(r: any): WebsiteGenJob {
  return {
    id: r.id, websiteId: r.website_id, userId: r.user_id, status: r.status,
    stage: r.stage, progress: r.progress, stepLog: r.step_log ?? [],
    brief: r.brief, locales: r.locales ?? [], siteType: r.site_type,
    generatedHtml: r.generated_html, designVars: r.design_vars,
    errorReason: r.error_reason, inngestRunId: r.inngest_run_id,
  }
}

export async function createWebsiteGenJob(opts: {
  websiteId: string; userId: string; brief: string; locales: string[]; siteType: string
}): Promise<string> {
  const db = requireClient()
  const id = randomUUID()
  const { error } = await db.from('website_gen_jobs').insert({
    id, website_id: opts.websiteId, user_id: opts.userId, status: 'queued',
    stage: 'queued', progress: 0, brief: opts.brief, locales: opts.locales, site_type: opts.siteType,
  })
  if (error) throw new Error(`createWebsiteGenJob: ${error.message}`)
  return id
}

export async function getWebsiteGenJob(jobId: string): Promise<WebsiteGenJob | null> {
  const db = requireClient()
  const { data, error } = await db.from('website_gen_jobs').select('*').eq('id', jobId).maybeSingle()
  if (error) throw new Error(`getWebsiteGenJob: ${error.message}`)
  return data ? rowToJob(data) : null
}

export async function updateJobStatus(jobId: string, status: JobStatus): Promise<void> {
  const db = requireClient()
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (status === 'running') patch.started_at = new Date().toISOString()
  if (status === 'completed' || status === 'failed' || status === 'timeout') patch.completed_at = new Date().toISOString()
  const { error } = await db.from('website_gen_jobs').update(patch).eq('id', jobId)
  if (error) throw new Error(`updateJobStatus: ${error.message}`)
}

export async function appendJobLog(jobId: string, stage: string, progress: number, stepMsg: string): Promise<void> {
  const db = requireClient()
  // step_log TEXT[] append — read-modify-write (son 50 satır).
  const cur = await getWebsiteGenJob(jobId)
  const nextLog = [...(cur?.stepLog ?? []), stepMsg].slice(-50)
  const { error } = await db.from('website_gen_jobs')
    .update({ stage, progress, step_log: nextLog, updated_at: new Date().toISOString() }).eq('id', jobId)
  if (error) throw new Error(`appendJobLog: ${error.message}`)
}

export async function markJobComplete(jobId: string, html: string, designVars: Record<string, string>): Promise<void> {
  const db = requireClient()
  const { error } = await db.from('website_gen_jobs').update({
    status: 'completed', stage: 'completed', progress: 100, generated_html: html,
    design_vars: designVars, completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', jobId)
  if (error) throw new Error(`markJobComplete: ${error.message}`)
}

export async function markJobFailed(jobId: string, errorReason: string): Promise<void> {
  const db = requireClient()
  const { error } = await db.from('website_gen_jobs').update({
    status: 'failed', error_reason: errorReason, completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('id', jobId)
  if (error) throw new Error(`markJobFailed: ${error.message}`)
}

export async function getLatestJobForWebsite(websiteId: string): Promise<WebsiteGenJob | null> {
  const db = requireClient()
  const { data, error } = await db.from('website_gen_jobs')
    .select('*').eq('website_id', websiteId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw new Error(`getLatestJobForWebsite: ${error.message}`)
  return data ? rowToJob(data) : null
}

export async function reconcileStaleJobs(staleThresholdMinutes = 15): Promise<{ reconciled: number }> {
  const db = requireClient()
  const cutoff = new Date(Date.now() - staleThresholdMinutes * 60_000).toISOString()
  const { data, error } = await db.from('website_gen_jobs')
    .update({ status: 'timeout', error_reason: 'reconcile:stale', completed_at: new Date().toISOString() })
    .in('status', ['queued', 'running']).lt('updated_at', cutoff).select('id')
  if (error) throw new Error(`reconcileStaleJobs: ${error.message}`)
  return { reconciled: data?.length ?? 0 }
}
```

**3. Smoke script** — `scripts/smoke-website-gen-jobs.mjs` (`.env.local` okur; tabloya yaz/oku/temizle — `verify-website-codegen.mjs` import deseni gibi `@supabase/supabase-js`'i `createRequire` ile çekip aynı CRUD'u doğrular):

```javascript
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { createClient } = require('@supabase/supabase-js')
// .env.local yükle (dotenv yoksa process.env zaten Vercel/CI'da dolu)
try { require('dotenv').config({ path: '.env.local' }) } catch {}

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.log('SKIP smoke (no supabase env)'); process.exit(0) }
const db = createClient(url, key)

// Geçerli bir website_id gerek (FK). Var olan ilk siteyi al; yoksa SKIP.
const { data: sites } = await db.from('websites').select('id,user_id').limit(1)
if (!sites?.length) { console.log('SKIP smoke (no website row)'); process.exit(0) }
const { id: websiteId, user_id: userId } = sites[0]

const { data: ins, error: e1 } = await db.from('website_gen_jobs')
  .insert({ website_id: websiteId, user_id: userId, status: 'queued', stage: 'queued', progress: 0, locales: ['tr'], site_type: 'landing' })
  .select('id,status,progress').single()
assert.ok(!e1 && ins.status === 'queued' && ins.progress === 0, 'FAIL insert queued/0')

await db.from('website_gen_jobs').update({ stage: 'building_page', progress: 40 }).eq('id', ins.id)
const { data: g } = await db.from('website_gen_jobs').select('stage,progress').eq('id', ins.id).single()
assert.ok(g.stage === 'building_page' && g.progress === 40, 'FAIL stage/progress update')

await db.from('website_gen_jobs').delete().eq('id', ins.id) // temizle
console.log('smoke-website-gen-jobs OK')
```

**4. Çalıştır → migration uygula → smoke + tip:**
```bash
npm run db:migrate:website-jobs
node scripts/smoke-website-gen-jobs.mjs
npx tsc --noEmit
```

**5. Commit:**
```bash
git add supabase/migrations/20260627000000_website_gen_jobs.sql lib/website/genJobStore.ts scripts/smoke-website-gen-jobs.mjs scripts/apply-website-gen-jobs-migration.mjs package.json
git commit -m "feat(website-agentic): website_gen_jobs tablosu + genJobStore (Faz 1.1)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 1.2 — `persistGeneratedSite.ts` (mevcut v2 persist bloğunu çıkar)

**Files:**
- create: `lib/website/persistGeneratedSite.ts`
- modify: `app/api/website/[id]/generate/route.ts` (`generateWithCodegenV2` persist bloğunu — satır 255-280 — tek çağrıya değiştir)

**Interfaces:**
- consumes: `updateWebsite`, `replacePages`, `createVersion` (`@/lib/website/store`); tipler `Website`, `WebsiteSnapshot`, `ThemeTokens`, `WebsitePage`; `GenerateHtmlSiteResult` (`@/lib/website/codegen/generateHtmlSite`)
- produces: `persistGeneratedSite(userId, site, result, isRevision, creditSpent)`

> Test notu: `.ts` + DB → plain `node` ile unit test yok. Doğrulama: `npx tsc --noEmit` + senkron yol regresyonu (`node scripts/verify-website-codegen.mjs`) + mevcut v2 davranışının (bayrak `WEBSITE_CODEGEN_V2='1'`) değişmediği manuel/build kontrolü. Bu task **saf refactor**: davranış byte-aynı kalmalı (kod aynı bloğun fonksiyona taşınması).

### Adımlar

**1. Impl** — `lib/website/persistGeneratedSite.ts` (mevcut `generate/route.ts:255-280` bloğunu BİREBİR taşı; `result.pages` zaten dolu `WebsitePageInput[]` → `sections` taşır, elle obje kurma):

```typescript
import 'server-only'
import { updateWebsite, replacePages, createVersion } from '@/lib/website/store'
import type { Website, WebsiteSnapshot, ThemeTokens, WebsitePage } from '@/lib/website/types'
import type { GenerateHtmlSiteResult } from '@/lib/website/codegen/generateHtmlSite'

type OkResult = Extract<GenerateHtmlSiteResult, { ok: true }>

export async function persistGeneratedSite(
  userId: string,
  site: Website,
  result: OkResult,
  isRevision: boolean,
  creditSpent: number,
): Promise<{ pages: WebsitePage[] }> {
  // Stage-1 designVars'ı temaya yaz — servis themeToDesignVars ile okur.
  const theme: ThemeTokens = {
    ...site.theme,
    designVars: result.designVars,
    compiledCssVersion: new Date().toISOString(),
  }
  await updateWebsite(userId, site.id, { theme })

  // result.pages = tam WebsitePageInput[] (sections + html + format='html' taşır).
  const pages = await replacePages(userId, site.id, result.pages)

  const snapshot: WebsiteSnapshot = {
    website: {
      label: site.label,
      siteType: site.siteType,
      defaultLocale: site.defaultLocale,
      locales: site.locales,
      category: site.category,
      theme,
    },
    pages,
  }
  await createVersion(site.id, snapshot, isRevision ? 'revision' : 'initial', creditSpent)
  return { pages }
}
```

**2. Route'u sadeleştir** — `app/api/website/[id]/generate/route.ts` `generateWithCodegenV2` içindeki satır 255-280 try bloğunu çağrıya indir (mevcut catch/refund korunur):

```typescript
  try {
    const { pages } = await persistGeneratedSite(user.id, site, result, isRevision, access.spent)
    return NextResponse.json({ ok: true, pages, creditCharged: access.spent })
  } catch (e) {
    await access.refund()
    const message = e instanceof Error ? e.message : 'Üretilemedi'
    console.error('[website:generate:v2]', message)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
```
(`import { persistGeneratedSite } from '@/lib/website/persistGeneratedSite'` ekle.)

**3. Doğrula:**
```bash
npx tsc --noEmit
node scripts/verify-website-codegen.mjs
```

**4. Commit:**
```bash
git add lib/website/persistGeneratedSite.ts "app/api/website/[id]/generate/route.ts"
git commit -m "refactor(website): persist bloğunu persistGeneratedSite'e çıkar (idempotent ortak yol — Faz 1.2)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 1.3 — Inngest `websiteAgenticGenerate` fonksiyonu + route kaydı

**Files:**
- create: `inngest/functions/websiteAgenticGenerate.ts`
- modify: `app/api/inngest/route.ts` (`functions[]` dizisine ekle)

**Interfaces:**
- consumes: `inngest` (`@/inngest/client`), `updateJobStatus`/`appendJobLog`/`markJobComplete`/`markJobFailed`/`getWebsiteGenJob` (genJobStore), `getWebsite` (store), `persistGeneratedSite`, `gateSiteHtml` (`@/lib/website/codegen/renderGate.mjs`), `generateHtmlSite` (`@/lib/website/codegen/generateHtmlSite`), `refundCreditsServer` (`@/lib/billing/db`)
- produces: `websiteAgenticGenerate` Inngest fonksiyonu; event `website/generate.agentic`; bekleme event `website/generate.sandbox-done`

> Test notu: Inngest fonksiyon + DB + `.ts` → plain `node` unit test yok. Doğrulama: `npx tsc --noEmit` + (1.5/1.6 sonrası) `WEBSITE_AGENTIC='1'` + sandbox-env-yok ile dev-fallback uçtan uca manuel/Inngest-dev koşusu.

### Adımlar

**1. Impl** — `inngest/functions/websiteAgenticGenerate.ts` (**2-ARG createFunction, `triggers:[]` config içinde** — Repo Gerçeği C; `gateSiteHtml` SON OTORİTE; `result.page.html` dev-fallback'te kullanılır):

```typescript
import { inngest } from '../client'
import {
  updateJobStatus, appendJobLog, markJobComplete, markJobFailed, getWebsiteGenJob,
} from '@/lib/website/genJobStore'
import { getWebsite } from '@/lib/website/store'
import { persistGeneratedSite } from '@/lib/website/persistGeneratedSite'
import { gateSiteHtml } from '@/lib/website/codegen/renderGate.mjs'
import { generateHtmlSite } from '@/lib/website/codegen/generateHtmlSite'
import { refundCreditsServer } from '@/lib/billing/db'

interface WebsiteAgenticGenerateEventData {
  jobId: string
  websiteId: string
  userId: string
  brief: string
  locales: string[]
  isRevision?: boolean
  creditSpent?: number
}

function isSandboxConfigured(): boolean {
  return Boolean(process.env.SANDBOX_URL && process.env.SANDBOX_HMAC_SECRET)
}

export const websiteAgenticGenerate = inngest.createFunction(
  {
    id: 'website-agentic-generate',
    name: 'Web Sitesi — Agentic Üretim',
    concurrency: [{ limit: 5 }, { key: 'event.data.userId', limit: 1 }],
    retries: 2,
    triggers: [{ event: 'website/generate.agentic' }],
  },
  async ({ event, step, logger }) => {
    const { jobId, websiteId, userId, brief, locales, isRevision = false, creditSpent = 0 } =
      event.data as WebsiteAgenticGenerateEventData

    await step.run('mark-running', async () => {
      await updateJobStatus(jobId, 'running')
      await appendJobLog(jobId, 'design_system', 5, 'Tasarım sistemi kuruluyor')
      return { ok: true }
    })

    // SANDBOX YOKSA: dev-fallback — mevcut senkron motoru inline çalıştır (çökmesin).
    if (!isSandboxConfigured()) {
      await step.run('dev-fallback-generate', async () => {
        const site = await getWebsite(userId, websiteId)
        if (!site) throw new Error('website-not-found')
        await appendJobLog(jobId, 'building_page', 40, 'Sayfa inşa ediliyor (dev-fallback)')
        const result = await generateHtmlSite(userId, site, { instructions: brief })
        if (result.ok === false) {
          await markJobFailed(jobId, `generate_failed:${result.reason}`)
          if (creditSpent > 0) await refundCreditsServer(userId, creditSpent, 'website_generation_refund')
          return { ok: false }
        }
        const gated = gateSiteHtml(result.page.html ?? '') // SON OTORİTE
        if (!gated.ok) {
          await markJobFailed(jobId, `gate_failed:${gated.reason}`)
          if (creditSpent > 0) await refundCreditsServer(userId, creditSpent, 'website_generation_refund')
          return { ok: false }
        }
        // result.pages tam WebsitePageInput[] (sections taşır) → persist olduğu gibi.
        await persistGeneratedSite(userId, site, result, isRevision, creditSpent)
        await markJobComplete(jobId, gated.html, result.designVars)
        return { ok: true }
      })
      logger.info(`[website-agentic] dev-fallback complete: ${jobId}`)
      return { ok: true, jobId, mode: 'dev-fallback' }
    }

    // ÜRETİM YOLU (FAZ 2): sandbox'a dispatch + sonucu bekle.
    await step.run('dispatch-sandbox', async () => {
      await appendJobLog(jobId, 'building_page', 15, 'Sandbox işçisi başlatılıyor')
      // FAZ 2: POST {SANDBOX_URL}/run (HMAC imzalı brand asset URL'leri ile) → 202
      return { ok: true }
    })

    const done = await step.waitForEvent('await-sandbox', {
      event: 'website/generate.sandbox-done',
      timeout: '12m',
      match: 'data.jobId',
    })

    if (!done) {
      await step.run('handle-timeout', async () => {
        await markJobFailed(jobId, 'sandbox_timeout')
        if (creditSpent > 0) await refundCreditsServer(userId, creditSpent, 'website_generation_refund')
        await updateJobStatus(jobId, 'timeout')
        return { ok: false }
      })
      return { ok: false, jobId, reason: 'timeout' }
    }

    await step.run('persist-result', async () => {
      const job = await getWebsiteGenJob(jobId)
      const site = await getWebsite(userId, websiteId)
      if (!site || !job?.generatedHtml) throw new Error('persist-missing-input')
      // İdempotent: zaten completed + persist edilmişse tekrar yazma (reconcile/çift-callback koruması).
      const gated = gateSiteHtml(job.generatedHtml) // SON OTORİTE
      if (!gated.ok) {
        await markJobFailed(jobId, `gate_failed:${gated.reason}`)
        if (creditSpent > 0) await refundCreditsServer(userId, creditSpent, 'website_generation_refund')
        return { ok: false }
      }
      // Sandbox tam sayfa setini job satırına yazar (FAZ 2); burada tek-sayfa landing
      // sözleşmesiyle persist edilir. result.pages tek home sayfası: SECTIONS BOŞ DİZİ
      // ([] geçerli — html+format='html' taşır, sections render'da kullanılmaz).
      const homePage = {
        locale: locales[0], slug: '/', pageRole: 'home' as const,
        sections: [], html: gated.html, format: 'html' as const,
      }
      const result = {
        ok: true as const,
        page: homePage,
        pages: [homePage],
        designVars: job.designVars ?? {},
      }
      await persistGeneratedSite(userId, site, result, isRevision, creditSpent)
      await markJobComplete(jobId, gated.html, job.designVars ?? {})
      return { ok: true }
    })

    logger.info(`[website-agentic] complete: ${jobId}`)
    return { ok: true, jobId }
  },
)
```

> Not (Repo Gerçeği D): üretim-yolu persist objesinde `sections: []` AÇIKÇA verilir çünkü `WebsitePageInput.sections` zorunludur; boş dizi geçerlidir (sunum `format==='html'` iken `html`'i kullanır, `sections`'ı değil — `replacePages` `p.sections`'ı `sections` kolonuna yazar, boş JSON dizi sorun değildir). Dev-fallback yolunda ise `result.pages` motordan gelir ve dolu `sections` taşır.

**2. Route kaydı** — `app/api/inngest/route.ts`:
- import ekle: `import { websiteAgenticGenerate } from '@/inngest/functions/websiteAgenticGenerate'`
- `functions: [ ... , websiteAgenticGenerate ]`

**3. Doğrula:**
```bash
npx tsc --noEmit
node scripts/verify-website-codegen.mjs
```

**4. Commit:**
```bash
git add inngest/functions/websiteAgenticGenerate.ts "app/api/inngest/route.ts"
git commit -m "feat(website-agentic): Inngest orkestratör + dev-fallback inline motor + route kaydı (Faz 1.3)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 1.4 — Job API'leri: GET /job + POST progress + complete (HMAC)

**Files:**
- create: `app/api/website/[id]/job/route.ts` (GET)
- create: `app/api/website/[id]/jobs/[jobId]/progress/route.ts` (POST, HMAC)
- create: `app/api/website/[id]/jobs/[jobId]/complete/route.ts` (POST, HMAC)
- create: `lib/website/sandboxHmac.mjs` (imza doğrulama — **`.mjs`**, testlenebilir saf modül; route'lar buradan import eder)
- create: `scripts/verify-sandbox-hmac.mjs` (saf `.mjs` test)

**Interfaces:**
- consumes: `getCurrentUser` (`@/lib/billing/user`), `getWebsiteGenJob`/`getLatestJobForWebsite`/`appendJobLog`/`markJobComplete` (genJobStore), `inngest` (`@/inngest/client`), `node:crypto`
- produces: `verifySandboxSignature(rawBody, signatureHeader, secret)` (`.mjs`) + 3 route

> Repo Gerçeği A + G: route params Promise DEĞİL (`{ params }: { params: {...} }`); HMAC helper `.mjs` olduğu için plain `node` ile test edilebilir (meta-webhook `verifyWebhookSignature` deseni birebir).

### Adımlar

**1. Failing test yaz** — `scripts/verify-sandbox-hmac.mjs` (saf `.mjs`, `.mjs` import — çalışır):

```javascript
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { verifySandboxSignature } from '../lib/website/sandboxHmac.mjs'

const secret = 'test-secret'
const body = JSON.stringify({ jobId: 'j1', stage: 'building_page', progress: 40 })
const good = 'sha256=' + crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex')

assert.equal(verifySandboxSignature(body, good, secret), true, 'FAIL H1: geçerli imza reddedildi')
assert.equal(verifySandboxSignature(body, 'sha256=deadbeef', secret), false, 'FAIL H2: bozuk imza kabul')
assert.equal(verifySandboxSignature(body, null, secret), false, 'FAIL H3: null header kabul')
console.log('sandboxHmac OK')
```

**2. Çalıştır → FAIL** (modül yok):
```bash
node scripts/verify-sandbox-hmac.mjs
```

**3. Impl** — `lib/website/sandboxHmac.mjs` (meta webhook `verifyWebhookSignature` deseni birebir — `webhook/route.ts:13-19`):

```javascript
import crypto from 'node:crypto'

export function verifySandboxSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return false
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  const a = Buffer.from(signatureHeader)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
```

`app/api/website/[id]/job/route.ts` (GET — UI polling; **params Promise DEĞİL**):

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/billing/user'
import { getWebsiteGenJob, getLatestJobForWebsite } from '@/lib/website/genJobStore'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 })
  const jobId = req.nextUrl.searchParams.get('jobId')
  const job = jobId ? await getWebsiteGenJob(jobId) : await getLatestJobForWebsite(params.id)
  if (!job || job.userId !== user.id || job.websiteId !== params.id) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({
    ok: true,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    lastLog: job.stepLog.at(-1) ?? '',
    done: job.status === 'completed',
    failed: job.status === 'failed' || job.status === 'timeout',
    errorReason: job.errorReason,
  })
}
```

`app/api/website/[id]/jobs/[jobId]/progress/route.ts` (POST — HMAC; **params Promise DEĞİL**):

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifySandboxSignature } from '@/lib/website/sandboxHmac.mjs'
import { appendJobLog } from '@/lib/website/genJobStore'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string; jobId: string } }) {
  const secret = process.env.SANDBOX_HMAC_SECRET
  if (!secret) return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 503 })
  const rawBody = await req.text()
  if (!verifySandboxSignature(rawBody, req.headers.get('x-sandbox-signature-256'), secret)) {
    return NextResponse.json({ ok: false, error: 'bad_signature' }, { status: 401 })
  }
  const { stage, progress, stepMsg } = JSON.parse(rawBody) as { stage: string; progress: number; stepMsg: string }
  await appendJobLog(params.jobId, stage, progress, stepMsg)
  return NextResponse.json({ ok: true })
}
```

`app/api/website/[id]/jobs/[jobId]/complete/route.ts` (POST — HMAC, idempotent + sandbox-done event; **params Promise DEĞİL**):

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { verifySandboxSignature } from '@/lib/website/sandboxHmac.mjs'
import { markJobComplete, getWebsiteGenJob } from '@/lib/website/genJobStore'
import { inngest } from '@/inngest/client'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string; jobId: string } }) {
  const secret = process.env.SANDBOX_HMAC_SECRET
  if (!secret) return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 503 })
  const rawBody = await req.text()
  if (!verifySandboxSignature(rawBody, req.headers.get('x-sandbox-signature-256'), secret)) {
    return NextResponse.json({ ok: false, error: 'bad_signature' }, { status: 401 })
  }
  const { html, designVars } = JSON.parse(rawBody) as { html: string; designVars: Record<string, string> }
  // İdempotent: zaten completed ise tekrar yazma (Storage-önce sözleşmesi).
  const existing = await getWebsiteGenJob(params.jobId)
  if (existing && existing.status !== 'completed') {
    await markJobComplete(params.jobId, html, designVars ?? {})
  }
  await inngest.send({ name: 'website/generate.sandbox-done', data: { jobId: params.jobId } })
  return NextResponse.json({ ok: true })
}
```

> `.mjs` import (`@/lib/website/sandboxHmac.mjs`) `.ts` route'tan: `allowJs`/`tsconfig` zaten projede `.mjs` modüllerini (`renderGate.mjs`, `sanitizeAllowlist.mjs`) `.ts`'ten import ediyor (generate akışı kanıtı) → aynı çözümleme geçerlidir.

**4. Çalıştır → PASS + tip:**
```bash
node scripts/verify-sandbox-hmac.mjs
npx tsc --noEmit
```

**5. Commit:**
```bash
git add "app/api/website/[id]/job/route.ts" "app/api/website/[id]/jobs/[jobId]/progress/route.ts" "app/api/website/[id]/jobs/[jobId]/complete/route.ts" lib/website/sandboxHmac.mjs scripts/verify-sandbox-hmac.mjs
git commit -m "feat(website-agentic): job API'leri (GET /job + HMAC progress/complete callback — Faz 1.4)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 1.5 — generate route: `WEBSITE_AGENTIC` bayrağı (job-başlat-dön)

**Files:**
- modify: `app/api/website/[id]/generate/route.ts`
- create: `scripts/verify-agentic-flag.mjs` (saf `.mjs` flag testi — flag mantığı `.mjs`'e çıkarılır)
- create: `lib/website/agenticFlag.mjs` (saf flag yardımcısı — testlenebilir)

**Interfaces:**
- consumes: `chargeFeature` (`@/lib/billing/featureGuard`), `computeGenerationCost`/`WEBSITE_REVISION_COST`/`WEBSITE_FREE_REVISIONS` (`@/lib/website/credits`), `listVersions` (store), `createWebsiteGenJob` (genJobStore), `inngest`, `isAgenticEnabled` (`@/lib/website/agenticFlag.mjs`)
- produces: bayrak `WEBSITE_AGENTIC='1'` açıkken `{ ok: true, jobId, polling }`; kapalıyken byte-aynı mevcut yol

**Kritik kural:** `WEBSITE_AGENTIC='0'` (veya tanımsız) iken mevcut davranış BYTE-AYNI (hem legacy hem v2 yolları). Bayrak yalnız `isCodegenV2Enabled()` (satır 25) gibi bir guard ekler.

### Adımlar

**1. Failing test yaz** — `scripts/verify-agentic-flag.mjs` (saf `.mjs`):

```javascript
import assert from 'node:assert/strict'
import { isAgenticEnabled } from '../lib/website/agenticFlag.mjs'

const prev = process.env.WEBSITE_AGENTIC
process.env.WEBSITE_AGENTIC = '0'
assert.equal(isAgenticEnabled(), false, 'FAIL: 0 iken false (byte-aynı korunur)')
delete process.env.WEBSITE_AGENTIC
assert.equal(isAgenticEnabled(), false, 'FAIL: tanımsız iken false')
process.env.WEBSITE_AGENTIC = '1'
assert.equal(isAgenticEnabled(), true, 'FAIL: 1 iken true')
process.env.WEBSITE_AGENTIC = prev
console.log('agenticFlag OK')
```

**2. Çalıştır → FAIL:**
```bash
node scripts/verify-agentic-flag.mjs
```

**3. Impl** — `lib/website/agenticFlag.mjs`:

```javascript
export function isAgenticEnabled() {
  return process.env.WEBSITE_AGENTIC === '1'
}
```

`app/api/website/[id]/generate/route.ts` — import + bayrak dalı. Bayrak, **`isCodegenV2Enabled()` dispatch'inden (satır 68) ÖNCE**, auth + site + isRevision hesaplandıktan sonra eklenir. Agentic açıkken: kredi düş → job oluştur → event gönder → dön (senkron üretimi atla). Maliyet hesabı legacy/v2 ile PARİTE (aynı `listVersions` revize sayımı):

```typescript
import { isAgenticEnabled } from '@/lib/website/agenticFlag.mjs'
import { createWebsiteGenJob } from '@/lib/website/genJobStore'
import { inngest } from '@/inngest/client'
```

POST handler'ında (satır 56 `existing`/`isRevision` sonrasında, satır 68 v2-guard'dan ÖNCE):

```typescript
  if (isAgenticEnabled()) {
    // Maliyet — legacy/v2 ile PARİTE.
    let cost: number
    if (isRevision) {
      const versions = await listVersions(user.id, site.id)
      const usedRevisions = versions.filter((v) => v.reason === 'revision').length
      cost = usedRevisions < WEBSITE_FREE_REVISIONS ? 0 : WEBSITE_REVISION_COST
    } else {
      const pageCount = site.siteType === 'multipage' ? 4 : 1
      cost = computeGenerationCost({ siteType: site.siteType, pageCount, localeCount: site.locales.length || 1 })
    }
    const access = await chargeFeature({ featureKey: 'website_generation', creditCost: cost })
    if (!access.ok) return NextResponse.json(access.body, { status: access.status })

    const jobId = await createWebsiteGenJob({
      websiteId: site.id, userId: user.id,
      brief: instructions || site.theme?.initialInstructions || '',
      locales: site.locales, siteType: site.siteType,
    })
    // NOT: updateWebsite(status='generating') YOK — WebsiteStatus enum'unda 'generating' yok
    // (Repo Gerçeği E). İş durumu doğru-kaynağı = website_gen_jobs.status; UI polling job'dan okur.
    await inngest.send({
      name: 'website/generate.agentic',
      data: {
        jobId, websiteId: site.id, userId: user.id,
        brief: instructions || site.theme?.initialInstructions || '',
        locales: site.locales, isRevision, creditSpent: access.spent,
      },
    })
    return NextResponse.json({ ok: true, jobId, polling: `/api/website/${site.id}/job?jobId=${jobId}` })
  }
```

> `instructions`/`isRevision`/`site` mevcut handler scope'unda zaten tanımlı (satır 48-61). `listVersions`/`computeGenerationCost`/`WEBSITE_REVISION_COST`/`WEBSITE_FREE_REVISIONS` zaten import (satır 4,7). `theme.initialInstructions` mevcut v2'de kullanılan alan.

**4. Çalıştır → PASS + byte-aynı regresyon:**
```bash
node scripts/verify-agentic-flag.mjs
node scripts/verify-website-codegen.mjs   # bayrak kapalı → mevcut yol byte-aynı
npx tsc --noEmit
```

**5. Commit:**
```bash
git add "app/api/website/[id]/generate/route.ts" lib/website/agenticFlag.mjs scripts/verify-agentic-flag.mjs
git commit -m "feat(website-agentic): generate route WEBSITE_AGENTIC bayrağı — job-başlat-dön (kapalıyken byte-aynı, Faz 1.5)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 1.6 — UI: handleAi non-blocking + job polling + gerçek progress

**Files:**
- modify: `app/web-site-yoneticisi/[id]/page.tsx` (`handleAi` satır 118-128)
- modify: `components/website/WizardBuildingAnimation.tsx` (sahte `setInterval` satır 24-26 kaldır; props ile beslen)
- create: `lib/website/jobProgress.mjs` (saf stage-eşleme — testlenebilir `.mjs`)
- create: `scripts/verify-job-progress.mjs`
- modify: `locales/tr.json`, `locales/en.json`

**Interfaces:**
- consumes: `POST /api/website/[id]/generate` (→ `{ ok, jobId, polling }` veya mevcut `{ ok, pages }`), `GET /api/website/[id]/job?jobId=`, `GET /api/website/[id]/pages` (mevcut, Repo Gerçeği I)
- produces: non-blocking `handleAi` + `setInterval` polling; `WizardBuildingAnimation` gerçek `{ stage, progress, lastLog }` ile beslenir; `mapJobToStageIndex` (`.mjs`)

### Adımlar

**1. Failing test yaz** — `scripts/verify-job-progress.mjs`:

```javascript
import assert from 'node:assert/strict'
import { mapJobToStageIndex } from '../lib/website/jobProgress.mjs'

assert.equal(mapJobToStageIndex('queued'), 0, 'FAIL: queued→0')
assert.equal(mapJobToStageIndex('design_system'), 0, 'FAIL: design_system→0')
assert.equal(mapJobToStageIndex('building_page'), 1, 'FAIL: building_page→1')
assert.equal(mapJobToStageIndex('polishing'), 2, 'FAIL: polishing→2')
assert.equal(mapJobToStageIndex('completed'), 2, 'FAIL: completed→2')
console.log('jobProgress OK')
```

**2. Çalıştır → FAIL:**
```bash
node scripts/verify-job-progress.mjs
```

**3. Impl** — `lib/website/jobProgress.mjs`:

```javascript
export const STAGE_KEYS = ['stageDesignSystem', 'stageBuildingPage', 'stagePolishing']

export function mapJobToStageIndex(stage) {
  if (stage === 'design_system' || stage === 'queued') return 0
  if (stage === 'building_page') return 1
  return 2 // polishing | completed | diğer
}
```

`app/web-site-yoneticisi/[id]/page.tsx` — `handleAi` (mevcut satır 118-128) non-blocking + polling. Yanıt `jobId` içerirse polling başlat; içermezse (bayrak kapalı, senkron) mevcut davranış byte-aynı:

```tsx
import { mapJobToStageIndex } from '@/lib/website/jobProgress.mjs'
// component state:
const [jobStage, setJobStage] = useState<0 | 1 | 2>(0)
const [jobProgress, setJobProgress] = useState(0)
const [jobLog, setJobLog] = useState('')
const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

const handleAi = async (override?: string) => {
  setBusy('ai'); setGenError('')
  try {
    const res = await fetch(`/api/website/${id}/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instructions: override ?? '' }),
    })
    if (res.status === 402) { setShowCredit(true); return }
    const json = await res.json()

    // Agentic async yol: jobId varsa polling.
    if (json.ok && json.jobId) {
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch(`/api/website/${id}/job?jobId=${json.jobId}`)
          const j = await r.json()
          if (!j.ok) return
          setJobStage(mapJobToStageIndex(j.stage)); setJobProgress(j.progress); setJobLog(j.lastLog ?? '')
          if (j.done) {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
            const pr = await fetch(`/api/website/${id}/pages`)   // mevcut route (Repo Gerçeği I)
            const pj = await pr.json()
            if (pj.ok) { setPages(pj.pages ?? []); setActiveSlug('home') }
            setReloadKey((k) => k + 1); fetchVersions(); setBusy(null); setCreateInitiated(false)
          } else if (j.failed) {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
            setBusy(null); setGenError(t('buildError')); addToast(t('buildError'), 'error')
          }
        } catch { /* tek poll hatası yutulur; sonraki dener */ }
      }, 1500)
      return // busy'yi polling temizler
    }

    // Senkron yol (bayrak kapalı): mevcut davranış byte-aynı.
    if (json.ok) { setPages(json.pages ?? []); setActiveSlug('home'); setReloadKey((k) => k + 1); fetchVersions() }
    else { setGenError(t('buildError')); addToast(t('buildError'), 'error') }
  } catch { setGenError(t('buildError')); addToast(t('buildError'), 'error') }
  finally { if (!pollRef.current) { setBusy(null); setCreateInitiated(false) } }
}
```

> Mevcut `handleAi` (satır 126) hata dalında `t('buildError')` kullanıyor → korunur. `setShowCredit`/`createInitiated` mevcut state'ler (handleAi içinde `setBusy/setCreateInitiated` zaten var — satır 128). Unmount'ta `pollRef` temizliği için bir `useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])` ekle.

`components/website/WizardBuildingAnimation.tsx` — sahte `setInterval` (satır 24-26) kaldırılır; props ile beslenir, `STAGE_KEYS` korunur (satır 16):

```tsx
interface WizardBuildingAnimationProps {
  stage?: 0 | 1 | 2
  progress?: number
  lastLog?: string
}

export default function WizardBuildingAnimation({ stage = 0, progress, lastLog }: WizardBuildingAnimationProps = {}) {
  const tc = useTranslations('website.building')
  const stages = STAGE_KEYS.map((k) => tc(k))
  // KALDIR: const [stage, setStage] = useState(0) + useEffect(setInterval...)
  // Aktif adımı `stage` prop'undan göster; varsa progress bar + lastLog satırı.
}
```

Page'de render: `<WizardBuildingAnimation stage={jobStage} progress={jobProgress} lastLog={jobLog} />` (mevcut çağrı yeri korunur; props geçilir).

`locales/tr.json` + `locales/en.json` — `website.building` namespace'inde **mevcut** `stageDesignSystem`/`stageBuildingPage`/`stagePolishing` anahtarları zaten kullanılıyor (STAGE_KEYS); yoksa HER İKİ dosyaya aynı path ile ekle:
- `website.building.stageDesignSystem` → "Tasarım sistemi kuruluyor" / "Building design system"
- `website.building.stageBuildingPage` → "Sayfa inşa ediliyor" / "Building the page"
- `website.building.stagePolishing` → "Son rötuşlar yapılıyor" / "Final polish"

**4. Çalıştır → PASS + build:**
```bash
node scripts/verify-job-progress.mjs
npx tsc --noEmit
npm run build
```

**5. Commit:**
```bash
git add "app/web-site-yoneticisi/[id]/page.tsx" components/website/WizardBuildingAnimation.tsx lib/website/jobProgress.mjs scripts/verify-job-progress.mjs locales/tr.json locales/en.json
git commit -m "feat(website-agentic): UI non-blocking handleAi + job polling + WizardBuildingAnimation gerçek progress (Faz 1.6)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 1.7 — cron/website-jobs-reconcile yedek bekçi

**Files:**
- create: `app/api/cron/website-jobs-reconcile/route.ts`
- modify: `vercel.json` (`crons` dizisine — her 5 dk)
- create: `scripts/smoke-reconcile.mjs` (gerçek-DB smoke; opsiyonel, `.env.local` ister)

**Interfaces:**
- consumes: `reconcileStaleJobs` (genJobStore), `CRON_SECRET` Bearer (seo-article-run deseni — `seo-article-run/route.ts:23-30`)
- produces: `GET /api/cron/website-jobs-reconcile`

> Test notu: `reconcileStaleJobs` 1.1'de impl edildi; `.ts`+DB → unit-import yok. Smoke (insert stale → reconcile(0) → timeout doğrula → temizle) opsiyonel `.mjs` ile, supabase-js doğrudan. Asıl doğrulama: `npx tsc --noEmit` + cron auth deseni.

### Adımlar

**1. Smoke yaz (opsiyonel)** — `scripts/smoke-reconcile.mjs` (supabase-js doğrudan; eşik=0 ile queued→timeout):

```javascript
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { createClient } = require('@supabase/supabase-js')
try { require('dotenv').config({ path: '.env.local' }) } catch {}
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.log('SKIP'); process.exit(0) }
const db = createClient(url, key)
const { data: sites } = await db.from('websites').select('id,user_id').limit(1)
if (!sites?.length) { console.log('SKIP'); process.exit(0) }
const { data: ins } = await db.from('website_gen_jobs')
  .insert({ website_id: sites[0].id, user_id: sites[0].user_id, status: 'queued', stage: 'queued', progress: 0, locales: ['tr'], site_type: 'landing' })
  .select('id').single()
const cutoff = new Date(Date.now() - 0).toISOString()
await db.from('website_gen_jobs').update({ status: 'timeout', error_reason: 'reconcile:stale', completed_at: new Date().toISOString() })
  .in('status', ['queued', 'running']).lt('updated_at', cutoff).eq('id', ins.id)
const { data: g } = await db.from('website_gen_jobs').select('status').eq('id', ins.id).single()
assert.equal(g.status, 'timeout', 'FAIL: stale reconcile edilmedi')
await db.from('website_gen_jobs').delete().eq('id', ins.id)
console.log('smoke-reconcile OK')
```

**2. Impl** — `app/api/cron/website-jobs-reconcile/route.ts` (`seo-article-run` Bearer deseni birebir):

```typescript
import { NextResponse } from 'next/server'
import { reconcileStaleJobs } from '@/lib/website/genJobStore'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isProduction = process.env.NODE_ENV === 'production'
  if (!cronSecret && isProduction) {
    return NextResponse.json({ ok: false, error: 'Cron not configured' }, { status: 503 })
  }
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }
  const { reconciled } = await reconcileStaleJobs(15)
  return NextResponse.json({ ok: true, reconciled })
}
```

`vercel.json` `crons` dizisine ekle:
```json
{ "path": "/api/cron/website-jobs-reconcile", "schedule": "*/5 * * * *" }
```

**3. Doğrula:**
```bash
node scripts/smoke-reconcile.mjs   # .env.local varsa
npx tsc --noEmit
```

**4. Commit:**
```bash
git add "app/api/cron/website-jobs-reconcile/route.ts" vercel.json scripts/smoke-reconcile.mjs
git commit -m "feat(website-agentic): cron/website-jobs-reconcile yedek bekçi (event-kaybı dayanıklılığı — Faz 1.7)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### FAZ 1 Kabul Kriterleri (anahtar gerekmez)

- `WEBSITE_AGENTIC='0'`: mevcut senkron yol byte-aynı (`node scripts/verify-website-codegen.mjs` geçer; hem legacy hem `WEBSITE_CODEGEN_V2='1'` yolları değişmemiş).
- `WEBSITE_AGENTIC='1'` + sandbox env yok: `POST generate` → `{ ok, jobId, polling }` döner; Inngest **dev-fallback inline motoru** çalıştırıp gerçek site üretir; UI polling gerçek progress gösterir; `done`'da `GET /pages`'ten sayfa görünür.
- Event kaybı senaryosu: `reconcileStaleJobs` takılı job'u `timeout`'a çeker; ilgili Inngest dalı kredi iadesini yapar.
- `gateSiteHtml` SON OTORİTE: gate başarısız → persist YOK + `refundCreditsServer` + job `failed`.
- Tüm yeni UI metni TR+EN; tüm route params **non-Promise** imzayla (Repo Gerçeği A); tüm DB helper'ları `supabase`+`requireClient` (Repo Gerçeği B); Inngest fonksiyonu 2-arg/`triggers:[]` (Repo Gerçeği C).

---

# FAZ 2 — Sandbox AI Motoru (anahtar gerekir) — OUTLINE

> `WEBSITE_AGENTIC='1'` + `SANDBOX_URL`/`SANDBOX_HMAC_SECRET` set olunca FAZ 1.3'teki "üretim yolu" dalı devreye girer. Sandbox işçisi ayrı bir repo/servis (E2B Pro). Aşağıdaki task'lar dosya + amaç + bağımlılık verir.

**Task 2.1 — Agent SDK runner (sandbox işçisi)**
- Dosya: `sandbox-worker/runAgenticBuild.ts` (ayrı servis) + Vercel tarafı dispatch `lib/website/codegen/agentic/runAgenticBuild.ts`
- Amaç: Claude Agent SDK `query()` döngüsü — PLAN→YAZ→BUILD→PRE-GATE→SERVE+SHOT→ÖZ-ELEŞTİRİ→DÜZELT (≤3 tur). Model `claude-opus-4-8` @ effort=`xhigh`, `maxTurns:6`, `max_tokens:16000`, `task_budget:100000`, cache prefix ≥4096 + `ttl:'1h'`.
- Bağımlılık: Agent SDK CLI subprocess (persistent VM), `htmlGenerate.ts` codegen yardımcıları, FAZ 1 callback route'ları (`/progress`, `/complete`).

**Task 2.2 — Design-system prompt kütüphanesi**
- Dosya: `lib/website/codegen/agentic/designSystemPrompts.ts`
- Amaç: Dondurulmuş opinionated tasarım-token kütüphanesi + 3-5 sektör house-style; sabit prefix ≥4096 token (cache uyumu) + `ttl:'1h'`. Anti-jenerik kırmızı çizgiler (Tailwind indigo YASAK, display+sans font, katmanlı gölge, sadece transform/opacity, `transition-all` YASAK). "Önce 4 görsel yön öner".
- Bağımlılık: `toDesignVars` (`htmlGenerate.ts`), codegen tip katmanı.

**Task 2.3 — Playwright CDP screenshot**
- Dosya: `sandbox-worker/screenshot.ts`
- Amaç: localhost serve → Playwright **CDP cihaz emülasyonu** ile PC + mobil PNG (⚠️ `--window-size` sahte-kırpma; kullanma). PNG diske yaz → `Read` (⚠️ media_type 400 tuzağı: base64 inline geçme).
- Bağımlılık: Chromium (sandbox), Task 2.1 döngüsü.

**Task 2.4 — Sandbox-içi pre-gate (renderGate kopyası)**
- Dosya: `sandbox-worker/renderGate.mjs` (`lib/website/codegen/renderGate.mjs` `gateSiteHtml` BİREBİR kopyası)
- Amaç: Her turda pre-gate; geçmezse model düzeltir → Vercel'e ulaşan çıktı zaten gate-geçer (Risk #1). Vercel-tarafı `gateSiteHtml` SON OTORİTE kalır.
- Bağımlılık: cheerio + `sanitizeAllowlist.mjs` kopyası; ana repo `renderGate.mjs` ile senkron tutulur.

**Task 2.5 — VLM ekran-görüntüsü rubriği**
- Dosya: `sandbox-worker/vlmRubric.ts`
- Amaç: Opus 4.8 @ xhigh vision → yapısal JSON diff. Hizalama/simetri ≥4; sıkışma/taşma=5 (kırmızı çizgi); tipografik hiyerarşi ≥4; renk/marka ≥4 (amber/sarı YOK); derinlik/anti-jenerik ≥4; çalışırlık=5.
- Bağımlılık: Task 2.3 PNG'leri, Task 2.1 döngüsü.

**Task 2.6 — Egress proxy + key enjeksiyonu + HMAC callback**
- Dosya: `sandbox-worker/egressProxy.ts` + `lib/website/sandboxHmac.mjs` (FAZ 1.4'te hazır)
- Amaç: API key ajanın env'inde DEĞİL — `ANTHROPIC_BASE_URL=proxy` ile dışarıdan enjekte; `--network none` + domain allowlist (secret-exfil BİRİNCİL TEHDİT). Callback `progress`/`complete` HMAC imzalı.
- Bağımlılık: FAZ 1.4 HMAC route'ları, E2B Firecracker izolasyon.

**Task 2.7 — Daytona/Managed-Agents adapter + dispatch**
- Dosya: `lib/website/codegen/agentic/sandboxAdapter.ts`
- Amaç: E2B Pro birincil, Daytona yedek, Managed Agents POC alternatifi için tek dispatch arayüzü (`POST {SANDBOX}/run` HMAC + imzalı brand asset URL'leri → 202). FAZ 1.3'teki `dispatch-sandbox` step'i bunu çağırır. Watchdog SIGTERM @ 8dk (wall-clock, token tavanından ayrı).
- Bağımlılık: Task 2.1 runner, FAZ 1.3 dispatch dalı.

---

# FAZ 3 — POC + Rollout — OUTLINE

**Task 3.1 — 20-site ölçüm**
- Tek gerçek müşteri brief'iyle 5-10 (sonra 20) site üret. Kanıtla: (a) görsel kalite promake'e ulaşıyor mu (PC+mobil shot karşılaştırması); (b) çıktı `gateSiteHtml`'den İLK seferde geçiyor mu (pre-gate çalışıyor mu); (c) gerçek site-başı maliyet/süre.

**Task 3.2 — Usage log (cache_read / vision token)**
- Her run'da `usage` zorunlu logla: özellikle `cache_read_input_tokens` (sıfırsa cache sessiz-yazmama → ALARM) ve vision token. `website_gen_jobs` satırına `usage JSONB` kolonu (yeni migration). Cache prefix ≥4096 + `ttl:'1h'` doğrulanır.

**Task 3.3 — Fiyat/kredi kilitleme**
- Maliyet ölçülene kadar `WEBSITE_CREDITS` (`lib/website/credits.ts`) DEĞİŞTİRİLMEZ. Ölçülen gerçek maliyet $2.5-3.5 bandının üstüne çıkarsa tarife gözden geçirilir. Marj iddiası ilk 20 site ölçümünden ÖNCE kesinleştirilemez. `computeGenerationCost` mevcut imza korunur.

**Task 3.4 — Bayrak kademeli açılış**
- `WEBSITE_AGENTIC='1'` önce owner/allowlist (`SUPER_ADMIN_EMAILS`) için → küçük kullanıcı yüzdesi → tam. Org-geneli OTPM bütçesi ayrılır (reklam-AI akışları öncelikli; site üretimi düşük kuyruk önceliği — Risk #4). Anında geri-dönüş: `WEBSITE_AGENTIC='0'` → mevcut yol byte-aynı.

---

## İlgili gerçek dosya yolları + doğrulanmış imzalar (referans)

- Spec: `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/docs/superpowers/specs/2026-06-27-agentic-website-generator-design.md`
- `lib/website/store.ts` — `replacePages(userId, websiteId, pages: WebsitePageInput[]): Promise<WebsitePage[]>` (161), `createVersion(websiteId, snapshot, reason, creditCharged=0): Promise<string>` (193), `updateWebsite(userId, id, patch): Promise<Website|null>` (102), `getWebsite(userId, id): Promise<Website|null>` (41), `listVersions` (210); **`requireClient()`** (21) + `import { supabase }` (2)
- `lib/supabase/client.ts` — **tek export `supabase`** (15); `supabaseService` YOK
- `lib/website/types.ts` — `WebsiteStatus = 'draft'|'published'|'unpublished'` (4; **`'generating'` YOK**), `WebsitePageInput { locale, slug, pageRole, sections (zorunlu), seo?, orderIndex?, html?, format? }` (171), `WebsiteSnapshot`, `ThemeTokens`, `VersionReason`
- `lib/website/codegen/renderGate.mjs` — `export function gateSiteHtml(bodyHtml)` (118) → `{ ok, html }` | `{ ok:false, reason }`
- `lib/website/codegen/generateHtmlSite.ts` — `generateHtmlSite(userId, website, opts?): Promise<GenerateHtmlSiteResult>` (161); `GenerateHtmlSiteResult` ok-true = `{ ok:true, page: WebsitePageInput, pages: WebsitePageInput[], designVars: Record<string,string> }` (68)
- `lib/website/credits.ts` — `WEBSITE_CREDITS` (9), `WEBSITE_REVISION_COST=10` (15), `WEBSITE_FREE_REVISIONS=3` (18), `computeGenerationCost(input)` (27)
- `lib/billing/featureGuard.ts` — `chargeFeature({featureKey, creditCost})` → `FeatureGrant{ ok:true, user, isOwner, spent, refund:()=>Promise<void> }` | `FeatureDenial{ ok:false, status, body }` (29-45)
- `lib/billing/db.ts` — `refundCreditsServer(userId, amount, reason='refund'): Promise<CreditRow>` (213)
- `lib/billing/user.ts` — `getCurrentUser(): Promise<AuthenticatedUser|null>` (16) → `{ id, email, name }` (28)
- `inngest/client.ts` — `export const inngest` (14), `isInngestReady()` (19)
- `inngest/functions/perCampaignImprovements.ts` — **createFunction 2-arg, `triggers:[{event}]` config içinde** (78-92), `concurrency:[{limit:5},{key:'event.data.userId',limit:1}]` (85-88)
- `app/api/inngest/route.ts` — `serve({ client, functions:[...] })` (21-32)
- `app/api/website/[id]/generate/route.ts` — `POST(req, { params }: { params: { id: string } })` (34; **non-Promise params**), `isCodegenV2Enabled` (25), v2 dispatch (68), `generateWithCodegenV2` persist bloğu (255-280)
- `app/api/website/[id]/pages/route.ts` — `GET(_req, { params }: { params: { id: string } })` → `{ ok, pages }` (**zaten var**)
- `app/web-site-yoneticisi/[id]/page.tsx` — `handleAi` (118-128), `setPages`/`setActiveSlug`/`setReloadKey`/`fetchVersions`/`setBusy`/`setCreateInitiated`/`setShowCredit`/`setGenError`/`addToast` mevcut; `autoStarted` (151)
- `components/website/WizardBuildingAnimation.tsx` — `STAGE_KEYS` (16), sahte `setInterval` (24-26), `useTranslations('website.building')`
- `app/api/cron/seo-article-run/route.ts` — CRON_SECRET Bearer (23-30), `maxDuration=60` (20)
- `app/api/meta/webhook/route.ts` — `verifyWebhookSignature(rawBody, signatureHeader, appSecret)` `sha256=` + `timingSafeEqual` (13-19), header `x-hub-signature-256` (62)
- `scripts/verify-website-codegen.mjs` — `.mjs`-only test deseni (TS-loading YOK; `createRequire` ile npm + `.mjs` import) → **regresyon komutu: `node scripts/verify-website-codegen.mjs`**

**Plan boyunca uygulanan düzeltmeler (özet):** (1) route params **non-Promise** `{ params: { id } }`; (2) DB client **`supabase`+`requireClient()`** (supabaseService YOK); (3) Inngest **2-arg/`triggers:[]`**; (4) `WebsitePageInput.sections` **zorunlu** → persist `result.pages` olduğu gibi / üretim-yolunda `sections:[]` açıkça; (5) `WebsiteStatus` **'generating' yok** → job tablosu doğru-kaynak; (6) kredi iade **`access.refund()` (route) / `refundCreditsServer` (Inngest)**; (7) testler **`.mjs` saf-mantık + gerçek-DB smoke** (plain `node` `.ts` import edemez; `tsx` yok); (8) regresyon **`node scripts/verify-website-codegen.mjs`**; (9) `/pages` GET **mevcut**; (10) `website_credit_events` **kullanılmaz** → `website_versions`+`chargeFeature`.