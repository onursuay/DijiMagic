# Web Site Yöneticisi v2 — Agentic Üretim Mimarisi
### Owner Onay Teklifi · Tarih: 2026-06-27 · Salt-okuma tasarım (repoya hiçbir yazma yapılmadı)

---

## 1. Özet ve Hedef

**Tek cümle karar:** Mevcut tek-atış Claude motorunu (sabit JSON şeması → sabit şablon montajı, jenerik "WordPress-şablon" hissi), **harici kalıcı bir sandbox'ta koşan Claude Agent SDK agentic döngüsüyle** (yaz → build → ekran görüntüsü → öz-eleştiri → düzelt) değiştir; çıktıyı **mevcut `format='html'` saklama/sunum sözleşmesine tek gövde-içi HTML string olarak** teslim et.

**Hedef:** promake.ai kalitesinde, görsel olarak çarpıcı, anti-jenerik web siteleri. İki faz:
- **Faz 1** — promake kalitesinde **statik pazarlama sitesi** (şimdi inşa edilir).
- **Faz 2** — **işlevsel app** (rezervasyon + ödeme + auth + DB) (Faz 1 kanıtlandıktan sonra).

**Üç katman:** Vercel (API + UI) → Inngest (orkestratör) → Sandbox (işçi). Mevcut senkron yol bir **bayrak arkasında byte-aynı korunur** (sıfır regresyon).

**Doğruluk notu:** Bu dokümandaki fiyat/limit iddiaları resmi Anthropic kaynakları ve repo gerçeğiyle doğrulandı. **Tahmin olan tek alan = site başına token/maliyet** — bu açıkça "ölçülecek" olarak işaretlendi; marj iddiası ölçümden önce kesin kabul edilemez.

---

## 2. Neden Agentic (Mevcut Sorunun Kök Nedeni)

Mevcut motor **tek bir Claude çağrısıyla sabit bir içerik JSON şemasını doldurup sabit bir şablona montluyor.** Bu yapısal olarak jenerik üretir; çünkü:

1. **İterasyon yok.** Model çıktısını hiç görmüyor — kendi sonucunu değerlendirip düzeltemiyor. Promake'in kalitesi tam olarak şu döngüden gelir: yaz → gör → eleştir → düzelt.
2. **Görsel geri besleme yok.** Model HTML/CSS'in ekrana nasıl düştüğünü bilmiyor; hizalama, sıkışma, tipografik hiyerarşi, mobil taşma "kör" kalıyor.
3. **Opinionated tasarım sistemi yok.** Sabit şablon, modelin "varsayılan house-style"ına (Tailwind indigo/blue, düz gölge, tek font) düşmesine izin veriyor.

**Promake kalitesini sağlayan üç eksik bileşen** (teşhis):

| Bileşen | Mevcut | Hedef |
|---|---|---|
| **İterasyon** | tek-atış şema doldur | yaz→build→shot→öz-eleştiri→düzelt (≥2 tur, somut ölçümlü diff) |
| **Opinionated tasarım sistemi** | yok | dondurulmuş tasarım-token kütüphanesi + 3-5 sektör house-style + anti-jenerik kırmızı çizgiler; "önce 4 görsel yön öner" |
| **Marka + referans enjeksiyonu** | zayıf | `get_brand_context(scope)` doğru kapsamla; logo/renk birebir; referans URL varsa screenshot→"birebir eşle" |

---

## 3. Hedef Mimari (Uçtan Uca Akış)

