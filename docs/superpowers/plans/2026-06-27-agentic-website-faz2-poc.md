# Faz 2 POC — Agentic Web Sitesi Üreticisi (DÜZELTİLMİŞ — Öz-Denetimli)

> Format: `superpowers:writing-plans`. POC-öncelikli. **Tüm SDK/API iddiaları 2026-06-27'de resmi doklardan + canlı `npm view`/registry ile yeniden doğrulandı.** Öz-denetim 7 KÖK DÜZELTME buldu (hepsi inline işlendi). Repoya YAZMA yok — salt plan.

---

## ⛔ DÜZELTME LOGU (öz-denetimde bulunan + düzeltilen gerçek hatalar)

| # | Sorun (orijinal plan) | Kanıt (resmi/canlı) | Düzeltme |
|---|---|---|---|
| **D1** | `sandbox._experimental_createSnapshot('...')` ile **çalışan sandbox'tan** snapshot | Daytona docs: snapshot **Image'dan** üretilir → `daytona.snapshot.create(CreateSnapshotParams({name, image}), {onLogs})`. Çalışan sandbox'tan snapshot **dokümante DEĞİL**. | Snapshot **`daytona.snapshot.create()`** ile Image'dan üretilir. `_experimental_createSnapshot` **silindi**. |
| **D2** | `create({ snapshot, resources, autoStopInterval })` | `CreateSandboxFromSnapshotParams` **`resources` KABUL ETMEZ** (yalnız image-params resources alır). | Snapshot'tan açışta `resources` kaldırıldı; CPU/mem/disk snapshot create anında baked. |
| **D3** | `await daytona.delete(sandbox, 60)` | Doküman: silme **instance metodu** → `sandbox.delete(timeout)` (default 60s). `daytona.delete(sandbox,...)` yok. | Tüm silmeler **`await sandbox.delete(60)`**. |
| **D4** | base image `playwright:v1.49.0-jammy` (+ npm sürümü belirsiz) | Canlı registry: `v1.49.0` **stale** (en eski listeli v1.59.0, güncel v1.61.1). Image-içi Chromium ↔ npm `playwright` (latest 1.61.1) **EŞLEŞMELİ**. | **`v1.61.1-jammy`** + `playwright@1.61.1` pin'lendi. |
| **D5** | A2 başarı kriteri: "prefix **≥4096 token** olmalı yoksa cache yazılmaz" | Resmi cache-min tablosu: **`claude-opus-4-8` = 1,024 token** (4096 yalnız Opus 4.5/4.6). | Eşik **≥1024 token**; suni 4096 şişirme şartı **kaldırıldı**. |
| **D6** | `env:{ENABLE_PROMPT_CACHING_1H:'1'}` ile 1h cache | 1h TTL = `cache_control:{ttl:'1h'}` (raw API). Agent SDK `cache_control`'ü el ile açmaz (otomatik); `ENABLE_PROMPT_CACHING_1H` Agent SDK Options'ta **dokümante DEĞİL → uydurma riski**. | Env satırı **kaldırıldı**. Caching otomatik; 1h-TTL Agent SDK'da var mı = **TAHMİN → A5'te `cache_read>0` ile ölç**. |
| **D7** | `runAgenticBuild` dönüşü `GenerateHtmlSiteResult` (senkron çağrışım) | Faz 1 Yol B **ASENKRON**: `dispatch-sandbox`(202)→`waitForEvent(...,12m)`→`persist-result` `job.generatedHtml`'tan okur. Senkron dönüş akışı **ihlal eder**. | `runAgenticBuild` **`{accepted:true}`** döndürür; HTML **HMAC callback** ile `job`'a yazılır. `GenerateHtmlSiteResult` benzeşmesi `persist-result` step'inde (zaten kodlu). |

