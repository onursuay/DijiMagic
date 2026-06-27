# Faz 2 Stage B — Agentic Web Sitesi Üreticisini Üretime Alma (DÜZELTİLMİŞ)

## Goal
POC'ta kanıtlanmış agentic worker'ı (Daytona sandbox içinde Agent SDK döngüsü) repo-içi prod koduna taşıyıp `inngest/functions/websiteAgenticGenerate.ts`'deki boş `dispatch-sandbox` step'ini gerçek bir orkestratörle doldurmak. Mevcut async iskelet korunur; yalnız tek boşluk doldurulur + 3 gerçek altyapı eksiği (scope, sandbox-ref persist, orphan cleanup) kapatılır. Bayrak OFF iken sıfır regresyon.

## 🔧 SELF-AUDIT — Orijinal plandaki yanlış iddialar (repo ground-truth ile düzeltildi)

| # | Orijinal iddia | GERÇEK (repo doğrulaması) | Etki |
|---|---|---|---|
| A | Event payload'da `scope` var; `resolveScope(userId,websiteId)` çağrılır | Event data = `{jobId, websiteId, userId, brief, locales, isRevision, creditSpent}` — **`scope` YOK**, `resolveScope` **yok**, website codegen'de scope kavramı **hiç yok** (`grep` boş) | T4 yeni scope türetme adımı gerekir |
| B | `complete` route `{html,designVars,ts}` + fail için `{error}` "küçük genişletme" | Route body tipi **kesin** `{html, designVars, ts?}`; `error` alanı **yok**; markJobComplete'e gider | T3 fail yolu: ya route'u gerçekten genişlet ya da hiç-callback (timeout) seç — "var sayma" |
| C | "reconcile cron → orphan sandbox temizliği [MEVCUT]" | `reconcileStaleJobs` **yalnız** stale job'u `timeout`'a çevirir — **sandbox'a dokunmaz** | T5 orphan cleanup'ı sıfırdan yazılmalı |
| D | `persistSandboxRef` job'a sandboxId yazar (varmış gibi) | `WebsiteGenJob` interface'inde **sandboxId/sessionId/cmdId kolonu YOK** | T4 DB migration gerekir |
| E | `domainAllowList: ['api.anthropic.com', host]` (array) | Tip **`domainAllowList?: string`** — virgülle ayrılmış STRING | T2/T5: `'a,b'` formatı |
| F | `deleteSandbox(sandboxId)` → `sandbox.delete(60)` | `daytona.delete(sandbox: Sandbox, timeout?)` Sandbox **objesi** ister; instance'ta `sandbox.delete(timeout?)` | T2: `get(id)` sonra `.delete()` |
| G | Watchdog satır 170 `18*60` ama yorum "8 minute" | **Doğru** (gerçek bug) — `worker.mjs:170` `18 * 60 * 1_000`, `:172` log "8 minute" | T5 düzeltme geçerli |

**DOĞRULANAN (değişmez) iddialar:** `executeSessionCommand(sessionId, {command, runAsync?:true}, timeout?)` pozisyonel ✅ (`Process.d.ts:224` + `session-execute-request.d.ts:15 runAsync?:boolean`); response `cmdId: string` ✅ (`session-execute-response.d.ts:13`); `daytona.secret.create({name,value,hosts?:string[]})` ✅ (`Secret.d.ts:34-38`); `secrets:Record<string,string>` placeholder-substitution allowed-hosts'ta ✅ (`Daytona.d.ts:121,139`); `ephemeral:true → autoDeleteInterval:0` ✅ (`:119`); `autoStopInterval:0 = disabled` ✅ (`:112`); HMAC `signSandboxBody/verifySandboxSignature/isTimestampFresh(ts,now,300)` + header `x-sandbox-signature-256: sha256=<hex>`, `ts` saniye ✅; `complete` route idempotent (`status!=='completed'`) + `existing.websiteId!==id` 404 + `isTimestampFresh` ✅; `progress` body `{stage,progress,stepMsg,ts?}` ✅; dev-fallback (satır 92-139) + `gateSiteHtml` son-otorite (satır 116 & 184) ✅; **iki katmanlı bayrak:** route `isAgenticEnabled()` (`agenticFlag.mjs` = `WEBSITE_AGENTIC==='1'`) event gönderir; function `isSandboxConfigured()` (satır 53-54 = `WEBSITE_SANDBOX_URL && WEBSITE_SANDBOX_HMAC_SECRET`) yol seçer ✅; `renderGate.mjs` + `sanitizeAllowlist.mjs` poc↔lib **byte-identical** (DRY) ✅; `lib/website/codegen/agentic/**` git-ignore EDİLMİYOR ✅.

