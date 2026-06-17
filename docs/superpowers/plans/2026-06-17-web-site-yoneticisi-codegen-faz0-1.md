# Web Site Yöneticisi — Kod-Üretim Motoru (Faz 0 + Faz 1) Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI'nın markaya özgü, göz alıcı **tek sayfalık** bir pazarlama sitesini **serbest HTML/CSS/JS** olarak üretip güvenli (izole + CSP + sanitize) biçimde mevcut `*.yoai.yodijital.com` altında yayınladığı çalışan ilk sürümü kurmak.

**Architecture:** Mevcut `lib/website` veri modeli + yayın yolu korunur; `website_pages`'e `html`/`format` kolonları eklenir (dual-read). Üretim: Stage 0 girdi karantinası → Stage 1 DesignSystem (Opus) → Stage 3 tek-sayfa HTML (Opus, streaming) → görsel çözümleme (mevcut stock) → sanitize → renderGate → `assembleDocument` (head + nonce'lı CSS/runtime). Servis: yeni `app/(sites)/` route group içinde provider'sız minimal layout + `/s/:path*` segmentine CSP; `format='html'` → `HtmlSiteRenderer`, `'sections'` → mevcut `SiteRenderer`. Tümü `WEBSITE_CODEGEN_V2` bayrağı arkasında.

