# DijiAlgoritma — Per-Ad Improvement Cards Refactor (Faz 1 Audit + Plan)

> **Durum:** Faz 1 = sadece audit + plan (kod yok). Onur onayı sonrası Faz 2 implementation.
> **Tarih:** 2026-05-20
> **Onaylanan kararlar:** (1) AI granülerliği = reklam-başına-istek (Batch API). (2) Google kreatif fetch Faz 2'ye dahil. (3) Off-brand fix ŞİMDİ commit+push edildi (`main` 45da658). (4) Brand Intelligence Ingestion Faz 2'ye dahil (Apify IG/FB + Claude sentez).

---

## Özet vizyon
- Her **aktif** reklam için **tek** improvement card. 1:1 mapping (5 aktif reklam = 5 kart, Meta + Google ayrı).
- Kart içeriği: o reklama özel iyileştirilmiş versiyon (`ad_spec`) + AI gerekçesi + rakip karşılaştırma + platform/compliance.
- Onayla → reklamı canlıya al · Reddet → kartı kapat.
- Lifecycle: reklam pasif → kart `cancelled`; yeni reklam → yeni kart.

---

## A. Mevcut `ai_suggestions` kullanımı

**Kim okuyor?** **Hiç kimse.** `ai_suggestions` yalnızca yazılıyor ([lib/dijimagic/ai/persist.ts:145](../lib/dijimagic/ai/persist.ts#L145)), hiçbir API route'u veya component okumuyor (grep ile doğrulandı). `payload.ad_spec` üretiliyor ama UI'a giden yol yok.

**AdPreviewCard hangi kaynaktan besleniyor?**
- Route: `/dijimagic` ([app/dijimagic/page.tsx](../app/dijimagic/page.tsx)). `/dijimagic/dijialgoritma` alt route'u **yok**.
- Akış: [AiAdSuggestions](../components/dijimagic/AiAdSuggestions.tsx) → `POST /api/dijimagic/generate-ad` → `generateFullAutoProposals` ([lib/dijimagic/adCreator.ts](../lib/dijimagic/adCreator.ts)) → `FullAdProposal[]` → [AdPreviewCard](../components/dijimagic/AdPreviewCard.tsx).
- Bu pipeline `ai_suggestions` ile **ilgisiz**. Yani ekrandaki kartlar tarama motorunun çıktısı değil.
- İkinci yol: `buildDeepAnalysisFromAi` ([persist.ts:161](../lib/dijimagic/ai/persist.ts#L161)) `recommended_actions`'ı `DeepAction`'a çevirirken **`payload`'ı düşürüyor** ([persist.ts:204-217](../lib/dijimagic/ai/persist.ts#L204-L217)). `DeepAction[]` → `command_center_data` → sadece [DijiAlgoritmaHeader](../components/dijimagic/DijiAlgoritmaHeader.tsx) ticker'ı + sayaçlar. Kart yok.

**Geçiş kararı:** **Paralel yeni component.** Mevcut `AiAdSuggestions`/`AdPreviewCard` (generate-ad) ve `command_center` akışına dokunmadan, yeni `ai_ad_improvements` tablosunu okuyan yeni bir kart ızgarası eklenir. `AdPreviewCard`'ın koyu/emerald görsel + animasyon stili yeni karta taşınır (in-place değişim değil — prod risk minimizasyonu). Eski `ai_suggestions` akışı paralel kalır, oturunca deprecate.

---

## B. Aktif reklam listesi & creative fetch

Her iki fetcher de **yalnızca aktif/enabled** entity döndürür → "aktif reklam listesi" = fetcher çıktısı. Ad ID'leri stabil. Ad-level tip: `AdInsight` ([analysisTypes.ts:41-56](../lib/dijimagic/analysisTypes.ts#L41-L56)).

| | Meta (`fetchMetaDeep`) | Google (`fetchGoogleDeep`) |
|---|---|---|
| Filtre | `effective_status=["ACTIVE"]` | `status='ENABLED'` (campaign/ad_group/ad_group_ad) |
| Ad alanları | `id, name, status, format` + **creative**: `creativeBody, creativeTitle, callToActionType, linkUrl` | `id, name, status, format(type)` — metrikler |
| **Full creative?** | ✅ **VAR** (body/title/cta/link, `object_story_spec` fallback) | ❌ **YOK** — RSA headlines/descriptions çekilmiyor |

**Google creative gap (Faz 2 işi):**
- Gerekli: `fetchGoogleDeep`'in GAQL sorgusuna `ad_group_ad.ad.responsive_search_ad.headlines`, `...descriptions`, `...path1/path2`, `ad_group_ad.ad.final_urls` eklenmeli (RSA için; diğer ad tipleri için ilgili alanlar).
- API: **mevcut Google Ads `searchStream`** — yeni endpoint/aktör **gerekmez**, yalnızca SELECT alan ekleme + parse. Efor: **düşük-orta** (sorgu + normalizer). `AdInsight`'a `creativeHeadlines?: string[]`, `creativeDescriptions?: string[]`, `finalUrls?: string[]` opsiyonel alanları eklenir (additive, Meta'yı etkilemez).

---

## C. Yeni tablo: `ai_ad_improvements`

```
id                          uuid PK default gen_random_uuid()
user_id                     uuid/text  FK→users (RLS anahtarı)
source_ad_id                text       Meta ad id / Google ad_group_ad ad id
source_platform             text       'meta' | 'google'
source_ad_name              text null
source_campaign_id          text null  bağlam/gruplama
source_ad_status_snapshot   text       scan anındaki status (ACTIVE/ENABLED…)
improvement_payload         jsonb      { ad_spec, reasoning, competitor_comparison, compliance_notes, confidence }
status                      text       'pending'|'approved'|'rejected'|'cancelled'|'applied'
model                       text null  üretimde kullanılan model (maliyet izleme)
run_id                      uuid null  → ai_engine_runs
created_at                  timestamptz default now()
decided_at                  timestamptz null  approve/reject anı
applied_at                  timestamptz null  canlıya alındığı an
cancelled_at                timestamptz null  auto-cancel anı
decided_by                  text null  user_id veya 'system' (auto-cancel)
decision_reason             text null  kullanıcı reddederken not
```

**İndeks/garanti önerileri:**
- Partial unique: `UNIQUE (user_id, source_platform, source_ad_id) WHERE status IN ('pending','approved')` → bir aktif reklamın aynı anda tek açık kartı (DB seviyesinde "varsa skip" garantisi). Reddedilen/iptal/applied tarihçede kalır.
- Index: `(user_id, status)` listeleme; `(user_id, source_platform, source_ad_id)` lifecycle diff.
- RLS: `user_id = auth.uid()` — mevcut `ai_suggestions`/`ai_engine_runs` RLS deseni birebir.
- Migration **yeni tablo** → mevcut tabloya dokunmaz, repoint/split-brain riski yok. Canonical Supabase `omddq`'ya additive.

**⚠️ Karar gereken / işaretli noktalar:**
1. **`approved` vs `applied` ayrımı:** `approved` = kullanıcı onayladı ama henüz publish edilmedi; `applied` = Meta/Google API'de gerçekten oluşturuldu. İkisi ayrı mı, yoksa onay = anında publish mi? (Aşağıda G'de publish güvenlik bayrakları var.) **Öneri:** `approved` → publish denemesi → başarı `applied`, başarısız `approved` + `decision_reason`'a hata. Onayını bekliyorum.
2. **Refresh policy:** Açık (`pending`) kart varken reklam değişmişse ne olur? (Skip mi, yenile mi?) Bkz. D.
3. **Google'da creative eksikse** `ad_spec` yine de üretilsin mi (sadece metrik+ürün bazlı), yoksa creative fetch tamamlanana kadar Google atlansın mı?

---

## D. Lifecycle worker

**Tetikleyiciler:** Haftalık cron ([/api/cron/dijialgoritma-scan](../app/api/cron/dijialgoritma-scan/route.ts) deseni, `USE_AI_ENGINE` flag) + on-demand. Mevcut durable iskelet [dijialgoritmaScanUser](../inngest/functions/dijialgoritmaScan.ts) (fetch→submit→poll→retrieve→persist) üzerine kurulur.

**Akış (per user, durable step):**
1. **Fetch aktif reklamlar** — `fetchMetaDeep` + `fetchGoogleDeep` → düz `AdInsight` listesi (`platform + source_ad_id` anahtarlı).
2. **DB diff** — mevcut `ai_ad_improvements (status IN pending,approved)`:
   - Aktif ad + açık kart **var** → **skip** (token tasarrufu).
   - Aktif ad + kart **yok** → **AI üret** → `pending` insert.
   - Açık kart + ad artık aktif listede **yok** → **`cancelled`**, `cancelled_at=now()`, `decided_by='system'`.
3. **AI üretimi** — aktif ad başına Batch API isteği (E).
4. **Persist** — `ai_ad_improvements` upsert + opsiyonel `ai_engine_runs` kaydı.

**⚠️ Refresh policy kararı (Onur):**
- (varsayılan öneri) **"Açık kart varsa skip"** — reklam değişse bile kullanıcı karara varana kadar yeni kart üretme (gürültü + maliyet önler). Reddedilen kart sonraki taramada yeniden üretilebilir (partial unique reddedilenleri kapsamıyor).
- Alternatif: reklamın creative hash'i değiştiyse eski `pending` kartı `cancelled` yapıp yenisini üret. Daha güncel ama daha maliyetli + kullanıcı emeğini boşa çıkarabilir. **Senin kararını bekliyorum.**

---

## E. AI engine prompt değişikliği (per-ad mode)

- Mevcut prompt ([systemPrompt.ts](../lib/dijimagic/ai/systemPrompt.ts)) **hesap geneli** çıktı veriyor: `critical_alerts[] + opportunities[] + recommended_actions[]`. Tek Claude isteği = tüm hesap.
- Yeni mod: **tek reklam → tek improvement proposal nesnesi**. Çıktı şeması (taslak):
  ```
  {
    "ad_spec": { ...mevcut AdSpec şeması: platform, campaign_type, conversion_goal, cta,
                  budget, targeting, creative{headlines,descriptions,primary_text,...},
                  compliance_notes },
    "reasoning": "bu reklamın zayıf noktası + neden bu iyileştirme (hesaba özgü metrik)",
    "competitor_comparison": "rakip reklam analizine göre fark (A4 context)",
    "confidence": 0-100,
    "keep_or_improve": "improve" | "already_strong"   // güçlüyse kart üretme/önerme
  }
  ```
- **Three-pillar korunur** (kullanıcı beyanı + platform kuralları + rakip analizi); sadece scope tek reklama daralır.
- **Maliyet optimizasyonu (önemli):** Paylaşılan bağlam (business brief + rakip + curated platform kuralları) **cached system block**'a taşınır; user message **yalnızca tek reklamın** verisini taşır. Böylece N ad isteğinde paylaşılan bağlam cache-read (ucuz) olur. Mevcut `buildSystemBlocks` zaten `cache_control: ephemeral` kullanıyor — business brief de buraya alınmalı.
- **`agent.ts` değişikliği:** `buildBatchRequestParams` per-ad varyantı; `MAX_TOKENS`/`THINKING_BUDGET` tek reklam için düşürülebilir (ör. thinking 8000→4000) — maliyet düşer.
- Çıktı validasyonu mevcut [adSpecPayload.ts](../lib/dijimagic/ai/adSpecPayload.ts) `validateAdSpec` ile uyumlu (yeniden kullanılır).

---

## F. Brand Intelligence Ingestion

**KRİTİK BULGU: Bu sistemin %80'i ZATEN VAR — ama deterministik (LLM yok).**

Mevcut pipeline ([app/api/dijimagic/business-profile/route.ts](../app/api/dijimagic/business-profile/route.ts) → `runProfileScansAndIntelligence`):
- **Trigger hook VAR:** business-profile POST → fire-and-forget; hem ilk kurulumda hem her revizyonda çalışır. (Yeni hook eklemeye gerek yok.)
- **Apify IG/FB scraper'ları VAR:** [socialSourceScanner.ts](../lib/dijimagic/socialSourceScanner.ts) + [apifySocialRunner.ts](../lib/dijimagic/apifySocialRunner.ts) — `encodeActorId` (`/`→`~`), `waitForFinish=50`, IG/FB/LinkedIn/YouTube/TikTok aktörleri env'de tanımlı. Apify yoksa public-metadata fallback. (Yeni aktör satın almaya gerek yok — onaylanan kararla aynı.)
- **Website fetch VAR:** [businessSourceScanner.ts](../lib/dijimagic/businessSourceScanner.ts) — HTTP + HTML strip (cheerio/readability değil, kendi extractor'ı).
- **Intelligence yazımı VAR:** `buildBusinessIntelligenceRow` ([businessIntelligenceBuilder.ts](../lib/dijimagic/businessIntelligenceBuilder.ts)) → `user_business_intelligence` (zengin kolonlar: company_summary, keyword_themes[], recommended_*; confidence; missing_data[]). **Ama tamamen deterministik — Claude çağrısı YOK.**

**Yani senin istediğin yeni kısım = "Claude sentezi" katmanı.** Plan:
- Mevcut scraper çıktıları (`user_business_source_scans` satırları: own_brand website+IG+FB) → **tek Claude sentez çağrısı** → zenginleştirilmiş intelligence (örn. `brand_voice`, `value_proposition`, `messaging_pillars`, daha iyi `company_summary`).
- `user_business_intelligence`'a **additive kolon(lar)** veya `ai_synthesis jsonb` kolonu eklenir (deterministik alanlar korunur — regresyon yok; Claude başarısızsa deterministik fallback kalır).
- **Inngest function (concurrency 3):** mevcut inline fire-and-forget yerine durable Inngest'e taşınır (Claude latency'si fire-and-forget'i uzatır). `brand/ingest.user` event.

**⚠️ ÇELIŞKI — manuel "Yenile" butonu (Onur kararı gerek):**
- Senin G/F isteğin: "Manuel **Yenile** butonu" + "Profile completion (otomatik)" + "URL update (otomatik)" + "aylık opsiyonel cron (default kapalı)".
- **AMA** [CLAUDE.md](../CLAUDE.md) kuralı: *"Manuel Tara Butonu — YOK. Tarama yalnızca otomatik tetiklenir."* İşletme Profili UI'da bilinçli olarak buton yok.
- Bu doğrudan çelişiyor. **Karar:** (a) CLAUDE.md kuralını güncelleyip "Brand Bilgilerini Yenile" butonunu ekleyelim mi, yoksa (b) yalnızca otomatik (completion + URL update + opsiyonel cron) mu kalsın? Senin onayını bekliyorum — kuralı ben tek taraflı bozmam.

**Tetikleme matrisi (öneri):**
| Tetik | Otomatik mi | Not |
|---|---|---|
| Profile completion | ✅ | mevcut hook'a Claude sentez adımı eklenir |
| Profile URL update | ✅ | aynı hook (her revizyonda çalışıyor) |
| Manuel "Yenile" | ⚠️ karar | CLAUDE.md çelişkisi |
| Aylık cron | ✅ (flag default **kapalı**) | prod risk min. — opt-in |

---

## G. UI değişikliği & publish path

**Kart grid'i:** Yeni `AdImprovementCard` (AdPreviewCard stilinde) + yeni grid component, `/dijimagic`'de `AiAdSuggestions`'ın yanında/yerine yeni bölüm. `GET /api/dijimagic/ad-improvements` (yeni) → `ai_ad_improvements (status=pending)` döner.

**Onayla / Reddet endpoint'leri (yeni):**
- `POST /api/dijimagic/ad-improvements/[id]/approve` → `status=approved` → publish denemesi.
- `POST /api/dijimagic/ad-improvements/[id]/reject` → `status=rejected` + `decision_reason`.

**Publish altyapısı — MEVCUT (Meta tam, Google kısmi):**
- **Meta: ✅ tam 3-katman create var** — [/api/meta/campaigns/create](../app/api/meta/campaigns/create/route.ts) → [/api/meta/adsets/create](../app/api/meta/adsets/create/route.ts) → [/api/meta/ads/create](../app/api/meta/ads/create/route.ts) (adcreative + ad). `AdCreationWizard` → `POST /api/dijimagic/create-ad` zaten bu zinciri orkestre ediyor. **Yeniden kullanılır.**
- **Google: ⚠️ native create route YOK.** `/api/dijimagic/create-ad` Google için `fetch('/api/integrations/google-ads/campaigns/create')` çağırıyor — bu **external/custom entegrasyon, bu audit'te doğrulanmadı**. Google approve→publish güvenilirliği belirsiz; Faz 2'de ayrıca doğrulanmalı. (Not: memory — Google/Meta entegrasyon koduna dokunma; yalnızca çağırırız.)
- **Publish güvenliği VAR:** [publishSafety.ts](../lib/dijimagic/publishSafety.ts) — `DIJIMAGIC_DIRECT_PUBLISH_ENABLED` (default true), `DIJIMAGIC_ACTIVE_PUBLISH_ENABLED` (default **false** → reklamlar PAUSED oluşturulur), `DIJIMAGIC_MAX_DAILY_BUDGET_TRY` (default 1000). Yeni akış bu flag'lere uyar — onaylanan reklam **PAUSED** açılır, kullanıcı Ads Manager'dan aktive eder (mevcut davranış).

**"Brand Bilgilerini Yenile" butonu:** İşletme Profili sayfasına ([app/dijimagic/isletme-profili/page.tsx](../app/dijimagic/isletme-profili/page.tsx)) eklenir — **ama F'deki CLAUDE.md çelişkisi çözülmeden eklenmez.**

---

## H. Maliyet & token tahmini

**Mevcut config:** model `claude-sonnet-4-6` (env `ANTHROPIC_MODEL_AI_ENGINE`), `MAX_TOKENS=24000`, `THINKING_BUDGET=8000`, **Batch API** (%50 indirim), system blocks cached (~3.3K token kurallar + ~1K prompt).

> Fiyat varsayımı (doğrulanmalı): Sonnet ~ input $3 / output $15 (MTok). Batch %50 → input $1.5 / output $7.5. Cache-read ~$0.30/MTok.

**Per-request (per-ad) kaba tahmin:**
- Paylaşılan bağlam cached-read (~5K) → ihmal edilebilir. Unique ad verisi ~1.5K input. Output+thinking ~6K (thinking 4K'ya düşürülürse daha az).
- ≈ **$0.04–0.06 / reklam**.

**Per-user / hafta:**
- Önce (hesap geneli): ~2 istek (Meta+Google) → ~$0.10/hafta.
- Sonra (per-ad): tipik 5 Meta + 3 Google = 8 reklam → 8 istek → ~**$0.40–0.50/hafta** (≈ 4–5×). "Skip unchanged/açık kart" ile düşer.

**100 kullanıcı / ay:** 100 × ~$0.45 × 4.3 hafta ≈ **$190 (aralık ~$150–$300)/ay**. (Mevcutun ~4-5 katı; Batch + cache + skip ile sınırlı.)

**Brand ingestion:** one-time/kullanıcı: Apify IG+FB (~$0.01–0.05/run) + 1 Claude sentez (~$0.02) ≈ **$0.05–0.15 one-time**; refresh aynı. 100 kullanıcı one-time ≈ $5–15. İhmal edilebilir.

---

## Faz 2 implementation sırası (onay sonrası)
1. Migration: `ai_ad_improvements` (+ `user_business_intelligence` additive `ai_synthesis` kolonu).
2. `fetchGoogleDeep` + `AdInsight`: full RSA creative (additive).
3. `agent.ts` + prompt: per-ad mode + paylaşılan bağlam cached block'a.
4. Inngest: per-ad improvement generator + lifecycle worker + `brand/ingest.user` (Claude sentez, concurrency 3).
5. UI: `AdImprovementCard` + grid + approve/reject endpoint'leri + (karar verilirse) "Yenile" butonu.
6. Eski `ai_suggestions` paralel kalır → oturunca deprecate.
7. Smoke test: Onur hesabı manuel scan → per-ad kartlar + onay akışı + brand sentez kontrolü.

---

## Onay bekleyen kararlar (özet)
1. **C1** — `approved` → publish → `applied`; başarısızlık `approved`'da hata notuyla kalsın mı? (öneri: evet)
2. **D** — Refresh policy: "açık kart varsa skip" (öneri) mi, creative değişiminde yenile mi?
3. **C3/B** — Google creative fetch tamamlanana kadar Google kartları üretilsin mi (metrik bazlı) yoksa beklensin mi?
4. **F (çelişki)** — Manuel "Brand Yenile" butonu: CLAUDE.md "manuel buton yok" kuralını güncelleyelim mi, yoksa sadece otomatik mi kalsın?
5. **G** — Google publish external entegrasyonu (`/api/integrations/google-ads/...`) Faz 2'de ayrıca doğrulanacak — şimdilik Meta-önce mi gidelim?