## Architecture (düzeltilmiş)
```
POST /api/website/[id]/generate
  → isAgenticEnabled() (WEBSITE_AGENTIC==='1')   [route katmanı — MEVCUT]
  → chargeFeature → createWebsiteGenJob(queued)
  → inngest.send('website/generate.agentic', {jobId,websiteId,userId,brief,locales,isRevision,creditSpent})
  → HEMEN dön → UI polling                        [MEVCUT, payload AYNEN korunur]
        │
        ▼
Inngest websiteAgenticGenerate
  ├─ step 'mark-running'                                          [MEVCUT]
  ├─ isSandboxConfigured()==false → dev-fallback inline           [MEVCUT, dokunulmaz]
  └─ true → step 'dispatch-sandbox':                              [← T4 DOLDURUR]
       a. scope = deriveScope(userId, websiteId)  ← T4 YENİ (event'te scope yok)
       b. brandContextJson = getProfileForScope(scope)  [businessProfileStore.ts:187 MEVCUT]
       c. runAgenticBuild({...}) → Daytona create(ephemeral, autoStopInterval:0,
            secrets:{ANTHROPIC_API_KEY:'anthropic-prod'},
            domainAllowList:'api.anthropic.com,<callbackHost>'  ← STRING (F→E düzeltme))
          → installDeps + uploadFiles → createSession → executeSessionCommand(runAsync:true)
          → {sandboxId, sessionId, cmdId}
       d. persistSandboxRef(jobId, sandboxId,...)  ← T4: DB migration (D düzeltme)
       e. HIZLI DÖN (worker'ı BEKLEMEZ)
       │
  ├─ step.waitForEvent('await-sandbox', 'website/generate.sandbox-done', 12m)  [MEVCUT]
  │     [sandbox içinde worker ~9dk; her aşama POST /progress (HMAC); bitince POST /complete (HMAC)]
  ├─ complete route: HMAC+ts → markJobComplete → send('sandbox-done')          [MEVCUT]
  ├─ persist-result (gateSiteHtml SON OTORİTE, satır 184)                       [MEVCUT]
  ├─ mark-complete-sandbox                                                      [MEVCUT]
  └─ cleanup-sandbox: deleteSandbox(job.sandboxId)                              [← T4 EKLER]
        │
  timeout yolu: waitForEvent null → handle-timeout (markJobFailed+iade) + deleteSandbox  [← T4 EKLER]
  orphan cron: T5 YENİ tarama (reconcile MEVCUT sandbox bilmiyor — C düzeltme)
```