**Tech Stack:** Next.js 14.2 (App Router) · TypeScript · Tailwind 3.4.1 (server-side programatik derleme) · Supabase Postgres · `@anthropic-ai/sdk` 0.97.1 (Opus 4.8 adaptive thinking + streaming) · `sanitize-html` (yeni) · `cheerio` 1.2.0 (mevcut) · Inngest 4.4 (Faz 2'de fan-out; Faz 1 route içi).

## Global Constraints

- **Test idiomu:** Proje unit-test framework KULLANMAZ. Otomatik doğrulama = `scripts/verify-*.mjs` (node ile, assert'li) + `npm run build` (tip) + `npm run lint`. Görsel/işlevsel = app'i çalıştır + screenshot. Yeni framework EKLEME.
- **Model:** ilk üretim/DesignSystem = `claude-opus-4-8`; revizyon/planner/çeviri = `claude-sonnet-4-6`. Opus 4.8 → `thinking: { type: 'adaptive' }` + `output_config: { effort: 'high' }`; `budget_tokens` YASAK (400 verir). `temperature`/`top_p` YASAK. Yeni env: `ANTHROPIC_MODEL_WEBSITE_INITIAL` (default `claude-opus-4-8`), `ANTHROPIC_MODEL_WEBSITE_REVISION` (default `claude-sonnet-4-6`).
- **Bayrak:** Yeni üretim yalnız `WEBSITE_CODEGEN_V2 === '1'` iken çalışır; kapalıyken mevcut `generateSitePages` yolu korunur. **Render her zaman `page.format`'a bakar (bayrağa değil).**
- **Renk yasağı:** amber/sarı/hardal hiçbir koşulda yok (üretim prompt'unda da yasak).
- **i18n:** YoAi panel metinleri `locales/tr.json` + `locales/en.json`'a additive eklenir (mevcut anahtar değiştirilmez). Üretilen SİTE içeriği `website.defaultLocale`'e göre.
- **Dokunma:** `lib/meta/*`, `lib/google/*` ve reklam publish akışları — DEĞİŞTİRİLMEZ.
- **Paralel oturum:** ortak dosyalarda (`tailwind.config.ts`, `middleware.ts`, `next.config.mjs`, `package.json`, `locales/*`) additive davran; mevcut satırları yeniden yazma.
- **İzolasyon:** Tüm iş bu worktree'de (`worktree-web-site-yoneticisi-codegen`).

---

## Dosya Yapısı (oluştur/değiştir)

**Yeni dosyalar:**
- `lib/website/codegen/buildCodegenContext.ts` — Stage 0 girdi + karantina
- `lib/website/codegen/designSystem.ts` — Stage 1 DesignSystem (Opus)
- `lib/website/codegen/htmlGenerate.ts` — Stage 3 tek-sayfa HTML (Opus streaming)
- `lib/website/codegen/sanitizeHtml.ts` — deny-by-default sanitize
- `lib/website/codegen/tailwindCompile.ts` — server-side Tailwind JIT → CSS string
- `lib/website/codegen/renderGate.ts` — parse + kritik bölüm + boyut kapısı
- `lib/website/codegen/assembleDocument.ts` — `<head>` + nonce + CSS + runtime montajı
- `lib/website/codegen/generateHtmlSite.ts` — orkestratör (0→1→3→stock→sanitize→gate)
- `lib/website/codegen/types.ts` — DesignSystem, CodegenContext, GateResult tipleri
- `lib/website/render/HtmlSiteRenderer.tsx` — `format='html'` render bileşeni
- `public/yoai-site-runtime.js` — sürümlü declarative hareket runtime'ı
- `app/(sites)/layout.tsx` — minimal, provider'sız layout
- `scripts/verify-website-codegen.mjs` — sanitize + renderGate + tailwindCompile doğrulama

**Taşınan dosyalar (route group; URL değişmez):**
- `app/s/[subdomain]/page.tsx` → `app/(sites)/s/[subdomain]/page.tsx`
- `app/s/[subdomain]/[slug]/page.tsx` → `app/(sites)/s/[subdomain]/[slug]/page.tsx`

**Değişen dosyalar:**
- `supabase/migrations/20260617120000_website_html_format.sql` (yeni migration)
- `scripts/apply-website-html-format-migration.mjs` (yeni, mevcut `apply-website-tables-migration.mjs` desenine göre) + `package.json` scripts'e `db:migrate:website-html`
- `lib/website/types.ts` — `WebsitePage`/`WebsitePageRow`/`WebsitePageInput`'e `html`/`format`; `rowToPage` güncelle
- `lib/website/store.ts` — `replacePages` html/format yazsın; select'ler kolonları alsın
- `next.config.mjs` — `headers()` ekle (CSP, yalnız `/s/:path*`)
- `app/website-preview/[id]/page.tsx` — `format==='html'` dalı (iframe srcdoc)
- `app/api/website/[id]/generate/route.ts` — bayrak arkasında yeni motora yönlendir + kredi kalibrasyon
- `package.json` — `sanitize-html` + `@types/sanitize-html` ekle

---

## Task 1: Bağımlılık — sanitize-html

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Kur**

```bash
npm install sanitize-html@^2.13.0 && npm install -D @types/sanitize-html@^2.13.0
```

- [ ] **Step 2: Doğrula**

Run: `node -e "console.log(require('sanitize-html')('<b onclick=x>hi</b>'))"`
Expected: `<b>hi</b>` (on* handler düşer)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build(web-site-yoneticisi): sanitize-html bağımlılığı"
```

---

## Task 2: Veri modeli — `html` + `format` kolonları (dual-read)

**Files:**
- Create: `supabase/migrations/20260617120000_website_html_format.sql`
- Create: `scripts/apply-website-html-format-migration.mjs`
- Modify: `package.json` (scripts)
- Modify: `lib/website/types.ts` (`WebsitePage`, `WebsitePageRow`, `WebsitePageInput`, `rowToPage`)
- Modify: `lib/website/store.ts` (`replacePages` ve sayfa select'leri)

**Interfaces:**
- Produces: `WebsitePage.html?: string | null`, `WebsitePage.format: 'sections' | 'html'`; `WebsitePageInput.html?`, `WebsitePageInput.format?`. Tüm mevcut satırlar `format='sections'` (DB default).

- [ ] **Step 1: Migration SQL yaz**

`supabase/migrations/20260617120000_website_html_format.sql`:
```sql
-- Web Site Yöneticisi kod-üretim motoru: serbest HTML çıktısı için kolonlar
ALTER TABLE website_pages
  ADD COLUMN IF NOT EXISTS html TEXT,
  ADD COLUMN IF NOT EXISTS format TEXT NOT NULL DEFAULT 'sections';

ALTER TABLE website_pages
  DROP CONSTRAINT IF EXISTS website_pages_format_chk;
ALTER TABLE website_pages
  ADD CONSTRAINT website_pages_format_chk CHECK (format IN ('sections','html'));
```

- [ ] **Step 2: Migration uygulayıcı script yaz**

`scripts/apply-website-html-format-migration.mjs` — `scripts/apply-website-tables-migration.mjs` dosyasını model al; aynı Supabase bağlantı + `exec`/`rpc` desenini kullan, dosya adını `20260617120000_website_html_format.sql` yap. (Mevcut script'i oku ve birebir uyarla.)

`package.json` scripts içine ekle:
```json
"db:migrate:website-html": "node scripts/apply-website-html-format-migration.mjs",
```

- [ ] **Step 3: Tipleri güncelle**

`lib/website/types.ts` — `WebsitePage`'e ekle: `html?: string | null` ve `format: 'sections' | 'html'`. `WebsitePageRow`'a ekle: `html?: string | null` ve `format?: string`. `WebsitePageInput`'a ekle: `html?: string | null` ve `format?: 'sections' | 'html'`. `rowToPage` güncelle:
```typescript
export function rowToPage(r: WebsitePageRow): WebsitePage {
  return {
    // ...mevcut alanlar...
    html: r.html ?? null,
    format: (r.format as 'sections' | 'html') ?? 'sections',
  }
}
```

- [ ] **Step 4: `store.ts` `replacePages` ve select'leri güncelle**

`replacePages` insert objelerine `html: p.html ?? null` ve `format: p.format ?? 'sections'` ekle. `getPages`/`getPublishedSiteBySubdomain`/`rollback` `select('*')` kullanıyorsa yeni kolonlar otomatik gelir; `rowToPage` zaten map'liyor. (Açık kolon listesi varsa `html, format` ekle.)

- [ ] **Step 5: Tip kontrolü**

Run: `npm run build`
Expected: TypeScript hatasız derlenir (yeni alanlar opsiyonel/defaultlu).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260617120000_website_html_format.sql scripts/apply-website-html-format-migration.mjs package.json lib/website/types.ts lib/website/store.ts
git commit -m "feat(web-site-yoneticisi): website_pages html+format kolonları (dual-read)"
```

> **Not:** Migration'ı gerçek DB'ye uygulama adımı (`npm run db:migrate:website-html`) yayın/test ortamında elle çalıştırılır; plan kapsamında SQL + uygulayıcı hazırlanır.

---

## Task 3: `(sites)` route group + minimal layout (URL korunur)

**Files:**
- Create: `app/(sites)/layout.tsx`
- Move: `app/s/[subdomain]/page.tsx` → `app/(sites)/s/[subdomain]/page.tsx`
- Move: `app/s/[subdomain]/[slug]/page.tsx` → `app/(sites)/s/[subdomain]/[slug]/page.tsx`

**Interfaces:**
- Route group parantezli klasör URL'e yansımaz → `/s/<subdomain>` aynen korunur. `app/(sites)/layout.tsx` bu segment için root `app/layout.tsx`'in yerine geçer (Next.js'te en yakın layout kazanır; ama root layout `<html>`/`<body>`'yi sağlar — bu yüzden `(sites)/layout.tsx` kendi `<html>`/`<body>`'sini verir ve root provider'lardan kaçınmak için segment'i ayırır).

> **KRİTİK Next.js davranışı:** App Router'da root `app/layout.tsx` her zaman uygulanır; route group bunu ezmez. Tek `<html>`/`<body>` olabilir. Bu yüzden **provider'sız izolasyon** için root layout'ı, çocuklarına göre koşullu hale getiremeyiz. Çözüm: root `app/layout.tsx`'i sadeleştirip provider'ları `app/(app)/layout.tsx`'e taşımak GEREKİR — bu büyük dokunuş. **Faz 0 kararı:** kapsamı küçük tutmak için provider'ları taşımak yerine, root layout'taki provider'ları `/s/` ve `/website-preview` path'lerinde **atlayan** mevcut desene (CookieConsent zaten bunu yapıyor) uygun şekilde, root layout'a path-bazlı koşul ekle: `headers()` ile gelen pathname `/s/` veya custom-domain ise yalnız `{children}` render et (NextIntl/Credit/Subscription/Analytics SARMA). Aksi halde tam provider zinciri.

- [ ] **Step 1: Root layout'u path-koşullu yap**

`app/layout.tsx` — `next/headers` `headers()` ile `x-pathname` (middleware'de set edilecek, Step 2) veya `headers().get('x-invoke-path')` oku; site servis path'i ise (`/s/` ile başlıyorsa veya custom-domain header'ı varsa) provider'ları atla:
```tsx
import { headers } from 'next/headers'
// ...
const h = await headers()
const pathname = h.get('x-pathname') || ''
const isPublicSite = pathname.startsWith('/s/')
// render: isPublicSite ? <html lang={locale}><body>{children}</body></html>
//                      : <html><body><AnalyticsScripts/><NextIntl...>{providers}</NextIntl></body></html>
```

- [ ] **Step 2: middleware'de `x-pathname` set et (additive)**

`middleware.ts` — mevcut response'lara dokunmadan, geçen tüm isteklerde request header'a pathname ekle (mevcut `NextResponse.next()`/`rewrite` çağrılarına `request.headers` set ederek). Custom-domain rewrite zaten `/s/<sub>`'a çeviriyor → `x-pathname` `/s/...` olur. Mevcut mantığı bozma; yalnız header ekle.

- [ ] **Step 3: Sayfaları taşı**

```bash
mkdir -p "app/(sites)/s/[subdomain]/[slug]"
git mv "app/s/[subdomain]/[slug]/page.tsx" "app/(sites)/s/[subdomain]/[slug]/page.tsx"
git mv "app/s/[subdomain]/page.tsx" "app/(sites)/s/[subdomain]/page.tsx"
```

- [ ] **Step 4: `(sites)/layout.tsx` ekle (pass-through)**

```tsx
// app/(sites)/layout.tsx — site segmenti: ek provider yok
export default function SitesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

- [ ] **Step 5: Build + manuel doğrulama**

Run: `npm run build`
Expected: Hatasız. Sonra `npm run dev` + bir yayınlanmış test sitesi `/s/<subdomain>` aç → eskisi gibi render olmalı, ama sayfa kaynağında CreditProvider/analytics script OLMAMALI.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(web-site-yoneticisi): (sites) route group + /s public site provider izolasyonu"
```

---

## Task 4: CSP — yalnız `/s/:path*` segmenti

**Files:**
- Modify: `next.config.mjs`

**Interfaces:**
- Produces: `/s/*` yanıtlarına `Content-Security-Policy` header'ı. Nonce dinamik olduğundan (Task 8), header'da `script-src 'self'` + `style-src 'self'`; inline `<style>`/`<script>` için Task 8 nonce kullanır → header'a `'nonce-...'` koyamayız (statik). **Karar:** runtime ve CSS harici dosya olarak servis edilir (`/yoai-site-runtime.js` = `'self'`; per-site CSS Task 8'de `<style>` yerine `'self'` linkli olamaz çünkü dinamik). Bu yüzden CSP `style-src 'self' 'unsafe-inline'` DEĞİL — bunun yerine per-site CSS'i nonce'suz çözmek için Task 8 CSS'i `<style>` ile gömer ve CSP `style-src` hash tabanlı olur. **Basitleştirme (Faz 1):** CSS gömülü `<style>` → CSP'de `style-src 'self' 'unsafe-inline'` GEÇİCİ; script tarafı sıkı (`script-src 'self'`). Faz 3'te style nonce/hash'e geçilir. (Bu ödün belgelenir; script-injection riski — asıl tehlike — kapalı kalır.)

- [ ] **Step 1: `headers()` ekle**

`next.config.mjs` içine (withNextIntl sarmalı korunarak) ekle:
```js
async headers() {
  return [{
    source: '/s/:path*',
    headers: [{
      key: 'Content-Security-Policy',
      value: [
        "default-src 'none'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' https: data:",
        "font-src https://fonts.gstatic.com",
        "connect-src 'self'",
        "frame-ancestors 'self'",
        "base-uri 'none'",
        "form-action 'self'",
      ].join('; '),
    }],
  }]
}
```

- [ ] **Step 2: Build + header doğrula**

Run: `npm run build && npm run dev` sonra `curl -sI http://localhost:3000/s/<subdomain> | grep -i content-security`
Expected: CSP header görünür.

- [ ] **Step 3: Commit**

```bash
git add next.config.mjs
git commit -m "feat(web-site-yoneticisi): /s segmentine CSP (script-src self)"
```

---

## Task 5: `yoai-site-runtime.js` (declarative hareket runtime'ı)

**Files:**
- Create: `public/yoai-site-runtime.js`

**Interfaces:**
- Produces: `data-yoai-reveal`, `data-yoai-toggle="<targetId>"`, `data-yoai-nav-toggle`, `data-yoai-smooth` attribute'larını işleyen, parametreleri (`data-yoai-duration`, `data-yoai-delay`, `data-yoai-threshold`) `data-*`'tan okuyan, harici bağımlılıksız IIFE. Sürüm: dosya başında `/* yoai-site-runtime v1 */`.

- [ ] **Step 1: Runtime yaz** (IntersectionObserver ile reveal; click ile toggle/nav; smooth scroll). Tam, bağımlılıksız, `'use strict'` IIFE. `prefers-reduced-motion` guard.

- [ ] **Step 2: Doğrula** — `node -e "require('fs').readFileSync('public/yoai-site-runtime.js','utf8')"` parse hatası vermez; basit bir HTML'de elle aç (Task 18'de e2e).

- [ ] **Step 3: Commit** — `git add public/yoai-site-runtime.js && git commit -m "feat(web-site-yoneticisi): site runtime (declarative reveal/toggle/smooth)"`

---

## Task 6: `sanitizeHtml.ts` (deny-by-default)

**Files:**
- Create: `lib/website/codegen/sanitizeHtml.ts`
- Create: `lib/website/codegen/types.ts` (paylaşılan tipler)
- Test: `scripts/verify-website-codegen.mjs` (bu task'ta sanitize bölümü)

**Interfaces:**
- Produces: `sanitizeSiteHtml(bodyHtml: string): string` — yalnız beyaz-listeli etiket/attribute bırakır; `<script>`, `on*`, `javascript:`/`data:`-script URI, `<iframe>/<object>/<embed>`, `<form action>` dış host, `style` attr içinde `url(javascript:)` strip. `data-yoai-*` attribute'larına ve Tailwind `class`'a izin verir. Allowlist sabit: `SAFE_TAGS`, `SAFE_ATTRS` export edilir (renderGate kullanır).

- [ ] **Step 1: Allowlist + sanitize fonksiyonu yaz** (`sanitize-html` ile; `allowedTags`, `allowedAttributes` deny-by-default; `data-yoai-*` için `allowedAttributes['*']` regex; `a[href]` yalnız `http/https/#/mailto/tel`; `img[src]` yalnız `https/data:image`).

- [ ] **Step 2: verify script — sanitize assertions**

`scripts/verify-website-codegen.mjs` (node, assert):
```js
import assert from 'node:assert'
import { sanitizeSiteHtml } from '../lib/website/codegen/sanitizeHtml.ts' // tsx/loader gerekiyorsa derlenmiş yol; aşağıdaki nota bak
assert.ok(!sanitizeSiteHtml('<script>alert(1)</script><h1>ok</h1>').includes('script'))
assert.ok(!sanitizeSiteHtml('<a href="javascript:x">y</a>').includes('javascript:'))
assert.ok(sanitizeSiteHtml('<section data-yoai-reveal class="grid"><h1>x</h1></section>').includes('data-yoai-reveal'))
console.log('sanitize OK')
```
> **TS yükleme notu:** verify script'leri `.mjs`. TS modüllerini çağırmak için ya (a) ilgili saf-mantık modüllerini `.mjs`-uyumlu (dependency'siz) yaz ve `import` et, ya da (b) script başında `tsx`/`esbuild-register` kullan. Proje `tsx` içermiyor → **tercih:** saf-mantık modüllerini (sanitize/gate/tailwindCompile) Node'dan çağrılabilecek şekilde yaz; verify script `node --import tsx` yerine, modülleri test eden ince bir derleme adımı kullan. Basitlik: verify script kendi içinde `sanitize-html` ile aynı allowlist'i çağırıp davranışı doğrular (modülle paylaşılan sabitleri JSON olarak import ederek tekrarı önle). (Uygulayıcı en az tekrarlı yolu seçer.)

- [ ] **Step 3: Çalıştır** — `node scripts/verify-website-codegen.mjs` → `sanitize OK`.

- [ ] **Step 4: Commit** — `git commit -m "feat(web-site-yoneticisi): sanitizeSiteHtml (deny-by-default)"`

---

## Task 7: `tailwindCompile.ts` (server-side Tailwind JIT)

**Files:**
- Create: `lib/website/codegen/tailwindCompile.ts`

**Interfaces:**
- Produces: `async compileSiteCss(bodyHtml: string, designVars: Record<string,string>): Promise<string>` — verilen HTML'deki Tailwind class'larından minimal CSS üretir (`tailwindcss` + `postcss` Node API; `content: [{ raw: bodyHtml, extension: 'html' }]`, preflight açık). Çıktı CSS string. `designVars` (DesignSystem'den) `:root` değişkenleri olarak başa eklenir.

- [ ] **Step 1: Compile fonksiyonu yaz** — `postcss([ tailwindcss({ content:[{raw:bodyHtml,extension:'html'}], corePlugins:{preflight:true}, theme:{extend:{}} }), autoprefixer ]).process('@tailwind base;@tailwind utilities;', {from:undefined})`. Başına `:root{ ...designVars }` ekle.

- [ ] **Step 2: verify — compile çıktısı boş değil**

`verify-website-codegen.mjs`'e ekle: `compileSiteCss('<div class="flex p-4 text-3xl"></div>', {'--x':'1'})` → çıktı `.flex`, `.p-4`, `:root` içerir. Run: `node scripts/verify-website-codegen.mjs`.

- [ ] **Step 3: Commit** — `git commit -m "feat(web-site-yoneticisi): tailwindCompile (per-site server JIT)"`

---

## Task 8: `assembleDocument.ts` (`<head>` + nonce + CSS + runtime)

**Files:**
- Create: `lib/website/codegen/assembleDocument.ts`

**Interfaces:**
- Consumes: `sanitizeSiteHtml` (Task 6), `compileSiteCss` (Task 7).
- Produces: `async assembleDocument(args: { bodyHtml: string; designVars: Record<string,string>; seo: { title?: string; description?: string }; lang: string; fontHref?: string | null; mode: 'serve' | 'preview' }): Promise<string>` — tam `<!doctype html>` döner. `mode='serve'`: runtime `<script src="/yoai-site-runtime.js">` (CSP `'self'`), CSS `<style>` gömülü. `mode='preview'`: runtime INLINE gömülü (srcdoc'ta harici fetch yok), CSS inline. Head'i biz kurarız (charset, viewport, title, meta description, `og:`, canonical yok, `<link>` Google fonts preconnect + fontHref).

- [ ] **Step 1: assembleDocument yaz** — `bodyHtml`'i `sanitizeSiteHtml`'den geçir, `compileSiteCss` çağır, head'i deterministik kur. `mode='preview'` ise `public/yoai-site-runtime.js` içeriğini `fs.readFileSync` ile oku ve `<script>` içine göm.

- [ ] **Step 2: verify — tam belge yapısı**

`verify`'e ekle: çıktı `<!doctype html`, tek `<title>`, `<meta name="viewport"`, `</html>` içerir; `mode='serve'` çıktısında `<script src="/yoai-site-runtime.js">`. Run: `node scripts/verify-website-codegen.mjs`.

- [ ] **Step 3: Commit** — `git commit -m "feat(web-site-yoneticisi): assembleDocument (head + css + runtime montajı)"`

---

## Task 9: `renderGate.ts` (zorunlu kapı)

**Files:**
- Create: `lib/website/codegen/renderGate.ts`

**Interfaces:**
- Produces: `gateSiteHtml(bodyHtml: string): { ok: true; html: string } | { ok: false; reason: string }` — `cheerio` ile parse; kontroller: (a) parse edilebilir, (b) en az bir `<h1>` var ve tek `<h1>`, (c) en az bir landmark (`header`/`nav`/`main`/`footer`), (d) boyut < 220KB, (e) yasak kalıntı yok (`<script` dış, `on*`). Geçerse sanitize edilmiş html döner.

- [ ] **Step 1: gate fonksiyonu yaz** (cheerio load, sayım, boyut, sanitize çağrısı).

- [ ] **Step 2: verify — gate kabul/ret**

`verify`'e ekle: geçerli HTML `ok:true`; `<h1>` yoksa `ok:false reason`; iki `<h1>` `ok:false`. Run: `node scripts/verify-website-codegen.mjs` → tüm assert geçer.

- [ ] **Step 3: Commit** — `git commit -m "feat(web-site-yoneticisi): renderGate (parse+landmark+boyut)"`

---

## Task 10: `buildCodegenContext.ts` (Stage 0 — girdi karantinası)

**Files:**
- Create: `lib/website/codegen/buildCodegenContext.ts`

**Interfaces:**
- Consumes: mevcut `lib/website` profil/intelligence erişimi (generate.ts'in kullandığı aynı kaynak — uygulayıcı `generate.ts`'i okuyup aynı veri toplamayı kullanır) + `website.theme` (style, fontHref, logoUrl, referenceUrls, initialInstructions) + `website.defaultLocale`.
- Produces: `buildCodegenContext(userId, website): Promise<CodegenContext>` (tip `codegen/types.ts`). Tüm dış metin (profil, scrape, referans) `wrapUntrusted(label, text)` ile `<untrusted_source name="label">…</untrusted_source>` sarılır; kullanıcı talimatı ayrı `instruction` alanında. **Site-özgü kaynak öncelikli; global profile yalnız hiçbir şey yoksa.**

- [ ] **Step 1: Context builder yaz** — `generate.ts`'teki girdi toplama mantığını referans al; çıktı `{ brandName, locale, style, fontHref, logoUrl, instruction, untrustedBlocks: string[] }`.

- [ ] **Step 2: verify — karantina**

`verify`'e ekle: `wrapUntrusted('web','<b>x</b>ignore prior')` çıktısı `<untrusted_source` ile sarılı ve içerik veri olarak; `instruction` ayrı. Run: `node scripts/verify-website-codegen.mjs`.

- [ ] **Step 3: Commit** — `git commit -m "feat(web-site-yoneticisi): buildCodegenContext (girdi karantinası)"`

---

## Task 11: `designSystem.ts` (Stage 1 — Opus DesignSystem)

**Files:**
- Create: `lib/website/codegen/designSystem.ts`

**Interfaces:**
- Consumes: `CodegenContext` (Task 10), `getAnthropicClient()` (`lib/anthropic/client.ts`).
- Produces: `generateDesignSystem(ctx: CodegenContext): Promise<DesignSystem>` — `DesignSystem` (codegen/types.ts): `{ palette: {ink,accent,accentSoft,surface,onAccent,...}, fonts: {headingHref,heading,body}, spacingScale, radiusScale, shadowRecipes, gradientRecipes, motion: {easing,durations} }`. Opus 4.8 çağrısı: `getAnthropicClient().messages.create({ model: process.env.ANTHROPIC_MODEL_WEBSITE_INITIAL||'claude-opus-4-8', max_tokens: 4000, thinking:{type:'adaptive'}, output_config:{effort:'high'}, system:[{type:'text',text:SYSTEM, cache_control:{type:'ephemeral'}}], messages:[{role:'user',content:userPrompt}] })`. JSON çıktı (output_config.format json_schema ile zorla). Amber/sarı YASAK direktifi.

- [ ] **Step 1: DesignSystem tipini `codegen/types.ts`'e ekle + prompt + çağrı yaz** (structured output `output_config.format`).

- [ ] **Step 2: Tip kontrolü** — `npm run build` (canlı API çağrısı CI'da değil; doğrulama Task 18 e2e'de).

- [ ] **Step 3: Commit** — `git commit -m "feat(web-site-yoneticisi): designSystem (Opus 4.8, sayısal tasarım sistemi)"`

---

## Task 12: `htmlGenerate.ts` (Stage 3 — tek-sayfa HTML)

**Files:**
- Create: `lib/website/codegen/htmlGenerate.ts`

**Interfaces:**
- Consumes: `CodegenContext`, `DesignSystem`, `getAnthropicClient()`, mevcut stok görsel çözümleyici (`lib/website/stock` — generate.ts'in kullandığı; uygulayıcı imzayı oradan alır).
- Produces: `generateHomePageHtml(ctx, ds): Promise<string>` — Opus 4.8 **streaming** (`client.messages.stream({...}).finalMessage()`), `max_tokens: 16000`, `thinking:{type:'adaptive'}`, `output_config:{effort:'high'}`. Çıktı: yalnız `<body>` iç HTML (doctype/head YOK). Görseller `{{IMG:query}}` placeholder. Prompt: yalnız DesignSystem-türevli Tailwind class'ları; `data-yoai-block`/`data-yoai-id` her üst bölüme; tek `<h1>`; hareket `data-yoai-reveal`; amber/sarı yasak; off-brand içerik yok; ödeme/login formu yok. Dönüşte `{{IMG:...}}` → stok URL ile değiştir (mevcut stock fonksiyonu).

- [ ] **Step 1: Prompt + streaming çağrı + `{{IMG}}` çözümleme yaz.**

- [ ] **Step 2: Tip kontrolü** — `npm run build`.

- [ ] **Step 3: Commit** — `git commit -m "feat(web-site-yoneticisi): htmlGenerate (Opus streaming, tek sayfa)"`

---

## Task 13: `generateHtmlSite.ts` (orkestratör)

**Files:**
- Create: `lib/website/codegen/generateHtmlSite.ts`

**Interfaces:**
- Consumes: Task 10–12 + `gateSiteHtml` (Task 9).
- Produces: `generateHtmlSite(userId, website): Promise<{ ok: true; page: WebsitePageInput } | { ok: false; reason: string }>` — akış: context → designSystem → homeHtml → gate (geçmezse 1 self-repair: kısa "şu kuralı düzelt" Opus çağrısı → tekrar gate; hâlâ olmazsa `ok:false`). Başarıda `WebsitePageInput` döner: `{ locale: website.defaultLocale, slug:'home', pageRole:'home', sections:[], html: gatedBody, format:'html', seo:{...}, orderIndex:0 }`. `designSystem`'in CSS değişkenleri `website.theme`/snapshot'a yazılması için `designVars` de döndürülür (kayıt Task 15'te).

- [ ] **Step 1: Orkestratör + self-repair (1 deneme) yaz.**

- [ ] **Step 2: Tip kontrolü** — `npm run build`.

- [ ] **Step 3: Commit** — `git commit -m "feat(web-site-yoneticisi): generateHtmlSite orkestratör + self-repair"`

---

## Task 14: `HtmlSiteRenderer.tsx` + dual-read serving

**Files:**
- Create: `lib/website/render/HtmlSiteRenderer.tsx`
- Modify: `app/(sites)/s/[subdomain]/page.tsx` (home — format dalı)
- Modify: `app/(sites)/s/[subdomain]/[slug]/page.tsx` (slug — format dalı)

**Interfaces:**
- Consumes: `assembleDocument` (Task 8), `page.html`, `page.format`, `website.theme` (designVars için), `website.defaultLocale`.
- Produces: `HtmlSiteRenderer` — Server Component; `page.format==='html'` sayfayı **tam belge** olarak basar. `/s` servisinde sayfa zaten kendi `<html>`'ini içerir (assembleDocument) → Next sayfası `dangerouslySetInnerHTML` yerine, route'tan `new Response(html, {headers:{'content-type':'text/html'}})` döndüren bir yaklaşım gerekir. **Karar:** `/s` home/slug sayfalarını, `format==='html'` ise `assembleDocument(...)` çıktısını döndüren bir Route Handler davranışına çevirmek yerine, App Router sayfasında tam-belge basmak mümkün değil (çift `<html>`). **Çözüm:** `format==='html'` sayfalar için servis bir `route.ts` (Route Handler) üzerinden yapılır: `app/(sites)/s/[subdomain]/route.ts` ve `[slug]/route.ts` GET → `assembleDocument` → `new NextResponse(html,{headers})`. `format==='sections'` ise mevcut `page.tsx` + `SiteRenderer` korunur. İki yol bir arada olamayacağından (aynı segmentte hem `page.tsx` hem `route.ts` çakışır), **birleşik Route Handler** kullanılır: `route.ts` içinde `getPublishedSiteBySubdomain` → `format==='html'` ? assembleDocument response : `sections` için `renderToStaticMarkup(<SiteRenderer/>)` ile string'e çevirip aynı şekilde response. Böylece tek giriş, dual-read.

> **Uygulama detayı:** `react-dom/server` `renderToStaticMarkup` ile `SiteRenderer` (sections) string'e çevrilir; HTML (codegen) `assembleDocument`'ten gelir. Her ikisi de `text/html` response. `force-dynamic` korunur (`export const dynamic='force-dynamic'`).

- [ ] **Step 1: `page.tsx`'leri `route.ts`'e çevir (home + slug)** — `getPublishedSiteBySubdomain` + `pickLocale` (mevcut yardımcıdan) + format dalı; `sections` için `renderToStaticMarkup(<SiteRenderer page theme/>)`; `html` için `assembleDocument({bodyHtml:page.html!, designVars: themeToDesignVars(theme), seo:page.seo, lang:locale, fontHref:theme.fontHref, mode:'serve'})`. `generateMetadata` artık route handler'da geçersiz → SEO head `assembleDocument`/SiteRenderer markup'ında üretilir (zaten head'i biz montelyoruz).
- [ ] **Step 2: Build + manuel** — `npm run build`; bir `sections` formatlı mevcut yayınlanmış site hâlâ doğru render olmalı (regresyon yok).
- [ ] **Step 3: Commit** — `git commit -m "feat(web-site-yoneticisi): dual-read serving (html route handler + sections SSR)"`

---

## Task 15: generate route — yeni motora bağla (bayrak + kredi)

**Files:**
- Modify: `app/api/website/[id]/generate/route.ts`

**Interfaces:**
- Consumes: `generateHtmlSite` (Task 13), mevcut `chargeFeature`/`replacePages`/`createVersion`.
- Produces: `WEBSITE_CODEGEN_V2==='1'` iken: kredi maliyeti = `computeGenerationCost({siteType:'landing', pageCount:1, localeCount:1})` (Faz 1 tek sayfa); `chargeFeature` → `generateHtmlSite` → başarıda `replacePages(user.id, id, [page])` + `createVersion(id, snapshot, 'initial'|'revision', spent)` + `theme`'e `compiledCssVersion`/designVars yansıt; **`ok:false` (gate fail) → `access.refund()` + 422 `{ ok:false, error }`** (canlıya bozuk site çıkmaz). Bayrak kapalıysa mevcut `generateSitePages` yolu aynen.

- [ ] **Step 1: Route'a bayrak dalı ekle** (mevcut yol korunur; yeni yol additive).
- [ ] **Step 2: Build** — `npm run build`.
- [ ] **Step 3: Commit** — `git commit -m "feat(web-site-yoneticisi): generate route → codegen v2 (bayrak + kredi + gate-fail iade)"`

---

## Task 16: Önizleme — `format==='html'` dalı (iframe srcdoc)

**Files:**
- Modify: `app/website-preview/[id]/page.tsx`

**Interfaces:**
- Consumes: `assembleDocument(..., mode:'preview')`.
- Produces: sahibin taslağı `format==='html'` ise, sayfayı inline SiteRenderer yerine `<iframe srcDoc={await assembleDocument({...,mode:'preview'})} sandbox="allow-scripts" className="w-full h-screen border-0" />` ile gösterir (runtime inline gömülü olduğu için srcdoc'ta çalışır; `allow-same-origin` YOK). `sections` ise mevcut inline SiteRenderer korunur.

- [ ] **Step 1: Preview page'e format dalı ekle.**
- [ ] **Step 2: Build** — `npm run build`.
- [ ] **Step 3: Commit** — `git commit -m "feat(web-site-yoneticisi): html önizleme (sandboxed iframe srcdoc)"`

---

## Task 17: i18n anahtarları + UI rozeti (additive)

**Files:**
- Modify: `locales/tr.json`, `locales/en.json`

**Interfaces:**
- Produces: Yeni motor için gereken kullanıcı-yüzlü metinler (örn. üretim sırasında "AI siteni kodluyor…", gate-fail toast "Site üretilemedi, krediniz iade edildi") — HEM tr HEM en, additive (mevcut anahtara dokunma).

- [ ] **Step 1: Anahtarları iki dile de ekle** (namespace `website.codegen.*`).
- [ ] **Step 2: Build** — `npm run build`.
- [ ] **Step 3: Commit** — `git commit -m "i18n(web-site-yoneticisi): codegen v2 metinleri (tr+en)"`

---

## Task 18: Uçtan uca doğrulama + screenshot (deliverable)

**Files:** (yok — manuel + script)

- [ ] **Step 1: Saf-mantık doğrulaması** — `node scripts/verify-website-codegen.mjs` (sanitize+gate+tailwind+assemble) → tüm assert geçer.
- [ ] **Step 2: Build + lint** — `npm run build && npm run lint` → hatasız.
- [ ] **Step 3: Canlı üretim (lokal)** — `.env.local`'e `WEBSITE_CODEGEN_V2=1` + `ANTHROPIC_API_KEY` ile `npm run dev`; bir test sitesi oluştur → AI üret → önizlemede tek sayfalık göz alıcı site görünür.
- [ ] **Step 4: Yayınla + /s doğrula** — publish → `/s/<subdomain>` aç; `curl -sI` ile CSP header; sayfa kaynağında dashboard provider/analytics YOK; `<script src="/yoai-site-runtime.js">` var.
- [ ] **Step 5: Screenshot** — üretilen sitenin ekran görüntüsünü al (frontend-design skill / Playwright veya proje screenshot yöntemi), referans kalite (Lovable/Bolt) ile karşılaştır; en az 2 tur iyileştir.
- [ ] **Step 6: Regresyon** — `format='sections'` eski bir yayınlanmış site hâlâ doğru render → kanıtla.
- [ ] **Step 7: CHANGELOG** — `docs/CHANGELOG.md`'ye giriş (Sorun/Çözüm/Dosyalar).
- [ ] **Step 8: Commit** — `git commit -m "docs(web-site-yoneticisi): Faz 0-1 changelog + e2e doğrulama"`

---

## Self-Review (spec kapsama)

- Spec §2 izolasyon → Task 3,4 ✓ · §3 pipeline (Stage 0/1/3/4/5) → Task 10,11,12,13,9 ✓ · §4 güvenlik (CSP/sanitize/JS) → Task 4,5,6,8 ✓ · §5 SEO (head deterministik) → Task 8,14 ✓ (ISR Faz sonrası) · §6 önizleme → Task 16 ✓ (chat-edit Faz 3) · §7 veri modeli → Task 2 ✓ · §8 yayın dual-read → Task 14 ✓ · §9 model/kredi → Task 11,12,15 ✓ · §10 migrasyon/bayrak → Task 2,14,15 ✓.
- **Faz 2 (çok-sayfa+dil)** ve **Faz 3 (chat-edit + ISR + görsel cilası)** → ayrı planlar.
- **Tip tutarlılığı:** `WebsitePageInput.html/format` (Task 2) → `generateHtmlSite` üretir (Task 13) → `replacePages` yazar (Task 15) → `rowToPage` okur (Task 2) → `route.ts` render eder (Task 14). `DesignSystem` (Task 11) → `designVars` (Task 13/14/8). Tutarlı.
- **Bilinen ödün:** CSP `style-src 'unsafe-inline'` (Faz 1 gömülü CSS) — asıl tehlike olan script-injection `script-src 'self'` ile kapalı; style nonce/hash Faz 3.