```
[Kullanıcı: "AI ile Oluştur"]
   │
   ▼
[Vercel: POST /api/website/[id]/generate]   (<3sn, BLOKE ETMEZ)
   ├─ chargeFeature('website_generation')      ← kredi düş (mevcut)
   ├─ createWebsiteGenJob → status='queued'    ← YENİ tablo: website_gen_jobs
   ├─ updateWebsite(status='generating')
   └─ inngest.send('website/generate.agentic', {jobId, websiteId, userId, brief, locales})
        │  (dev fallback: sandbox yoksa inline senkron motor — çökmesin)
        ▼
[Inngest: websiteAgenticGenerate]   (orkestratör; CPU yakmadan DURAKLAR)
   ├─ step: mark-running
   ├─ step: dispatch-sandbox → POST {SANDBOX}/run (HMAC + imzalı brand asset URL'leri) → 202
   ├─ step: waitForEvent('website/generate.sandbox-done', timeout:'12m')  ← CPU yakmaz
   ├─ step: persist (IDEMPOTENT, jobId bazlı)
   │         → gateSiteHtml (SON OTORİTE) → replacePages(html, format='html')
   │         → theme.designVars → createVersion('initial'|'revision')
   └─ step: mark-done → updateWebsite(status='unpublished')
        │  (hata/timeout → refundFeature + status='draft'; BOZUK site ASLA persist edilmez)
        ▼
[Sandbox işçi: Claude Agent SDK query() döngüsü]   (dakikalar; kalıcı fs+shell+browser)
   │  ⏱ HARİCİ WALL-CLOCK WATCHDOG: SIGTERM @ 8dk (maxTurns/task_budget ZAMAN tavanı DEĞİL)
   1. PLAN: get_brand_context(scope) → 4 görsel yön öner → seç
   2. YAZ: Tailwind-class'lı HTML + içerik (Write/Edit)   ← Astro DEĞİL (bkz. §5)
   3. BUILD: Tailwind compile + sanitize (alt-bütçe guard'lı) → hata oku→düzelt
   4. PRE-GATE: renderGate.mjs SANDBOX-İÇİ kopya — geçmezse model düzeltsin
   5. SERVE+SHOT: localhost serve → Playwright PC + mobil (CDP cihaz emülasyonu) PNG → diske yaz → Read
   6. ÖZ-ELEŞTİRİ: Opus 4.8 @ xhigh vision → SOMUT diff ("başlık 32px, ~24px olmalı; mobilde hero taşıyor")
   7. DÜZELT → 4'e dön (≥2 tur; görünür fark kalmayınca dur)
   8. İNDİRGE: tek sanitize-uyumlu gövde HTML (head/script çıkar)
   9. ÖNCE Storage'a yaz (idempotent) → SONRA callback .../complete + inngest.send('sandbox-done')
        ▼
[Her turda: callback POST .../progress → website_gen_jobs.stage/progress/step_log]
        ▼
[UI: GET /api/website/[id]/job her 1.5sn → WizardBuildingAnimation GERÇEK ilerleme]
   "tasarım sistemi kuruluyor → sayfa inşa → ekran görüntüsü → AI tasarımını eleştiriyor (tur 2/3) → son rötuş"
        ▼
[Yedek bekçi: cron/website-jobs-reconcile → event kaybolsa Storage'dan toparlar]
        ▼
[Yayın / Sunum / Custom domain / Önizleme — HEPSİ DEĞİŞMEZ]
   publish → /s/[subdomain] → assembleDocument → sanitize + CSP + Tailwind compile
```

**Kritik altyapı gerçeği:** Agent SDK `query()` kalıcı `claude` CLI subprocess + shell + yazılabilir disk ister → **Vercel serverless'te ÇALIŞMAZ** (resmi: persistent VM/container, serverless değil). Playwright/Chromium da Vercel lambda'ya sığmaz. Bu iki gerçek "döngü harici sandbox'ta, Inngest yalnız tetikleyici+persist" kararını zorunlu kılar.

---

## 4. Önerilen Altyapı + Neden (Fiyatlarla)