> **Orijinalde DOĞRU olup korunanlar:** `query()` Options (`model/systemPrompt/mcpServers/allowedTools/disallowedTools/permissionMode/settingSources/cwd/maxTurns/abortController/env/includePartialMessages`), **`effort:'low'|'medium'|'high'|'xhigh'|'max'`**, **`maxBudgetUsd:number`**, **`taskBudget:{total}` (Alpha)**, `tool()`+`createSdkMcpServer()`, result `total_cost_usd`; Daytona `Image.base/runCommands/workdir/env`, `executeCommand→{exitCode,result,artifacts.stdout}`, `process.createSession`+`executeSessionCommand`, `fs.uploadFile(Buffer,remotePath)`/`fs.downloadFile(remotePath)→Buffer`, `autoStopInterval`. Faz 1 imzaları kod okumasıyla teyit (gate reason key'leri, `compileSiteCss(bodyHtml,designVars)`, `signSandboxBody/isTimestampFresh(300)`, `WebsiteGenJob.generatedHtml/designVars`, `markJobComplete`, `isAgenticEnabled`).

---

## Header

### Goal
`promake.ai` kalitesinde anti-jenerik statik pazarlama sitesi üreten agentic döngüyü standalone kanıtla + ölç; sonra Faz 1 `websiteAgenticGenerate.ts` Yol B boşluğunu (`dispatch-sandbox`, satır 144-149) doldur. Döngü: **yaz → Tailwind compile → sandbox-içi pre-gate → Playwright CDP PC+mobil screenshot → Opus 4.8 (effort high↔xhigh) vision öz-eleştiri → düzelt (≤3 tur)**. Çıktı: tek sanitize-uyumlu Tailwind-class'lı **gövde** HTML. Başarı (spec §12.3): (a) görsel kalite, (b) `gateSiteHtml` **ilk seferde** geçiyor mu, (c) gerçek $/site + süre.

### Architecture
```
[Vercel API+UI]  →  [Inngest orkestratör]  →  [Daytona sandbox: Agent SDK query() döngüsü]
   (ASAMA B)             (ASAMA B)                    (ASAMA A — POC burada)
```
- **POC (ASAMA A):** yerel `poc/runPoc.mjs` → `daytona.snapshot.create()` ile bir kez base snapshot → `daytona.create({snapshot})` → worker `fs.uploadFile` ile yüklenir → çalışır → sonuç (gövde HTML + designVars + usage + PC/mobil PNG) `fs.downloadFile` ile yerel diske inilir. Vercel/Inngest YOK.
- **Entegrasyon (ASAMA B):** Aynı worker `runAgenticBuild.ts` ile **asenkron** dispatch; sandbox bitince **HMAC callback** → `job.generated_html`/`design_vars` + `inngest.send('website/generate.sandbox-done',{jobId})` → mevcut `persist-result` step `gateSiteHtml` (SON OTORİTE) → `persistGeneratedSite`.

**Auto-stop gerçeği:** arka-plan fire-and-forget aktivite saymaz (default 15dk stop). Döngü her turda `executeCommand`/`fs.*` çağırınca timer sıfırlanır — yine de **`autoStopInterval:0` + işçi-tarafı 8dk SIGTERM watchdog + iş bitince `sandbox.delete(60)`** üç hat (spec §11 risk #2).

### Tech Stack
| Katman | Seçim | Doğrulama (2026-06-27) |
|---|---|---|
| Sandbox | **`@daytona/sdk`** (= `@daytonaio/sdk`, ikisi v0.192.0) | canlı `npm view`; `DAYTONA_API_KEY` .env.local'de; pay-per-use |
| Agent SDK | **`@anthropic-ai/claude-agent-sdk`** v0.3.195 — repo'daki `@anthropic-ai/sdk@0.97.1`'den **AYRI paket** | canlı `npm view`; CLI bundle'lı; sandbox'ta koşar |
| Model | `claude-opus-4-8` @ `effort` high↔xhigh sweep | $5/$25 per 1M, 1M ctx, 128K out; **cache-min 1,024 tok**; vision ≤4784tok/2576px |
| Tarayıcı | **`mcr.microsoft.com/playwright:v1.61.1-jammy`** + `playwright@1.61.1` | canlı registry; CDP emülasyon; `--window-size` YASAK |
| Tailwind | `compileSiteCss(bodyHtml, designVars)` (kopya) | kod okuması — inline per-site config |
| Gate | `gateSiteHtml` (kopya) | kod okuması — reason key'ler stabil |

### Global Constraints
1. **Çıktı = `format:'html'` tek gövde HTML.** Astro DEĞİL. `<style>/<link>/<meta>/<script>` gövdede YASAK; tek `<h1>`; ≥1 landmark; ≤220KB.
2. **Serve-time AI-JS YASAK.** `<head>`+`<style>` sarmalama yalnız sandbox render doğrulaması için; teslim **head'siz/style'sız gövde**. Etkileşim yalnız `data-dijimagic-*`.
3. **`gateSiteHtml` SON OTORİTE** (Vercel'de `persist-result`/`dev-fallback` zaten çağırıyor — değişmez).
4. **Kanonik env (DEĞİŞMEZ):** `WEBSITE_AGENTIC`, `WEBSITE_SANDBOX_URL`, `WEBSITE_SANDBOX_HMAC_SECRET`. POC'ta `ANTHROPIC_API_KEY`+`DAYTONA_API_KEY`. **`ENABLE_PROMPT_CACHING_1H` KULLANILMAZ (D6).**
5. **Maliyet tavanı:** `maxBudgetUsd: 4` + `taskBudget:{total:100_000}` + `maxTurns: 6`.
6. **Wall-clock watchdog (token DEĞİL):** `abortController` + `setTimeout(8dk)→ac.abort()`; `autoStopInterval:0` + `sandbox.delete(60)` ikinci/üçüncü hat.
7. **Cross-tenant izolasyon:** `settingSources: []` (CLAUDE.md/global `.claude` YÜKLENMEZ), `cwd:/work/<jobId>`, `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`, per-tenant `CLAUDE_CONFIG_DIR`. **`systemPrompt` düz string = preset'i tamamen değiştirir** → izolasyonla uyumlu.
8. **Güvenlik — key sandbox env'ine GÖMÜLMEZ (B5).** POC'ta doğrudan (izole hesap, kabul); üretimde `ANTHROPIC_BASE_URL=<egress-proxy>` ile enjekte, key proxy'de.
9. **Repoya yazma POC'ta yok** — `poc/` repo-dışı.

---

## ASAMA A — POC (standalone, full detay)

### A1 — Base snapshot (Node+Playwright+Tailwind+Agent SDK) — `daytona.snapshot.create()` (D1/D2/D3/D4)

**Adım 1 — paket + auth (yerel):**
```bash
cd <poc-dir>
npm init -y
npm install @daytona/sdk @anthropic-ai/claude-agent-sdk zod
node -e "const d=require('@daytona/sdk'); console.log(typeof d.Daytona, typeof d.Image)"   # function function
set -a; . .env.local; set +a   # DAYTONA_API_KEY + ANTHROPIC_API_KEY shell'e
```
> `new Daytona()` argümansız `DAYTONA_API_KEY` env'ini otomatik okur.

**Adım 2 — Image builder + snapshot'a dondur (`poc/buildSnapshot.mjs`) — DÜZELTİLMİŞ:**
```js
import { Daytona, Image } from '@daytona/sdk'

const image = Image.base('mcr.microsoft.com/playwright:v1.61.1-jammy') // D4: güncel tag; Chromium+deps gömülü
  .workdir('/app')
  .runCommands(
    'npm init -y',
    // D4: image-içi Chromium ↔ npm playwright sürümü EŞLEŞMELİ (1.61.1)
    'npm install @anthropic-ai/claude-agent-sdk@^0.3 zod playwright@1.61.1 tailwindcss@3 postcss autoprefixer cheerio sanitize-html',
    'npx playwright install chromium', // doğru revizyon binary garanti
  )
  .env({ NODE_ENV: 'production' })

const daytona = new Daytona()
// D1: snapshot çalışan sandbox'tan DEĞİL — Image'dan üretilir
await daytona.snapshot.create(
  { name: 'website-builder-base', image, resources: { cpu: 2, memory: 4, disk: 8 } },
  { onLogs: (c) => process.stdout.write(c) },
)
console.log('snapshot hazır: website-builder-base')
```
> ⚠️ `CreateSnapshotParams` alan adlarını (özellikle `resources` iç içe mi düz `cpu/memory/disk` mi) ilk run'da logla; minor fark olursa SDK'nın `.d.ts`'inden oku — uydurma yok.

**Adım 3 — snapshot'tan aç + 3 doğrulama (D2: `resources` YOK; D3: `sandbox.delete`):**
```js
const sb = await daytona.create(
  { snapshot: 'website-builder-base', autoStopInterval: 0 }, // D2: snapshot-params resources ALMAZ
  { timeout: 0 },
)
const r1 = await sb.process.executeCommand('node -v && npx tailwindcss --help | head -1')
const r2 = await sb.process.executeCommand(`node -e "require('playwright'); console.log('pw-ok')"`)
const r3 = await sb.process.executeCommand(`node -e "require('@anthropic-ai/claude-agent-sdk'); console.log('sdk-ok')"`)
console.log(r1.exitCode, r2.artifacts.stdout, r3.artifacts.stdout) // exitCode===0 + beklenen stdout
await sb.delete(60) // D3: instance metodu
```
**Biter:** named snapshot + 3 doğrulama yeşil + açılış süresi loglandı. (Snapshot başarısızsa fallback: her run `create({image})` cold-build — 3-6 dk ekstra, A5'te raporla.)

---

### A2 — Agent harness: design system + anti-jenerik + "4 yön öner" + marka enjeksiyonu (D5)

**Adım 1 — `poc/prompts/designSystem.mjs` (sabit):** `lib/website/codegen/designSystem.ts` çekirdeğini POC'a kopyala; şunlarla genişlet:
- **Çıktı sözleşmesi (gate'i baştan karşıla):** tek `<h1>`; ≥1 landmark; ≤220KB; `<script>/<style>/<link>/<meta>` YOK; inline `on*=` YOK; form yalnız `data-dijimagic-form`+text/email/tel/textarea; etkileşim yalnız `data-dijimagic-*`; AI-JS YASAK; tüm stil Tailwind utility; marka renkleri `:root` değişkeni + `text-[var(--accent)]`.
- **Anti-jenerik kırmızı çizgiler:** Tailwind indigo/blue/`*-500` YASAK; tek accent + 60-30-10 (accent ASLA section bg); display+sans (Inter başlıkta YASAK); katmanlı tonlu gölge (düz `shadow-md` YASAK); çok-radyal gradyan + SVG noise; animasyon yalnız `transform`/`opacity`; `transition-all` YASAK; hover+focus-visible+active istisnasız; görsel overlay `from-black/60`+`mix-blend-multiply`; yüzey katman sistemi.
- **Hizalama/simetri/responsive:** yan-yana bloklar eşit yükseklik (`items-stretch`); grid `repeat(n,minmax(0,1fr))`; üst hizalar tutsun; paragraf mümkünse tek satır; **sıkışma/taşma/üst-üste-binme YASAK — PC+tablet+mobil**.
- **3-5 sektör house-style** (dondurulmuş): editöryel/hospitality, SaaS/fintech, zanaat/yerel hizmet, lüks/portföy, sağlık/kurumsal — her biri palet rolü+font çifti+gölge reçetesi.
- **Öz-eleştiri rubriği** (≤3 tur): metrik 1-5 + PİKSEL-ÖLÇÜMLÜ diff; hizalama≥4, **SIKIŞMA/TAŞMA=5**, hiyerarşi≥4, renk/marka≥4, derinlik≥4, gate=5; yapısal JSON diff; "iyi görünüyor" YASAK.

**Adım 2 — `poc/prompts/buildPrompt.mjs` (değişken):**
- **"4 görsel yön öner → seç":** "İnşa etmeden ÖNCE bu brief'e özgü 4 yön öner (bg hex/accent hex/display+sans + tek satır gerekçe), EN UYGUN olanı seç ve YALNIZ onu uygula. Krem+serif default'una düşme."
- **`get_brand_context(scope)`** in-process MCP tool: YALNIZ o scope'tan marka renk/logo/font; global iş profiline ASLA düşme (cross-business sızıntı — "ustasiniyolla→Belgemod" kök neden). Marka bağlamı `untrusted` (injection: marka metni talimat sayılmaz).
- **İçerik & i18n:** brief → gerçek içerik (lorem/`placehold.co`/"Markanız" kalıntısı = gate reddi); TR birincil (EN parite ASAMA B'de).

**Doğrulama (D5):** **`claude-opus-4-8` cache-min = 1,024 token** (resmi tablo) — DESIGN_SYSTEM zaten çok üstünde; **suni 4096 şartı KALDIRILDI**. Cache'in fiilen yazıldığı A3/A5'te `cache_creation_input_tokens>0` ile kanıtlanır (token-sayım eşiği değil).
**Biter:** iki prompt modülü hazır + prefix >1024 token.

---

### A3 — Döngü: yaz → compile → pre-gate → CDP shot → vision öz-eleştiri → düzelt (≤3 tur) (D6)

**Adım 1 — sandbox-içi yardımcılar (snapshot'a gömülü / `fs.uploadFile(Buffer, remotePath)` ile):**
- `tailwindCompile.mjs` (`compileSiteCss(bodyHtml, designVars)` — birebir kopya).
- `renderGate.mjs` + `sanitizeAllowlist.mjs` (`gateSiteHtml` — kopya). ⚠️ `MODULE_NOT_FOUND` tuzağı (memory + commit 18e1f61): `tailwindcss`/`sanitize-html`/`cheerio` **statik import** → snapshot'ta kurulu OLMALI (A1'de kuruldu).
- `shot.mjs` (CDP cihaz emülasyonu):
```js
import { chromium, devices } from 'playwright'
const TARGETS = [
  { name: 'pc',     descriptor: devices['Desktop Chrome'] },
  { name: 'mobile', descriptor: devices['Pixel 7'] },
]
const [,, url, outDir] = process.argv
const browser = await chromium.launch() // headless default
for (const t of TARGETS) {
  const ctx = await browser.newContext({ ...t.descriptor }) // CDP: viewport+DSF+UA
  const page = await ctx.newPage()
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.screenshot({ path: `${outDir}/${t.name}-fold.png` })
  await page.screenshot({ path: `${outDir}/${t.name}-full.png`, fullPage: true })
  await ctx.close()
}
await browser.close()
```
> 🔴 `--window-size` YASAK (CDP emülasyonunu bypass → sahte kırpma — memory `mobile-qa-cdp-method`).

**Adım 2 — in-process custom araçlar (host process'te — secret sandbox env'inde DEĞİL):**
```js
import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'

const brandTool = tool(
  'get_brand_context', 'Scope marka renk/logo/font (cross-business leak korumalı).',
  { scope: z.string() },
  async ({ scope }) => ({ content: [{ type: 'text', text: JSON.stringify(await loadScopedBrand(scope)) }] }),
  { annotations: { readOnlyHint: true } },
)
const preGateTool = tool(
  'render_gate', 'gateSiteHtml sandbox-içi kopyası. Geçmezse reason döner.',
  { html: z.string() },
  async ({ html }) => {
    const r = gateSiteHtml(html)
    return r.ok
      ? { content: [{ type: 'text', text: 'GATE PASS' }] }
      : { content: [{ type: 'text', text: r.reason }], isError: true } // throw ETME — loop ölür
  },
)
const harness = createSdkMcpServer({ name: 'harness', version: '1.0.0', tools: [brandTool, preGateTool] })
```
> `tool(name, description, inputSchema, handler, extras?)` + `createSdkMcpServer({name, version?, tools?})` resmi doğrulandı.

**Adım 3 — döngü gövdesi + vision öz-eleştiri (Yol A `Read` birincil) — D6 ENV DÜZELTİLDİ:**
Vision için **`Read` tool** birincil (single-mode string prompt base64 görsel DESTEKLEMEZ; `Read` araç-sonucu muaf). **Emniyet ağı:** aynı turda `Bash('file --mime-type ... ; identify -format "%wx%h" ...')` ile boyut/MIME metni de besle.
```js
import { query } from '@anthropic-ai/claude-agent-sdk'

const ac = new AbortController()
const killer = setTimeout(() => ac.abort(), 8 * 60_000) // wall-clock watchdog
let finalHtml = '', usageLog = null
try {
  for await (const m of query({
    prompt: buildDrivePrompt(process.env.BRIEF, process.env.SCOPE),
    options: {
      model: 'claude-opus-4-8',
      effort: 'high',                       // POC: high↔xhigh sweep ('low'|'medium'|'high'|'xhigh'|'max')
      systemPrompt: DESIGN_SYSTEM_PROMPT,   // düz string → preset'i değiştirir (izolasyon); cache otomatik
      mcpServers: { harness },
      allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'mcp__harness__*'],
      disallowedTools: ['WebSearch', 'WebFetch', 'Bash(curl *)', 'Bash(wget *)'],
      permissionMode: 'bypassPermissions',
      settingSources: [],                   // CLAUDE.md/global .claude YÜKLENMEZ
      cwd: `/work/${process.env.JOB_ID}`,
      maxTurns: 6,
      maxBudgetUsd: 4,                      // USD hard-cap (client-side estimate)
      taskBudget: { total: 100_000 },      // token (Alpha)
      abortController: ac,
      env: {
        ...process.env,
        CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1',
        CLAUDE_CONFIG_DIR: `/tmp/cfg-${process.env.JOB_ID}`,
        // D6: ENABLE_PROMPT_CACHING_1H KALDIRILDI (Agent SDK Options'ta dokümante değil; caching otomatik)
        // ANTHROPIC_BASE_URL: egress-proxy (ASAMA B)
      },
      includePartialMessages: true,
    },
  })) {
    if (m.type === 'result') {
      if (m.subtype === 'success') finalHtml = m.result
      usageLog = {
        cost_estimate_usd: m.total_cost_usd,             // TAHMİN — faturaya kullanma
        cache_read: m.usage?.cache_read_input_tokens,    // 0 ise ALARM
        cache_write: m.usage?.cache_creation_input_tokens,
        in: m.usage?.input_tokens, out: m.usage?.output_tokens,
        turns: m.num_turns, ms: m.duration_ms, modelUsage: m.modelUsage,
      }
    }
  }
} finally { clearTimeout(killer) }
```
**Döngü iç akışı (model'in yürüteceği) — serve background (`process.createSession`):**
```
PLAN → 4 yön öner+seç (get_brand_context scope'lu)
YAZ → Write /work/<job>/site/body.html (Tailwind-class)
BUILD → Bash: node compile.mjs body.html > site/site.css (compileSiteCss; hata→Edit)
PRE-GATE → mcp__harness__render_gate(body.html); reason key → Edit düzelt
SERVE → worker: process.createSession + executeSessionCommand{runAsync:true} ile  `python3 -m http.server 4321` arka planda (bare executeSessionCommand session GEREKTİRİR)
SHOT → Bash: node shot.mjs http://localhost:4321 /work/<job>/shots
ÖZ-ELEŞTİRİ → Read pc-fold.png + mobile-fold.png + Bash file/identify → rubrik JSON diff
DÜZELT → BUILD'e dön (≥2 tur; görünür fark kalmayınca dur, ≤3 tur)
İNDİRGE → son adım: head/style/script çıkar → teslim head'siz gövde
```
**Doğrulama:** (a) `render_gate` ilk PASS turu, (b) piksel-ölçümlü diff üretildi mi, (c) `cache_read>0` mu (D6: cache'in fiilen yazıldığının TEK kanıtı).
**Biter:** worker bir brief'i 1-3 turda gate-geçer gövde HTML'e indirdi + usage logladı.

---

### A4 — Sonucu tek gövde-HTML'e indir + usage/maliyet logla (D3)

**Adım 1:** `worker.mjs` sonunda `fs.writeFile('/work/<job>/result.json', {html, designVars, usage})`. Teslim HTML head'siz gövde.
**Adım 2 — yerel indir (`poc/runPoc.mjs`) — D3:**
```js
const resBuf = await sandbox.fs.downloadFile(`/work/${jobId}/result.json`) // Promise<Buffer>
const { html, designVars, usage } = JSON.parse(resBuf.toString())
for (const name of ['pc-fold','mobile-fold','pc-full','mobile-full']) {
  const png = await sandbox.fs.downloadFile(`/work/${jobId}/shots/${name}.png`) // Buffer
  await writeFile(`./out/${jobId}/${name}.png`, png)
}
await writeFile(`./out/${jobId}/result.html`, html)
await writeFile(`./out/${jobId}/usage.json`, JSON.stringify(usage, null, 2))
await sandbox.delete(60) // D3: instance metodu (stopped'da bile disk faturalanır)
```
**Adım 3 — yerel gate (SON OTORİTE simülasyonu):** `result.html` → yerel `gateSiteHtml`. **İlk seferde PASS** (spec §12.3.b); fail → pre-gate eksik → A3.
**Doğrulama/maliyet:** `cache_read>0` doğrula (D6: eşik token-sayımı değil, fiili read). Maliyet `usage` token'larından + resmi fiyat (`total_cost_usd`'a GÜVENME): `in×$5/1M + out×$25/1M + cache_write×(1h:2×) + cache_read×0.1×$5/1M`. Sandbox compute ≈ ihmal, yine logla.
**Biter:** `out/<jobId>/` = 4 PNG + gövde HTML + usage.json + $/site; yerel gate PASS.

---

### A5 — Çalıştır: 1-3 gerçek brief, ekran görüntüsü + maliyet/süre (D6 cache ölçümü)

**Adım 1:** owner'dan 1-3 gerçek brief (hospitality + SaaS + yerel hizmet). Her biri `runPoc.mjs <brief>`.
**Adım 2:** 4 PNG; `usage.json` → $/site + süre + `cache_read`/vision token (turn-diff izole) + pre-gate ilk-PASS + yerel gate.
**Adım 3 — `effort` sweep:** ≥1 brief'i `high` VE `xhigh` ile; kalite ↔ maliyet/süre yan yana (spec §8).
**Adım 4 — teslim:** PNG'leri `SendUserFile` ile + tablo `| brief | effort | $/site | süre | pre-gate ilk-PASS | cache_read | yerel gate |` + görsel-kalite değerlendirmesi (promake yakınlık).
**Doğrulama (spec §12.3):** (a) görsel kalite, (b) gate ilk-PASS, (c) $/site $2.5-3.5 bandında mı.
**Biter (ASAMA A):** PNG + maliyet/süre tablosu owner'da; üç kanıt yanıtlandı; **cache_read>0 ile caching fiilen çalıştığı kanıtlandı** (D6 — env-toggle iddiası yerine ölçümle).

---

## ASAMA B — Faz 1 entegrasyonu (OUTLINE) — D7 ile uyumlu

- **B1 — `lib/website/codegen/agentic/runAgenticBuild.ts` oluştur** (dizin YOK). Daytona snapshot spawn + worker dispatch. **D7: dönüş `Promise<{accepted:true}|{accepted:false,reason}>` — `GenerateHtmlSiteResult` DEĞİL.** HTML/designVars senkron dönmez; HMAC callback ile `job`'a yazılır. `GenerateHtmlSiteResult` benzeşmesi `persist-result` step'inde (satır 196-209, zaten kodlu).
- **B2 — `dispatch-sandbox` (satır 144-149) doldur.** `POST {WEBSITE_SANDBOX_URL}/run` (HMAC imzalı brief + scope'lu imzalı brand-asset URL'leri, `signSandboxBody(rawBody, WEBSITE_SANDBOX_HMAC_SECRET)`) → 202. Mevcut `waitForEvent('await-sandbox', 12m)` korunur.
- **B3 — sandbox→callback HMAC.** `POST .../jobs/<jobId>/{progress,complete}` — `signSandboxBody` + `isTimestampFresh(ts, now, 300)` (300s replay, kod doğrulandı). `complete` → `job.generated_html`+`design_vars` + `inngest.send('website/generate.sandbox-done',{jobId})`.
- **B4 — result→`persistGeneratedSite`.** Mevcut `persist-result` (satır 171-213) `job.generatedHtml` → `gateSiteHtml` (SON OTORİTE) → `format:'html'` homePage → `persistGeneratedSite` → `markJobComplete`. **B3 yalnız `job.generatedHtml`/`designVars` doldurur; bu step DEĞİŞMEZ.**
- **B5 — egress proxy + key enjeksiyonu.** `ANTHROPIC_API_KEY` sandbox env'ine KONULMAZ; `ANTHROPIC_BASE_URL=<egress-proxy>` (key proxy'de). Daytona network izolasyonu + domain allowlist; secret-exfil testi (spec §12.4).
- **B6 — bayrak kademeli açılış.** `WEBSITE_AGENTIC='0'` → senkron byte-aynı (sıfır regresyon); `'1'`+sandbox env yok → dev-fallback (çalışıyor); `'1'`+sandbox configured → Yol B async. Önce owner allowlist, sonra kademeli.

---

## ASAMA C — POC ölçüm + karar (OUTLINE)
- **C1 — 20-site usage logu** (A4 şeması; `cache_read` 0 ise alarm; vision token izole; token'dan hesapla).
- **C2 — gerçek $/site** (medyan/p90 + resmi fiyat çarpanı; compute ihmal doğrula).
- **C3 — kalite kıyas** (aynı brief'leri promake.ai'de; PC+mobil yan yana; rubrik puan).
- **C4 — fiyat/kredi kilitleme** ($2.5-3.5 bandında mı; üstündeyse 40-kredi tarifesi gözden geçir; owner onayı).

---

## Doğrulanmış vs Tahmin (dürüstlük notu)
- **RESMÎ/CANLI DOĞRULANDI (2026-06-27):** npm paket adları+sürümleri (`@daytona/sdk`=`@daytonaio/sdk` 0.192.0; `@anthropic-ai/claude-agent-sdk` 0.3.195; repo `@anthropic-ai/sdk` 0.97.1 AYRI); Daytona API (`Image.base/runCommands/workdir/env`; `daytona.snapshot.create(params,{onLogs})` **Image'dan**; `create({image|snapshot, resources?, autoStopInterval, envVars},{onSnapshotCreateLogs?,timeout})`; snapshot-params `resources` ALMAZ; `executeCommand(cmd,cwd?,env?,timeout?)→{exitCode,result,artifacts.stdout}`; `process.createSession(id)`+`executeSessionCommand(id,req,timeout?)`; `fs.uploadFile(Buffer,remotePath,timeout?)`/`fs.downloadFile(remotePath,timeout?)→Buffer`; `sandbox.delete(timeout=60)`; `autoStopInterval` dk/0/default-15); Agent SDK `query()` Options (tüm alanlar + `effort` 5 değer + `maxBudgetUsd` + `taskBudget:{total}` Alpha) + `tool()`/`createSdkMcpServer()` + result `total_cost_usd`; `claude-opus-4-8` cache-min **1,024** + $5/$25 + 1h-TTL=`cache_control:{ttl:'1h'}` (raw API); Playwright image **v1.61.1-jammy**+npm 1.61.1 (canlı registry)+CDP; Faz 1 imzaları (kod okuması).
- **TAHMİN (POC'ta ölçülecek):** site-başı wall-clock + $/site (∴ compute payı); snapshot build süresi/boyutu; `CreateSnapshotParams` tam alan şekli (ilk run'da `.d.ts`'ten teyit); **Agent SDK'nın system-prompt cache'ine 1h-TTL uygulayıp uygulamadığı** (D6 — `cache_read>0` ile gözlenecek); vision token payı; 220KB ↔ promake-kalite uyumu; Read-tool görsel teslim güvenilirliği (emniyet ağı zorunlu).

---

### Kaynaklar (resmi)
- Daytona TS SDK: https://www.daytona.io/docs/en/typescript-sdk/ (daytona/image/process/file-system/sandbox) + Snapshots: https://www.daytona.io/docs/en/snapshots/
- Agent SDK TS: https://code.claude.com/docs/en/agent-sdk/typescript
- Prompt caching: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- Playwright Docker tags (canlı): https://mcr.microsoft.com/v2/playwright/tags/list
- Faz 1 kod: `inngest/functions/websiteAgenticGenerate.ts`, `lib/website/codegen/{generateHtmlSite.ts,renderGate.mjs,tailwindCompile.mjs}`, `lib/website/{genJobStore.ts,sandboxHmac.mjs,agenticFlag.mjs}`

Düzeltilmiş tam plan dosyası: `/private/tmp/claude-501/-Users-onursuay-Desktop-Onur-Suay-Web-Siteleri-YoAi-Project/3898d3e7-29f2-40a2-99cf-a21f459bcb44/scratchpad/faz2-poc-plan-CORRECTED.md`