## Global Constraints (her task'ta — ihlal = task fail)
1. **Çıktı = HTML body** (head'siz inner). `persistGeneratedSite` `format:'html', sections:[]` (satır 196-209 AYNEN).
2. **Serve-time AI-JS YASAK** — `<script>/<style>/<link>/<meta>/on*=` gate keser.
3. **`gateSiteHtml` SON OTORİTE** — `persist-result` step satır 184 çağrısı **silinmez/zayıflatılmaz**. Worker-içi `render_gate` MCP yalnız self-correction (güvenlik sınırı DEĞİL).
4. **Kanonik env (değişmez):** `WEBSITE_AGENTIC` (route bayrağı), `WEBSITE_SANDBOX_HMAC_SECRET`, `DAYTONA_API_KEY`, `ANTHROPIC_API_KEY`. Worker'a envVars: `WEBSITE_CALLBACK_BASE`, `WEBSITE_SITE_ID`, `JOB_ID`, `SCOPE`, `BRIEF`, `BRAND_CONTEXT_JSON`, `WEBSITE_SANDBOX_HMAC_SECRET`.
5. **maxBudgetUsd cap korunur** (worker `maxBudgetUsd:6`, `maxTurns:40`, watchdog).
6. **Async dispatch + HMAC callback** — orkestratör beklemez (runAsync detached), worker callback ile döner, `waitForEvent` uyandırır.
7. **Sıfır regresyon:** `WEBSITE_AGENTIC` kapalı → route eski v2/legacy yol (byte-aynı); açık ama Daytona env eksik → function `isSandboxConfigured()` false → dev-fallback. Her task `tsc` temiz + dev-fallback bozulmadı doğrulamasıyla biter.

---

## TASKLAR

### T1 — POC dosyalarını repo-içi prod koduna taşı
**Neden:** `poc/` `.gitignore:68` ile repo-dışı. Worker/prompts prod kod olmalı (commit + tsc + Vercel build).

**Adımlar:**
1. Dizinler: `lib/website/codegen/agentic/sandbox/` + `lib/website/codegen/agentic/prompts/`.
2. Taşı (`cp` + `git add` — kaynak gitignore'da):

   | Kaynak | Hedef |
   |---|---|
   | `poc/sandbox/worker.mjs` | `lib/website/codegen/agentic/sandbox/worker.mjs` |
   | `poc/sandbox/compile.mjs` | `…/agentic/sandbox/compile.mjs` |
   | `poc/sandbox/shot.mjs` | `…/agentic/sandbox/shot.mjs` |
   | `poc/sandbox/tailwindCompile.mjs` | `…/agentic/sandbox/tailwindCompile.mjs` |
   | `poc/prompts/buildPrompt.mjs` | `…/agentic/prompts/buildPrompt.mjs` |
   | `poc/prompts/designSystem.mjs` | `…/agentic/prompts/designSystem.mjs` |

3. **🔧 DRY (doğrulandı):** `poc/sandbox/renderGate.mjs` ↔ `lib/website/codegen/renderGate.mjs` ve `sanitizeAllowlist.mjs` **byte-identical**. → Sandbox kopyası YARATMA; worker upload kaynağı kanonik `lib/website/codegen/renderGate.mjs` + `lib/website/codegen/sanitizeAllowlist.mjs` olur. (worker.mjs'in `import './renderGate.mjs'` satırı korunur; upload bu iki dosyayı `/tmp/work/{jobId}/`'a yerleştirir.)
4. **Hidden-file:** Bu dosyalar **prod kaynak kod** → `chflags hidden` UYGULANMAZ.

**Doğrulama:** `git check-ignore lib/website/codegen/agentic/sandbox/worker.mjs` → **boş** (zaten doğrulandı, exit=1). `node --check` her `.mjs` → temiz. `npx tsc --noEmit` temiz.

---

### T2 — `lib/website/codegen/agentic/runAgenticBuild.ts` (Daytona spawn + upload + detached)
**Neden:** `dispatch-sandbox`'ın çağıracağı prod orkestratör; POC `runPoc.mjs` deseni ama detached + callback enjeksiyonlu.

**TDD:**
1. Tipler — `agentic/types.ts`: `RunAgenticBuildInput {jobId, websiteId, userId, brief, scope, brandContextJson, callbackBase, hmacSecret}` + `RunAgenticBuildResult {sandboxId, sessionId, cmdId}`.
2. Test (`vi.mock('@daytona/sdk')`):
   - **A:** `create` `autoStopInterval:0` + `ephemeral:true` + 2. arg `{timeout:0}`.
   - **B:** envVars'da gerçek `ANTHROPIC_API_KEY` YOK; `secrets:{ANTHROPIC_API_KEY:'anthropic-prod'}`; envVars'da `WEBSITE_CALLBACK_BASE/WEBSITE_SITE_ID/JOB_ID/SCOPE/BRIEF/BRAND_CONTEXT_JSON/WEBSITE_SANDBOX_HMAC_SECRET`.
   - **🔧 C (E düzeltme):** `domainAllowList` **STRING** `'api.anthropic.com,<host>'` (array DEĞİL).
   - **D:** `executeSessionCommand(sessionId, {command, runAsync:true})` pozisyonel; `cmdId` sonuca yansır.
   - **E:** worker beklenmez (deps için executeCommand; worker için yalnız executeSessionCommand+runAsync).
   - **F:** `create` reddederse fırlatır (T4 try/catch yakalar).
3. Implementasyon (doğrulanmış imzalar):
   ```ts
   import { Daytona } from '@daytona/sdk'
   export async function runAgenticBuild(i: RunAgenticBuildInput): Promise<RunAgenticBuildResult> {
     const daytona = new Daytona()
     const callbackHost = new URL(i.callbackBase).host
     const sandbox = await daytona.create({
       autoStopInterval: 0, ephemeral: true,
       secrets: { ANTHROPIC_API_KEY: 'anthropic-prod' },
       domainAllowList: `api.anthropic.com,${callbackHost}`,   // 🔧 STRING
       envVars: { JOB_ID:i.jobId, SCOPE:i.scope, BRIEF:i.brief,
         BRAND_CONTEXT_JSON:i.brandContextJson, WEBSITE_CALLBACK_BASE:i.callbackBase,
         WEBSITE_SITE_ID:i.websiteId, WEBSITE_SANDBOX_HMAC_SECRET:i.hmacSecret },
     }, { timeout: 0 })
     await installDepsAndUpload(sandbox, i.jobId)
     const sessionId = `gen-${i.jobId}`
     await sandbox.process.createSession(sessionId)
     const cmd = await sandbox.process.executeSessionCommand(sessionId, {
       command: `NODE_PATH=/tmp/work/node_modules node /tmp/work/${i.jobId}/worker.mjs > /tmp/work/${i.jobId}/worker.log 2>&1`,
       runAsync: true,
     })
     return { sandboxId: sandbox.id, sessionId, cmdId: cmd.cmdId }
   }
   ```
   - `installDepsAndUpload`: `executeCommand('npm i --prefix /tmp/work @anthropic-ai/claude-agent-sdk zod playwright tailwindcss postcss autoprefixer sanitize-html cheerio', '/', undefined, 300)` + `fs.uploadFile(Buffer, '/tmp/work/${jobId}/<name>')` — upload listesi: worker.mjs, compile.mjs, shot.mjs, tailwindCompile.mjs, prompts/buildPrompt.mjs→`buildPrompt.mjs`, prompts/designSystem.mjs→`designSystem.mjs`, **kanonik** `lib/website/codegen/renderGate.mjs`→`renderGate.mjs`, `sanitizeAllowlist.mjs`, `lib/website/sandboxHmac.mjs`→`sandboxHmac.mjs` (worker T3'te import eder). **Playwright Chromium kurulumu** worker öncesi gerekli — POC'ta libnss3/gbm hazır; `npx playwright install chromium` deps adımına ekle (POC ground-truth ile doğrula).
   - `sandbox.delete` BURADA YOK (detached worker çalışıyor).
4. **🔧 Cleanup helper (F düzeltme):**
   ```ts
   export async function deleteSandbox(sandboxId: string): Promise<void> {
     const daytona = new Daytona()
     const sandbox = await daytona.get(sandboxId)   // Sandbox objesi al
     await sandbox.delete(60)                         // instance method (Sandbox.d.ts:276)
   }
   ```

**Doğrulama:** `npx vitest run …runAgenticBuild.test.ts` yeşil; `npx tsc --noEmit` temiz; (tercih) gerçek tek-sandbox smoke — `cmdId` döner + sandbox açık kalır (auto-stop yok) + elle `deleteSandbox`.

---

### T3 — Worker'ı prod-uyumlu yap (HMAC callback /complete + /progress)
**Neden:** POC worker yalnız `result.json` yazıyordu (orkestratör indiriyordu). Detached üretimde worker **kendisi** callback atmalı.

**🔧 FAIL YOLU KARARI (B düzeltme — net):** `complete` route body tipi **kesin** `{html, designVars, ts?}`; `error` alanı **yok**. İki seçenek:
- **(Seçilen, minimal) HİÇ-CALLBACK:** Agent hata/watchdog → worker **callback atmaz** → `waitForEvent` 12dk timeout → `handle-timeout` markJobFailed+iade. Route'a **dokunulmaz** (değişmez sözleşme korunur). Dezavantaj: 12dk bekleme.
- **(Opsiyonel hızlı-fail) ROUTE GENİŞLETME:** `complete` route body'sine `error?:string` ekle; varsa `markJobFailed(jobId, 'sandbox_error:'+error)` + iade + `send('sandbox-done')`. Bu **gerçek route değişikliğidir** (T3.2 ayrı diff + test), "zaten destekliyor" varsayımı YASAK. Stage B'de **Seçilen=hiç-callback** ile başla; hızlı-fail Aşama 2 iyileştirmesi.

**Worker callback bloğu** (`worker.mjs` sonu, `result.json` yazımından sonra):
```js
import { signSandboxBody } from './sandboxHmac.mjs'
async function postJSON(path, payload) {
  const url = `${process.env.WEBSITE_CALLBACK_BASE}/api/website/${process.env.WEBSITE_SITE_ID}/jobs/${process.env.JOB_ID}/${path}`
  const body = JSON.stringify({ ...payload, ts: Math.floor(Date.now()/1000) })  // ts SANİYE
  const sig = signSandboxBody(body, process.env.WEBSITE_SANDBOX_HMAC_SECRET)     // "sha256=<hex>"
  await fetch(url, { method:'POST',
    headers:{ 'content-type':'application/json', 'x-sandbox-signature-256': sig }, body })
}
// her aşama:
await postJSON('progress', { stage:'building_page', progress:40, stepMsg:'…' })
// başarı (agentError yok):
if (!agentError) await postJSON('complete', { html: resultJson.html, designVars: resultJson.designVars ?? {} })
// hata: callback ATMA (Seçilen karar) → orkestratör 12dk timeout + iade
```
**Egress notu:** callback worker'dan atılır (mevcut iskelet buna kurulu; orkestratör detached, worker bitişini bilmez). Bu yüzden `domainAllowList` Anthropic **+ callback host** içerir (T2/T5). `signSandboxBody`→`verifySandboxSignature` aynı secret round-trip (test edilir).

**`WEBSITE_CALLBACK_BASE` = sabit prod domain** (preview URL kısa-ömürlü → callback ölür) — `https://dijimagic.com`.

**Doğrulama:** vitest callback round-trip yeşil; `node --check worker.mjs`; gerçek smoke — `/complete`'e POST gelir, HMAC 200 (401 değil), `ts` taze.

---

### T4 — `dispatch-sandbox` step'i doldur + scope türet + sandbox-ref persist + cleanup
**Neden:** İskeletin tek boşluğu (satır 144-149) + 2 gerçek eksik (scope, sandbox-ref).

**🔧 isSandboxConfigured() kararı:**
```ts
function isSandboxConfigured(): boolean {
  return Boolean(process.env.DAYTONA_API_KEY)
    && Boolean(process.env.WEBSITE_SANDBOX_HMAC_SECRET)
    && Boolean(process.env.WEBSITE_CALLBACK_BASE)
}
```
- `WEBSITE_SANDBOX_URL` koşulu **kaldırılır** (Daytona SDK env'den okur). `WEBSITE_AGENTIC` bayrağı **route katmanında** zaten kontrol ediliyor (`isAgenticEnabled`, `agenticFlag.mjs`) — function'da tekrar etme; function yalnız "Daytona hazır mı" sorusuna bakar. (İki katman doğrulandı: route gönderir, function yol seçer.)

**🔧 SCOPE türetme (A düzeltme — event'te scope YOK):** Website codegen'de scope kavramı yok. Brand context için scope, kullanıcı+site'tan türetilir. `getProfileForScope` (`businessProfileStore.ts:187`) imzasını **OKU**, hangi scope formatını beklediğini doğrula (muhtemelen `userId` veya `userId:websiteId`). Eğer per-account scope flag (`DIJIMAGIC_PER_ACCOUNT_SCOPE`) açıksa o formatı kullan; değilse `userId`. **Uydurma scope üretme** — `getProfileForScope`'un gerçek beklediği değeri ver. SEO tarafındaki cross-business sızıntı dersi (`getProfileForScope` ile çözülmüş "Antso/Belgemod") burada da geçerli: yanlış scope = yanlış firma içeriği.

**`dispatch-sandbox` gövdesi (satır 144-149 yerine, try/catch'li):**
```ts
const dispatch = await step.run('dispatch-sandbox', async () => {
  try {
    await appendJobLog(jobId, 'building_page', 15, 'Sandbox işçisi başlatılıyor')
    const scope = deriveWebsiteScope(userId, websiteId)          // T4 YENİ helper
    const profile = await getProfileForScope(scope)               // MEVCUT
    const r = await runAgenticBuild({
      jobId, websiteId, userId, brief, scope,
      brandContextJson: JSON.stringify(profile ?? {}),
      callbackBase: process.env.WEBSITE_CALLBACK_BASE!,
      hmacSecret: process.env.WEBSITE_SANDBOX_HMAC_SECRET!,
    })
    await persistSandboxRef(jobId, r.sandboxId, r.sessionId, r.cmdId)
    return { ok: true as const, ...r }
  } catch (e) {
    await markJobFailed(jobId, 'dispatch_failed')
    if (creditSpent > 0) await refundCreditsServer(userId, creditSpent, 'website_generation_refund')
    return { ok: false as const }
  }
})
if (!dispatch.ok) { logger.warn(`[website-agentic] dispatch fail: ${jobId}`); return { ok:false, jobId, reason:'dispatch_failed' } }
```
(waitForEvent/persist-result/handle-timeout AYNEN kalır — satır 151-213.)

**🔧 persistSandboxRef + DB migration (D düzeltme — kolonlar YOK):**
- `genJobStore.ts`: `WebsiteGenJob` interface'ine `sandboxId/sessionId/cmdId` (nullable) ekle; mapRow'a ekle; `persistSandboxRef(jobId, sandboxId, sessionId, cmdId)` UPDATE fonksiyonu.
- DB migration: `website_gen_jobs` tablosuna `sandbox_id text, session_id text, cmd_id text` (nullable). Migration dosyası repo'nun mevcut migration desenine uygun.

**cleanup-sandbox step (mark-complete-sandbox'tan sonra):**
```ts
await step.run('cleanup-sandbox', async () => {
  const job = await getWebsiteGenJob(jobId)
  if (job?.sandboxId) await deleteSandbox(job.sandboxId)
  return { ok: true }
})
```
**handle-timeout'a silme ekle** (satır 159-167 içine): `const job = await getWebsiteGenJob(jobId); if (job?.sandboxId) await deleteSandbox(job.sandboxId)`.

**Doğrulama:** `npx tsc --noEmit` temiz; Inngest dev (`npx inngest-cli dev` + test event) step zinciri yeşil; **bayrak OFF regresyon:** `WEBSITE_AGENTIC` unset → route agentic event GÖNDERMEZ → eski yol; ayrıca Daytona env eksik + agentic açık → `isSandboxConfigured()` false → dev-fallback (mevcut testler yeşil).

---

### T5 — Güvenlik + orphan cleanup + watchdog fix
**Neden:** API key gömülmemeli; egress kilidi; cross-tenant izolasyon; orphan sandbox sızıntısı.

1. **Daytona Secret setup script** `scripts/website/setup-daytona-secret.mjs` (idempotent, tek-seferlik, `chflags hidden`):
   ```js
   import { Daytona } from '@daytona/sdk'
   const d = new Daytona()
   await d.secret.create({ name:'anthropic-prod', value:process.env.ANTHROPIC_API_KEY,
     hosts:['api.anthropic.com'] })   // hosts:string[] (Secret.d.ts:38)
   ```
2. **`create` egress:** `secrets:{ANTHROPIC_API_KEY:'anthropic-prod'}` + `domainAllowList:'api.anthropic.com,<callbackHost>'` (🔧 STRING). `--network none` YOK (agent Anthropic'e + Playwright Chromium'a ihtiyaç duyar). **Doğrulanmamış (ilk smoke'ta test):** Secret substitution Agent SDK `x-api-key` TLS header'ında çalışıyor mu — küçük Anthropic çağrısıyla doğrula. Çalışmazsa fallback: key'i envVars ile ver, `domainAllowList` yine iki host'a kıs.
3. **Cross-tenant guard'ları KORU (hepsi worker.mjs'de MEVCUT — doğrulandı):** `settingSources:[]` (satır 215), `CLAUDE_CODE_DISABLE_AUTO_MEMORY:'1'` (satır 225), `CLAUDE_CONFIG_DIR=/tmp/cfg-${JOB_ID}` (satır 226), `cwd=WORK_DIR` (satır 216), `loadScopedBrand` scope-mismatch→`{}` (satır 96-101). Brand context **orkestratörden** `BRAND_CONTEXT_JSON` ile gelir; sandbox DB'ye bağlanmaz (allowlist'te yok) → cross-business sızıntı yapısal kesik.
4. **🔧 Watchdog fix (G — doğrulanmış bug):** `worker.mjs:170` `18 * 60 * 1_000` → **`10 * 60 * 1_000`** (10dk); `:172` log "8 minute" → "10 minute". Kademeli timeout: worker 10dk < waitForEvent 12dk → orkestratör timeout edince worker zaten ölmüş, token yakmaz.
5. **🔧 Orphan cleanup (C — MEVCUT DEĞİL, sıfırdan):** `reconcileStaleJobs` yalnız job'u `timeout` yapar, sandbox bilmez. **YENİ:** reconcile cron'a (veya yeni küçük cron) ek adım — `timeout`/`failed` olup `sandbox_id` dolu job'ları bul → her biri için `deleteSandbox(sandboxId)` (try/catch; zaten silinmişse yut) → `sandbox_id` null'la (tekrar silmeyi önle). Bu, dispatch sonrası callback hiç gelmeyen + reconcile'in timeout'a çektiği orphan'ları temizler.
6. **HMAC + gate + idempotent guard'lar (MEVCUT, dokunma):** `verifySandboxSignature`/`isTimestampFresh` + `existing.websiteId!==id` + `status!=='completed'` + `gateSiteHtml` son-otorite — değişmez.

**Doğrulama:** `node setup-daytona-secret.mjs` → `secret.list` ile var (değer görünmez); ilk smoke — sandbox-içi Anthropic çağrısı başarılı (substitution çalışıyor) + allowlist-dışı host `fetch` bloklu; `grep "watchdogMs" worker.mjs` → `10 * 60`; guard grep'leri yerinde; orphan cron testi — sahte orphan job → cron sonrası sandbox silindi + `sandbox_id` null.

---

### T6 — Env + kademeli bayrak (Vercel)
**Vercel Production:**
- `DAYTONA_API_KEY` (doğrula `vercel env ls`), `WEBSITE_SANDBOX_HMAC_SECRET` (`openssl rand -hex 32`), `WEBSITE_CALLBACK_BASE=https://dijimagic.com` (sabit, preview DEĞİL), `ANTHROPIC_API_KEY` (Daytona Secret + orkestratör), `WEBSITE_AGENTIC` **başta unset/`0`**.
- **🔧 `WEBSITE_SANDBOX_URL` temizliği:** `grep -rn WEBSITE_SANDBOX_URL` → `isSandboxConfigured` (T4'te kaldırıldı) + yorumlar. Yorumları Daytona/secret modeline güncelle; `.env.local`'den satırı sil.

**Doğrulama:** `vercel env ls` 4 env mevcut, `WEBSITE_AGENTIC` yok/`0`; `grep -rn WEBSITE_SANDBOX_URL` → kalan referans yok.

---

## ROLLOUT
**Aşama 0 — Bayrak OFF:** `WEBSITE_AGENTIC` unset → route agentic event göndermez → eski v2/legacy (byte-aynı). Mevcut e2e + 1 gerçek üretimle dev-fallback teyit.

**Aşama 1 — Owner-only:** `generate/route.ts`'te `isAgenticEnabled()` yanına owner-gate: `&& getIsCurrentUserSuperAdmin(user.id)` (SUPER_ADMIN_EMAILS, onursuay@hotmail.com). Owner 5-10 site üretir; her birinde: gate PASS, callback HMAC 200, sandbox silindi (orphan=0), ~$2.50/site (Daytona+Anthropic faturası), UI polling doğru, cross-business sızıntı YOK (doğru firma brand context).

**Aşama 2 — Kademeli:** owner temizse `WEBSITE_AGENTIC=1` + route gate'i owner→allowlist→%10→%50→%100. Her kademede 20-site metriği: başarı≥%95, p50/p95 süre, $/site≤cap, orphan=0, timeout oranı, iade oranı, sızıntı=0. Aşılırsa `WEBSITE_AGENTIC=0` → anında dev-fallback (deploy gerekmez).

**Geri çekilme:** `WEBSITE_AGENTIC=0` → tüm trafik eski yol. `runAgenticBuild`/worker yerinde kalır; yarım job'lar reconcile (+T5 orphan cleanup) ile timeout+iade+sandbox-sil.

---

## İlgili dosyalar (mutlak yol)
- `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/inngest/functions/websiteAgenticGenerate.ts` — T4: dispatch-sandbox + isSandboxConfigured (WEBSITE_SANDBOX_URL kaldır) + scope türet + cleanup/timeout sandbox-sil
- `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/lib/website/codegen/agentic/runAgenticBuild.ts` — T2 YENİ (domainAllowList STRING, deleteSandbox=get+delete)
- `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/lib/website/codegen/agentic/types.ts` — T2 YENİ
- `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/lib/website/codegen/agentic/sandbox/worker.mjs` — T1 taşı, T3 callback, T5 watchdog 18→10dk
- `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/lib/website/codegen/agentic/prompts/{buildPrompt,designSystem}.mjs` — T1 taşı
- `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/lib/website/codegen/renderGate.mjs` + `sanitizeAllowlist.mjs` — KANONİK (byte-identical) worker upload kaynağı, değişmez
- `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/lib/website/sandboxHmac.mjs` — worker upload kaynağı (signSandboxBody), değişmez
- `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/lib/website/genJobStore.ts` — T4: sandboxId/sessionId/cmdId kolon + persistSandboxRef + reconcile/orphan ek
- DB migration — T4: `website_gen_jobs` + `sandbox_id/session_id/cmd_id` (nullable)
- `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/app/api/website/[id]/jobs/[jobId]/complete/route.ts` — T3 OPSİYONEL hızlı-fail için `error?` genişletme (Aşama 2; Stage B'de DOKUNMA)
- `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/app/api/website/[id]/jobs/[jobId]/progress/route.ts` — callback alıcı (değişmez)
- `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/app/api/website/[id]/generate/route.ts` — Rollout: `isAgenticEnabled()` yanına owner-gate
- `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/lib/website/agenticFlag.mjs` — route bayrağı (değişmez)
- `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/lib/dijimagic/businessProfileStore.ts` — `getProfileForScope` (satır 187); T4 scope formatı bunun beklediğiyle eşleşmeli
- `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/scripts/website/setup-daytona-secret.mjs` — T5 YENİ (secret hosts:string[]), chflags hidden
- `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/.gitignore` — `poc/` (satır 68, kalır); `lib/website/codegen/agentic/**` ignore EDİLMİYOR (doğrulandı)