| Katman | Seçim | Gerekçe + Fiyat |
|---|---|---|
| **Sandbox compute** | **E2B (Pro)** birincil; **Daytona** yedek | Anthropic resmi değerlendirme listesinde. Firecracker microVM = en güçlü multi-tenant izolasyon (müşteri sitesi build+screenshot için kritik). 24sa session, 100 eşzamanlı. **E2B Pro: $150/ay sabit + kullanım.** Daytona aynı sınıf ama sabit abonelik yok + kalıcı snapshot → sabit ücretten kaçınmak istenirse birincil olur. |
| **Hızlı POC alternatifi** | Anthropic Managed Agents | Altyapı yönetmeden Faz 1 prototipi günler içinde. **$0.08/session-saat.** Sınırlar: beta; env **5 eşzamanlı sert limit**; **ZDR/HIPAA YOK**. ⚠️ Güvenlik modeli E2B'den farklı (bkz. §9) — POC'ta çalışan secret-modeli üretimde yeniden inşa edilir. |
| **Orkestratör** | Inngest (mevcut) | `dispatch → waitForEvent → persist`; `concurrency:[{limit:5},{key:userId,limit:1}]`. CPU yakmadan dakikalarca duraklar; Vercel 300/800sn limitine asla yaklaşmaz. |
| **API + UI** | Vercel Next.js (mevcut) | Sadece job başlat/dön (<3sn) + polling. |
| **Model** | **`claude-opus-4-8` @ effort=`xhigh`** | Resmi: front-end/agentic için en güçlü; yüksek-çözünürlük vision (ekran görüntüsü öz-eleştirisi için kritik). **$5 / 1M girdi, $25 / 1M çıktı; 1M context, 128K çıktı.** Sonnet 4.6 ucuz ama tasarım instinct'i düşük → promake hedefiyle çelişir. Fable 5 = 2× maliyet, yalnız env-flag'li premium. |

**Doğrulanmış model nüansları (resmi):**
- `effort=xhigh` GA; Opus 4.7+'da mevcut, beta header gerekmez (Claude Code'da default).
- Yüksek-çöz vision Opus 4.7+'da otomatik (2576px'e kadar) — **görsel başına ~4784 token'a kadar** (bu maliyet kalemini ciddiye al, bkz. §8).
- Prompt-caching `cache_control:{type:'ephemeral'}` — **Opus 4.8 minimum cache prefix = 4096 token** (Sonnet/Fable 2048). Prefix 4096'nın altındaysa **cache SESSİZCE yazılmaz** (`cache_creation_input_tokens:0`, hata yok) → maliyet sessizce ~2.8× artar. Bu yüzden sabit prefix (sistem + tasarım sistemi + house-style) bilinçle ≥4096 token tutulmalı ve **`ttl:'1h'`** kullanılmalı (varsayılan 5dk TTL, 3-6dk süren build'de ilk turun cache'i expire olur).

---

## 5. Agent Harness (Çıktı Formatı, Döngü, Tasarım Sistemi Enjeksiyonu, Kalite Gate)

### 5.1 Çıktı Formatı — KARAR: Doğrudan Tailwind-class'lı HTML (Astro DEĞİL)

Sandbox'ta serbest çalış, **teslim artefaktı tek sanitize-uyumlu gövde-içi HTML string'e** indirgenir. **Astro statik export REDDEDİLDİ** — kritik düzeltme:

> **Neden Astro değil:** Astro component-scoped CSS (`astro-xxxx` class'ları) üretir; bunları tanımlayan `<style>` blokları sanitize tarafından **strip edilir** → CSS ölür (sadece JS değil, **stil de kaybolur**). Mevcut sunum katmanı zaten **Tailwind-compile** (`tailwindCompile.mjs`) + `style-src 'unsafe-inline'` + `designVars` kullanıyor. Bu yüzden agentic döngü **Tailwind utility class'lı HTML** üretmeli; sunum katmanı bunları derler. Astro gereksiz ve riskli bir indirgeme katmanı ekler.

**Neden tek string (React-runtime / WebContainer / çok-dosyalı bundle hepsi REDDEDİLDİ):**
- **CSP `script-src 'self'`** (doğrulandı: `serveCommon.ts:68-78`) → site içi inline/harici/3.parti JS bloke; çok-dosyalı JS bundle sunumda çalışmaz. CSP gevşetmek = güvenlik regresyonu.
- **Sanitize allowlist** (doğrulandı): gövdede `<style>/<link>/<meta>/<script>` yasak; ayrı CSS/JS dosyası sunumda atılır.
- **Mevcut sözleşme:** custom domain + publish + cache hepsi `/s/<sub>` + DB satırı varsayar; ayrı static-export deployment üç sistemi de yeniden yazmayı gerektirir.
- **Pazarlama sitesi JS gerektirmez:** etkileşim (reveal/sticky nav/mobil menü/akordeon/count-up) zaten mevcut sunucu runtime `dijimagic-site-runtime.js` (`data-dijimagic-*`) ile gelir → gerekirse runtime genişletilir, **AI-JS açılmaz**.

### 5.2 Döngü
1. **PLAN** — `get_brand_context(scope)` → 4 görsel yön öner → seç (Opus'un default house-style'ını kırar).
2. **YAZ** — Tailwind-class'lı HTML + içerik.
3. **BUILD** — Tailwind compile + sanitize; hata oku→düzelt (alt-bütçe guard'lı).
4. **PRE-GATE** — `renderGate.mjs`'in sandbox-içi kopyası her turda çalışır; geçmezse model düzeltir → Vercel'e ulaşan çıktı **zaten gate-geçer** (kritik, bkz. §11).
5. **SERVE + SHOT** — localhost serve → Playwright **CDP cihaz emülasyonu** ile PC + mobil PNG (⚠️ `--window-size` sahte-kırpma gösterir, kullanma) → diske yaz → `Read` (⚠️ Playwright screenshot media_type 400 tuzağı: PNG diske yaz, `Read` ile oku — base64 inline geçme).
6. **ÖZ-ELEŞTİRİ** — Opus 4.8 @ xhigh vision → somut ölçümlü diff.
7. **DÜZELT → 4'e dön** (≥2 tur, görünür fark kalmayınca dur).

### 5.3 Tasarım Sistemi Enjeksiyonu (promake kalitesini sağlayan çekirdek)
- **Dondurulmuş opinionated tasarım-token kütüphanesi** + 3-5 sektör "house-style" örneği (sabit prefix → cache'lenir, ≥4096 token hedefiyle uyumlu).
- **Anti-jenerik kırmızı çizgiler:** varsayılan Tailwind indigo/blue YASAK; display+sans font eşlemesi; katmanlı, düşük-opaklıklı tonlu gölge; yalnız `transform`/`opacity` animasyon; `transition-all` YASAK; tüm etkileşim durumları (hover/focus-visible/active).
- **Marka + referans:** `get_brand_context(scope)` SADECE o `siteConnectionId`/`userId` bağlamı (cross-business sızıntı korumalı — "ustasiniyolla→Belgemod" kök nedeni); `brand_assets/` logo/renk birebir; referans URL varsa Playwright screenshot → "birebir eşle, geliştirme yapma".

### 5.4 Kalite Gate (2 katman + offline regresyon)
- **Deterministik makine-gate** (her tur, ucuz): build exit 0; kırık iç/dış link yok + CTA↔hedef semantik eşleşme; placeholder kalıntısı yok (lorem/placehold.co/"Markanız"); marka uyumu + off-brand ürün yok; responsive (yatay-scroll yok, `minmax(0,1fr)`); i18n bütünlüğü. **Geçemezse → persist YOK + kredi iade + 422.**
- **VLM ekran-görüntüsü rubriği** (build-time, ≤3 tur): hizalama/simetri ≥4; **sıkışma/taşma = 5 (kırmızı çizgi)**; tipografik hiyerarşi ≥4; renk/marka ≥4 (amber/sarı YOK); derinlik/anti-jenerik ≥4; çalışırlık = 5. Yapısal JSON diff döner.
- **`gateSiteHtml` SON OTORİTE** — agentic öz-eleştirinin üstünde, Vercel-tarafı kesin kapı.
- **Offline regresyon:** mevcut `scripts/verify-website-codegen.mjs` desenini yeni kurallarla genişlet (jenerik / kırık-link / off-brand / XSS reddi fixture'ları).

---

## 6. Mevcut Sisteme Entegrasyon (Dosya Seviyesinde)

### DEĞİŞTİR / EKLE
| Dosya | Değişiklik |
|---|---|
| `lib/website/codegen/htmlGenerate.ts` | İç değişir: tek-çağrı Claude → `runAgenticBuild()`. **Dönüş tipi AYNI** (gövde-içi HTML string). |
| **YENİ** `lib/website/codegen/agentic/runAgenticBuild.ts` | Agent SDK orkestrasyonu (sandbox dispatch + sonuç indirgeme). |
| **YENİ** `inngest/functions/websiteAgenticGenerate.ts` + event `website/generate.agentic` | Async orkestratör; `app/api/inngest/route.ts` `functions[]`'a eklenir. |
| **YENİ** `lib/website/persistGeneratedSite.ts` | Mevcut `generateWithCodegenV2` persist+version bloğu buraya çıkarılır; senkron + agentic ortak çağırır (idempotent, jobId bazlı). |
| **YENİ** `lib/website/genJobStore.ts` + tablo `website_gen_jobs` | `createWebsiteGenJob/writeStatus/appendStepLog/getLatestJob/reconcileStaleJobs`. |
| **YENİ** `app/api/website/[id]/job/route.ts` (GET) + `jobs/[jobId]/{progress,complete}/route.ts` (HMAC) | UI polling + sandbox callback. |
| **YENİ** `app/api/cron/website-jobs-reconcile/route.ts` | Yedek bekçi (event kaybına karşı; Storage'dan toparlar). |
| `app/api/website/[id]/generate/route.ts` | Bayrak `WEBSITE_AGENTIC='1'` açıkken job-başlat-ve-dön; **kapalıyken mevcut senkron yol byte-aynı** (`WEBSITE_CODEGEN_V2` deseninin aynısı — doğrulandı: `generate/route.ts:25,68`). |
| `app/web-site-yoneticisi/[id]/page.tsx` + `WizardBuildingAnimation.tsx` | `handleAi` non-blocking + job polling; animasyon **gerçek** `{stage,progress,lastLog}` ile beslenir (sahte `setInterval` kaldırılır). |

### YENİDEN KULLAN (dokunulmaz — migration yok)
`store.ts` (`replacePages`/`createVersion`@193/`publishWebsite`), `website_pages.html`/`format`, `theme.designVars`/`compiledCssVersion`, `assembleDocument.mjs` + `sanitizeAllowlist.mjs` + `tailwindCompile.mjs` (sunum + sanitize + CSP), **`renderGate.mjs` `gateSiteHtml`** (son otorite), `publish/route.ts` (format-agnostik), custom domain (`middleware.ts` + `edgeConfig.ts` + `vercelDomain.ts` → `/s/`'e rewrite otomatik), `website-preview`, `chargeFeature`/`refundFeature`, `website_versions` rollback, çoklu-dil (`buildExtraLocalePages`/`translateHtml`/`applyBlockPatch`), Supabase Storage `website-assets` bucket.

**Düzeltme notu:** Görev metnindeki `website_credit_events` tablosu repoda **YOK** (grep boş, doğrulandı). Doğru desen = `website_versions` (sürüm) + `chargeFeature` (kredi).

---

## 7. Async İş Modeli (Inngest)

- **Akış:** `dispatch-sandbox → waitForEvent('sandbox-done', '12m') → idempotent persist`.
- **`waitForEvent` CPU yakmaz** — orkestratör dakikalarca duraklar, Vercel limitlerine yaklaşmaz.
- **Concurrency:** `[{limit:5},{key:userId,limit:1}]` — kullanıcı başına tek eşzamanlı iş; toplam 5.
- **Event-kaybı dayanıklılığı (kritik düzeltme):** Sandbox `inngest.send('sandbox-done')` atmadan ölürse (OOM/timeout/network), tek-nokta-arıza riski var. Önlem:
  1. **Sandbox sonucu ÖNCE Supabase Storage'a yazsın**, callback sadece "hazır" sinyali olsun.
  2. **Persist idempotent** (jobId üzerinden) — callback iki kez gelse de tek sonuç.
  3. **`cron/website-jobs-reconcile`** — callback kaybolsa bile Storage'dan toparlar; `reconcileStaleJobs` takılı job'ları kurtarır.
  - Böylece "BOZUK site ASLA persist edilmez + kredi kaçmaz" garantisi ancak persist **idempotent + gate-ardından** olduğu için tutar.

---

## 8. Maliyet / Gecikme Modeli + Kredi Yansıması

> **🔴 ÖNEMLİ DÜRÜSTLÜK NOTU:** Site başına token = **TAHMİN**, kesin değil. Aşağıdaki rakamlar tavan-koruma ile sınırlı ama gerçek maliyet ilk 20-50 sitede **ölçülmeden** kesin marj iddiası yapılamaz. Kırmızı-takım denetimi mevcut "$1.27/site" tahmininin **vision token'larını eksik saydığını** ve gerçeğin **2-3× yüksek** olabileceğini tespit etti.

**Vision token gerçeği (eksik sayılan kalem):** Opus 4.7+ yüksek-çöz vision **görsel başına ~4784 token'a kadar**. "5 tur × 2 viewport (PC+mobil) × çok-sayfa" hızla birikir. Kontrol önlemleri:
- Öz-eleştiri turunu **ana sayfa + 1 mobil shot** ile sınırla (her sayfa × her tur DEĞİL).
- Küçültülmüş + kritik bölge crop kullan.
- Tur sayısını ≤3 tut.

**Maliyet aralığı (tavan-korumalı):**
- Cache çalışırsa (≥4096 prefix + 1h TTL) optimistik ~$1.3, vision dahil gerçekçi **~$2.5–3.5/site**.
- Cache sessizce yazılmazsa (4096 altı prefix) maliyet ~2.8× → bu yüzden cache **doğrulanmalı**, varsayılmamalı.
- **`task_budget` 100K token (~$2.7 hard tavan)** her run'ı sınırlar; kaçak imkânsız.

**Gecikme:** ~3–6 dk/site (≤3 tur). HTTP route'a sığmaz → Inngest async + canlı progress zorunlu.

**Korumalar (zorunlu, hepsi):**
- **Wall-clock watchdog: SIGTERM @ 8dk** — ⚠️ `maxTurns`/`task_budget` **ZAMAN tavanı DEĞİL** (token sayar, wall-clock'u sınırlamaz; `astro/tailwind build` döngüye girerse token harcamadan dakikalar geçer). Inngest `waitForEvent` timeout 12m, işçi-tarafı hard kill 8dk.
- `maxTurns` 6 + `max_tokens` 16K + streaming.
- build-fix alt-döngü ayrı guard.
- Inngest `concurrency:5` + **org-geneli OTPM bütçesi** ayrılır (bkz. §11.4).

**Kredi yansıması:**
- Mevcut tarife (base ~40 kredi ≈ $2.76–$3.60 retail). Maliyet ölçülene kadar **fiyat değiştirme**.
- Kredi üretim BAŞLAMADAN charge edilir; run kaçarsa **otomatik refund**.
- ⚠️ **Marj kararı:** ölçülen gerçek maliyet **$2.5–3.5 bandının üstüne çıkarsa** mevcut 40-kredi tarifesi marjı eritir → tarife gözden geçirilir. **Marj iddiası ilk 20 site ölçümünden ÖNCE kesinleştirilemez.**

---

## 9. Güvenlik

**Mevcut 3 katman korunur (doğrulandı):** CSP `script-src/form-action/connect-src 'self'` (`serveCommon.ts:68-78`) + sanitize deny-by-default (no `<script>/<style>/<link>/<meta>`, tek `<h1>`, 220KB, inline handler yok, form action sunucu-enjekte) + `gateSiteHtml` son otorite.

**🔴 Yeni tehditler (sandbox getiriyor) + önlemler:**

1. **Serve-time AI-JS = 3-katman korumayı çökertir.** Faz 1'de keyfi AI-JS halka **SUNULMAZ**; aksi halde sanitize+gate+CSP anlamsızlaşır (DOM-XSS, formjacking, exfil ziyaretçi tarayıcısında). **Önlem: build-time agentic, serve-time statik kal.**

2. **Sandbox sır exfiltration (BİRİNCİL TEHDİT):** ele geçen ajan API key / Supabase service-role / Meta token okuyup dışarı POST eder. **Önlem (BİRLİKTE):**
   - Filesystem izolasyonu + **egress proxy** birlikte.
   - Key ajanın env'inde **DEĞİL** — `ANTHROPIC_BASE_URL=proxy` ile **dışarıdan enjekte**.
   - `--network none` + domain allowlist.
   - ⚠️ **Managed Agents vs E2B farkı:** Managed Agents secret'ı egress'te enjekte eder (sandbox sadece placeholder görür — bu modeli bedavaya verir); **E2B'ye geçince bu kaybolur → kendi egress proxy + key enjeksiyonu sıfırdan kurulur.** Bu yüzden öneri: secret-exfil tehdidini **POC'ta da test et** (ya da Faz 1 POC'u doğrudan E2B'de yap).

3. **Cross-tenant sızıntı** (A'nın markası B'nin sitesine — repoda bilinen sınıf). **Önlem:** per-session `cwd`, `settingSources:[]`, `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`, per-tenant `CLAUDE_CONFIG_DIR`, `getProfileForScope` quarantine.

4. **HMAC callback güvenliği:** sandbox→Vercel `progress`/`complete` route'ları HMAC imzalı; imzasız/eski timestamp reddedilir.

5. **Veri-sınırı kararı (Owner'a):** Managed Agents **ZDR/HIPAA YOK** — müşteri sitesi içeriği 3.taraf compute'a gidiyorsa Owner'ın açık onayı gerekir. E2B Firecracker microVM bu konuda daha güçlü izolasyon sunar.

---

## 10. Faz 1 vs Faz 2 (Net Kapsam)

| | **FAZ 1 — Promake kalitesinde pazarlama sitesi (ŞİMDİ)** | **FAZ 2 — İşlevsel app (sonra)** |
|---|---|---|
| **Hedef** | Görsel olarak çarpıcı, anti-jenerik statik site | Rezervasyon + ödeme + auth + DB |
| **Çıktı** | Tailwind-class'lı tek gövde HTML (sıfır AI-JS) | Tailwind-island / Next.js + Supabase (runtime gerekir) |
| **Etkileşim** | Mevcut sunucu runtime (`data-dijimagic-*`); gerekirse runtime genişletilir | Backend guard'lı API'ler, ana DijiMagic origin'inde |
| **Sunum** | `/s/[subdomain]` (mevcut, değişmez) | Ayrı deploy hedefi (yeni) |
| **Güvenlik** | **AI-JS YASAK** — sanitize+CSP+gate korunur | Hassas işlem (ödeme/auth) AI-JS'te DEĞİL; `/s/` ince istemci, `form-action 'self'` |
| **Net teslimat** | "AI ile Oluştur" → 3-6 dk içinde promake-kalitesinde yayına-hazır site; gerçek canlı progress; gate-garantili | Faz 1 kanıtlandıktan sonra spec'lenir |

**Faz 1 net teslimat tanımı:** Kullanıcı brief girer → agentic döngü (≥2 tur öz-eleştiri) → gate-geçer tek gövde HTML → `/s/[subdomain]`'de yayına hazır. **Promake'in görsel kalitesine ulaşır;** etkileşim zenginliğinde serve-time-statik kısıtı nedeniyle az geride kalır (bu bilinçli güvenlik tercihi — bkz. §11.6).

**Kritik kural:** Promake-kalitesi **build-time agentic döngüden** gelir (HTML/CSS işi), serve-time'da AI-JS gerektirmez. Faz 2'de bile keyfi AI-JS halka sunulmaz — etkileşim sunucuya-ait gözden geçirilmiş runtime modüllerinden gelir.

---

## 11. Riskler + Azaltmalar (Kırmızı-Takımdan)

| # | Risk | Azaltma |
|---|---|---|
| **1** | **`gateSiteHtml` agentic çıktıyı RUTİN reddedebilir** — Opus promake peşinde çoklu `<h1>`, 220KB aşımı, `<style>` blokları üretmeye meyilli → "site oluşturulamadı" (tam da son commit'lerde düzeltilen hata sınıfı). | **Sandbox-içi pre-gate:** `renderGate.mjs` kopyası her turda çalışır, geçmezse model düzeltir → Vercel'e ulaşan çıktı zaten gate-geçer. Gate kuralları prompt'a makine-okunur kısıt olarak baştan verilir. 220KB tavanının promake-kalite ile uyumu **POC'ta ölçülür**. |
| **2** | **Wall-clock kaçağı** — SDK'da top-level timeout yok; `maxTurns:6` tek turda 5dk iş yapabilir; build döngüye girerse token harcamadan dakikalar geçer. | **Harici watchdog: SIGTERM @ 8dk** + Inngest `waitForEvent` 12m + işçi-tarafı hard kill. `maxTurns`/`task_budget` yalnız token tavanı. |
| **3** | **Maliyet 2-3× düşük tahmin edilmiş** — vision token'ları sayılmamış; cache 4096-min sessiz-yazmama; 5dk TTL build içinde expire. | Maliyeti vision + 4096-min + `ttl:'1h'` ile **yeniden hesapla**; ilk 20 sitede `cache_read_input_tokens` ve gerçek `usage` **zorunlu logla, sıfırsa alarm**. Marj iddiası ölçümden önce kullanılmaz. |
| **4** | **Org-geneli OTPM darboğazı** — website agentic 5dk Opus@xhigh tutar; aynı anda DijiAlgoritma/SEO/Strateji de Opus çeker → reklam-AI motorları aç kalabilir. | Website agentic'e **ayrı rate-limit bütçesi / düşük kuyruk önceliği** (reklam akışları öncelikli, site üretimi kuyrukta bekler). |
| **5** | **Event-kaybı tek-nokta-arıza** — sandbox `sandbox-done` atmadan ölürse iş asılı kalır, kredi düşülmüş. | **Storage-önce + idempotent persist + reconcile cron** (§7). |
| **6** | **Ölçekte jenerikleşme** — statik 3-5 house-style; 50. site jenerik hissedebilir. Ayrıca serve-time-statik kısıtı promake'in "canlı" hissini tam yakalamaz. | **Kazanan tasarım kararlarını** (kullanıcı revize etmedi / yayınladı) `_learnings/` beynine geri besle → house-style kütüphanesi büyür. Runtime'a doğrulanmış etkileşim modülleri ekle (bakım yükü kabul edilir). |
| **7** | **Managed Agents → E2B geçişinde güvenlik modeli yeniden inşa** (secret-substitution kaybolur). | POC'u doğrudan E2B'de yap **veya** secret-exfil'i POC'ta da test et. ZDR/HIPAA için Owner veri-sınırı onayı. |
| **8** | **POC doğrulama boşlukları** — Playwright media_type 400 tuzağı; CDP-emülasyon (sahte kırpma); tek-h1/220KB tutturma. | PNG diske yaz→`Read`; `--window-size` yerine CDP cihaz emülasyonu; gate kuralları prompt'a baştan. |

---

## 12. Önerilen İlk Adım

**Faz 1 POC — doğrudan E2B'de (Managed Agents'ı atla, güvenlik modeli yeniden-inşa maliyetinden kaçın):**

1. **E2B Pro sandbox'ta** Agent SDK döngüsünü kur (yaz→Tailwind compile→pre-gate→Playwright CDP shot→Opus 4.8 xhigh öz-eleştiri→düzelt, ≤3 tur).
2. **Tek bir gerçek müşteri brief'iyle** 5-10 site üret; her run'da `usage` (özellikle `cache_read_input_tokens` ve vision token) **logla**.
3. **3 şeyi kanıtla/ölç:** (a) görsel kalite promake'e ulaşıyor mu (PC+mobil shot karşılaştırması); (b) çıktı `gateSiteHtml`'den **ilk seferde** geçiyor mu (pre-gate çalışıyor mu); (c) gerçek site-başı maliyet/süre.
4. **Güvenlik:** secret-exfil tehdidini POC'ta test et (`--network none` + egress allowlist + key enjeksiyonu).
5. Kanıtlanınca → Inngest async + `website_gen_jobs` + canlı progress + 2-katman gate + bayrak `WEBSITE_AGENTIC` ile **mevcut senkron yol byte-aynı korunarak** üretime al.

**Bayrak garantisi:** `WEBSITE_AGENTIC='0'` iken mevcut yol byte-aynı çalışır (doğrulandı: `WEBSITE_CODEGEN_V2` deseni) → sıfır regresyon, kademeli açılış, anında geri-dönüş.

---

**Karar özeti:** Mimari promake'in **görsel kalitesine ulaşabilir** (Opus 4.8 + xhigh + vision iterasyon yeterli ham güç). İki bilinçli kısıt: (a) serve-time-statik nedeniyle etkileşim zenginliğinde az geride; (b) statik house-style nedeniyle ölçek-jenerikleşme riski — ikisi de azaltılabilir (§11.6). Mimarinin en kırılgan noktaları **çıktı formatı (Astro değil Tailwind-class), wall-clock watchdog, idempotent persist ve gerçek maliyet ölçümü** olarak işaretlendi ve çözümlendi. Hiçbir adım mevcut yayın/sunum/güvenlik sözleşmesini bozmaz; tümü bayrak arkasında kademeli açılır.