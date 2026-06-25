# DijiAlgoritma Bağlam Audit Raporu

> Tarih: 2026-05-20
> Audit eden: Claude Code (Opus 4.7)
> Kapsam: DijiAlgoritma haftalık AI tarama motorunun ([lib/dijimagic/ai/](../lib/dijimagic/ai/)) [dijialgoritma_proje_amaci.md](dijialgoritma_proje_amaci.md)'ndaki iş kurallarıyla uyumu.
> Yöntem: Salt okuma + kod izleme + canlı Apify testi. **Üretim koduna dokunulmadı.**

---

## Özet Tablosu

| Konu | Mevcut Durum | Beklenti | Uyum | Aksiyon |
|------|--------------|----------|------|---------|
| Aktif filtre (Meta) | `effective_status:'["ACTIVE"]'` Graph API fetch'inde uygulanıyor ([metaDeepFetcher.ts:127](../lib/dijimagic/metaDeepFetcher.ts#L127)) | effective_status=ACTIVE | ✅ | Yok |
| Aktif filtre (Google) | GAQL `status='ENABLED'` campaign + ad_group + ad_group_ad üç düzeyde ([googleDeepFetcher.ts:161,226,274](../lib/dijimagic/googleDeepFetcher.ts#L161)) | status=ENABLED | ✅ | Yok |
| Platform docs entegrasyonu | System prompt'ta **yok**; RAG/vector store yok ([systemPrompt.ts](../lib/dijimagic/ai/systemPrompt.ts)) | Sistemde + AI okuyor | ❌ | A1 |
| Apify kod entegrasyonu | Var ve çalışıyor; ama yalnızca on-demand UI route'larında çağrılıyor | Bağlı ve çalışıyor | ⚠️ | A2 |
| Apify canlı test | İki actor da SUCCEEDED, gerçek veri döndü | Gerçekçi sonuç | ⚠️ | A4 |
| Apify → Claude akışı | **Yok** — `lib/dijimagic/ai/*` içinde hiçbir competitor/apify referansı yok | Context olarak gidiyor | ❌ | A2 |
| Business profile context | Kısmi — 6 alan gidiyor; rakipler, intelligence, marka adı, website, ürünler **gitmiyor** ([scanUser.ts:152-177](../lib/dijimagic/ai/scanUser.ts#L152)) | Her scan'de Claude'a (tam) | ⚠️ | A3 |
| Tam ad spec çıktısı | **Üretilmiyor** — yalnızca alerts/opportunities/recommended_actions; `payload` boş ([types.ts](../lib/dijimagic/ai/types.ts), [persist.ts:128-147](../lib/dijimagic/ai/persist.ts#L128)) | Üretiliyor + saklanıyor | ❌ | A5 |

**Skor: 2 tam uyum / 3 kısmi / 3 eksik.** Üç ayaklı analiz prensibinin (proje amacı Bölüm 2) yalnızca **1. ayağı (kullanıcının aktif reklamları)** tam çalışıyor. 2. ayak (platform kuralları) ve 3. ayak (rakip analizi) AI motoruna **hiç bağlı değil**.

---

## Detaylar

### 1. Aktif Kampanya Filtresi — ✅ UYUMLU

**Meta** ([metaDeepFetcher.ts:124-130](../lib/dijimagic/metaDeepFetcher.ts#L124)):
```
filtering: effective_status: '["ACTIVE"]'
```
Graph API `/campaigns` çağrısında `effective_status=["ACTIVE"]` filtresi uygulanıyor — yalnızca aktif kampanyalar çekiliyor. Adset/ad için de `effective_status||status` korunuyor.

**Google** ([googleDeepFetcher.ts](../lib/dijimagic/googleDeepFetcher.ts)):
- Satır 161: `AND campaign.status = 'ENABLED'`
- Satır 226: `AND ad_group.status = 'ENABLED'`
- Satır 274: `AND ad_group_ad.status = 'ENABLED'`

Üç hiyerarşi düzeyinde de ENABLED filtresi var.

> **Not:** [accountSerializer.ts:42](../lib/dijimagic/ai/accountSerializer.ts#L42) ayrıca `status==='ACTIVE'||'ENABLED'` ile *sayım* yapıyor, ama asıl filtre fetch katmanında olduğu için Claude'a giden `campaignsDetail` zaten aktif-only. Kural tam karşılanıyor.

---

### 2. Platform Dokümanlarının AI Engine'de Kullanımı — ❌ EKSİK

- [systemPrompt.ts](../lib/dijimagic/ai/systemPrompt.ts) içinde Meta/Google resmi reklam kuralları, karakter limitleri, asset spec'leri, politika referansı **yok**.
- Vector store / RAG **yok**. Tüm context tek pass'te `buildUserBrief` ile veriliyor; bu brief yalnızca `account_overview` + `campaignsDetail` + `benchmarks` + (kısmi) `businessContext` içeriyor ([systemPrompt.ts:102-140](../lib/dijimagic/ai/systemPrompt.ts#L102)).
- Sistem promptu açıkça "Veri zaten elinde — başka bir kaynaktan veri çekme veya varsayım yapma" diyor ([systemPrompt.ts:25](../lib/dijimagic/ai/systemPrompt.ts#L25)) — yani AI'ın platform kurallarını "bildiği" varsayılıyor, dokümana dayanmıyor.

**Sonuç:** AI önerileri platform kurallarına (karakter limiti, asset oranı, politika) karşı **doğrulanmıyor**. Part 2'de üretilen [meta_resmi_reklam_dokumanlari.md](meta_resmi_reklam_dokumanlari.md) + [google_ads_resmi_dokumanlari.md](google_ads_resmi_dokumanlari.md) henüz hiçbir yere bağlı değil.

**Bağlama önerisi:** [resmi_dokumanlar_index.md](resmi_dokumanlar_index.md) Bölüm 3, Seçenek A (platforma göre koşullu, cache'li system bloğu). Mevcut `cache_control: ephemeral` zaten var ([agent.ts:65-70](../lib/dijimagic/ai/agent.ts#L65)) → doküman bloğu cache'lenir, batch maliyeti artmaz.

---

### 3. Apify / Rakip Analizi — Uçtan Uca İz Sürüm (6 soru)

#### Soru 1 — Apify integration kodda nerede?
**Var ve sağlam yazılmış.** Çekirdek dosyalar:
- [lib/dijimagic/apifyCompetitorProvider.ts](../lib/dijimagic/apifyCompetitorProvider.ts) — Apify REST API çağrıları (`runApifyActor`, `fetchApifyDatasetItems`), Meta/Google normalize fonksiyonları.
- [lib/dijimagic/competitorScanner.ts](../lib/dijimagic/competitorScanner.ts) — unified scan orchestrator (`runCompetitorScanForUser`, Meta+Google).
- [lib/dijimagic/competitorAdStore.ts](../lib/dijimagic/competitorAdStore.ts) → `dijimagic_competitor_ads` tablosu.
- [lib/dijimagic/competitorInsightStore.ts](../lib/dijimagic/competitorInsightStore.ts) → `dijimagic_competitor_insights` tablosu.

**Actor ID encoding doğru:** [apifyCompetitorProvider.ts:199](../lib/dijimagic/apifyCompetitorProvider.ts#L199) `actorId.replace(/\//g, '~')` kullanıyor — CLAUDE.md kuralına **uygun** (encodeURIComponent kullanılmıyor). `buildMetaActorInput`'taki `encodeURIComponent` yalnızca Facebook arama URL'sinin `q=` değeri için — actor ID için değil, bu doğru.

**Env:** `APIFY_API_TOKEN` (.env.local'de set, 46 char), `APIFY_META_AD_LIBRARY_ACTOR_ID=curious_coder/facebook-ads-library-scraper`, `APIFY_GOOGLE_ADS_TRANSPARENCY_ACTOR_ID=solidcode/ads-transparency-scraper`. `META_AD_LIBRARY_PROVIDER`, `GOOGLE_ADS_TRANSPARENCY_PROVIDER`, `COMPETITOR_ADS_PROVIDER` hepsi `apify`.

#### Soru 2 — Inputs nereden geliyor?
İki kaynak var:
- **On-demand route'lar:** [app/api/dijimagic/competitors/meta-ad-library/route.ts](../app/api/dijimagic/competitors/meta-ad-library/route.ts) ve [google-auction/route.ts](../app/api/dijimagic/competitors/google-auction/route.ts) — UI'dan gelen `query`/`country` ile çağrılıyor.
- **Query türetme:** [competitorScanner.ts:112](../lib/dijimagic/competitorScanner.ts#L112) `deriveCompetitorQueriesFromCampaigns` — kampanya keyword/domain/isimden sorgu çıkarıyor (LLM'siz).

Business profile'daki rakip listesi (`user_business_competitors` tablosu — competitor_name + sosyal URL'ler) **bu akışlara beslenmiyor**; competitor scanner kampanya/keyword bazlı çalışıyor, profildeki rakip adları kullanılmıyor.

#### Soru 3 — Outputs nereye yazılıyor?
- `dijimagic_competitor_ads` (normalize edilmiş rakip reklamları, fingerprint dedup ile) — [competitorAdStore.ts](../lib/dijimagic/competitorAdStore.ts).
- `dijimagic_competitor_insights` (snapshot/özet) — [competitorInsightStore.ts](../lib/dijimagic/competitorInsightStore.ts).

> **Satır sayısı doğrulanamadı:** Üretim DB'sine bu oturumdan erişilemedi (bkz. "Ortam Notu" altında). DB durumu raporlanamadı; ancak akış kod düzeyinde kesin.

#### Soru 4 — Sonuçlar Claude'a gidiyor mu? → ❌ **HAYIR**
**Kesin kanıt:** `lib/dijimagic/ai/*` (AI motorunun tamamı) içinde `competitor`, `apify`, `ad_library`, `transparency`, `rakip` kelimelerinin **hiçbiri geçmiyor** (grep: NONE FOUND).

Akış izi:
```
cron → inngest dijialgoritmaScanUser → gatherUserScanInputs (scanUser.ts)
     → fetchMetaDeep + fetchGoogleDeep + loadBusinessContext
     → buildBatchRequestParams (agent.ts) → buildUserBrief (systemPrompt.ts)
     → Anthropic Batch API
```
`buildUserBrief` payload'ı yalnızca: `account_overview`, `campaignsDetail`, `benchmarks`, kısmi `businessContext`. **Rakip reklam context'i hiçbir adımda eklenmiyor.** `dijimagic_competitor_ads` / `dijimagic_competitor_insights` tabloları AI motoru tarafından **hiç okunmuyor**.

**Sonuç:** Üç ayaklı prensibin 3. ayağı (rakip analizi) AI taramasında tamamen kopuk. Apify altyapısı yalnızca Competitor Dashboard / reklam üretimi gibi ayrı UI akışlarına hizmet ediyor.

#### Soru 5 — CANLI TEST (Trendyol, her iki actor) → ✅ çalışıyor, ⚠️ normalize/copy sorunları
Her iki actor da `query=Trendyol`, `country/region=TR`, sonuç **10 ile sınırlandırılarak** çalıştırıldı. **Maliyet: toplam < $0.01** (Meta computeUnits 0.001095; Google usageTotalUsd 0.00005).

**Meta — `curious_coder/facebook-ads-library-scraper`** → `SUCCEEDED`, 10 kayıt, gerçek Trendyol reklamları:
```
page_name:           "Trendyol"
snapshot.body.text:  "Aradığın ne varsa Trendyol'da! 🏃‍♂️🏃‍♀️"
snapshot.title:      "{{product.name}}"   (dinamik katalog)
snapshot.cta_text:   "Shop now"
snapshot.link_url:   "https://www.trendyol.com/"
is_active: true,  start_date: 1772179200
```
⚠️ **Normalize uyumsuzluğu:** Actor'ın güncel çıktısında reklam metni **`snapshot.{body.text, title, cta_text}`** altında iç içe. Ama [normalizeApifyMetaAd](../lib/dijimagic/apifyCompetitorProvider.ts#L328) düz üst-seviye anahtarları okuyor (`bodies`/`body`/`adCreativeBodies`/`title`/`cta`). Bu anahtarlar üst seviyede **yok** → `ad_body=null, ad_title=null, call_to_action=null` döner. Sadece `advertiser_name` (page_name) kurtulur. **Yani rakip akışı bağlansa bile reklam metni kaybolurdu.**

**Google — `solidcode/ads-transparency-scraper`** → `SUCCEEDED`, 10 kayıt. Çıktı anahtarları:
```
adFormat, adUrl, advertiserId, advertiserName, approxDaysShown,
creativeId, firstShown, lastShown, previewUrl
```
Örnek advertiser'lar: `Reachpeople OU`, `Bayer Turk Kimya`, `Türk Henkel`, `COIHUB Technology`.
⚠️ **İki sorun:**
1. **Reklam metni hiç yok** — çıktıda `headline/title/description/body/text` alanlarının **hiçbiri yok**. Actor sadece advertiser + creativeId + format + tarih + URL veriyor. [normalizeApifyGoogleAd](../lib/dijimagic/apifyCompetitorProvider.ts#L418) bu alanları arıyor ama hepsi null döner. Google rakip "reklam metni" analizi bu actor ile **mümkün değil** (yalnızca advertiser adı + kreatif görsel/URL).
2. **Alaka düşük** — `query=Trendyol` için dönen advertiser'lar Trendyol değil (Bayer, Henkel...). Actor searchQuery'yi gevşek eşleştiriyor / bölge geneli döndürüyor gibi.

#### Soru 6 — END-TO-END TEST → akış kod düzeyinde kesin KIRIK; canlı batch testi yapılmadı
- **Neden canlı batch çalıştırılmadı:** Gerçek tarama Anthropic Batch API kullanıyor (24h SLA — bu oturumda tamamlanamaz), ~$0.21 maliyet ve deploy edilmiş Inngest gerektiriyor. Daha önemlisi, Soru 4'teki kod kanıtı zaten kesin: rakip context'i payload'a hiç girmiyor, dolayısıyla final `ai_suggestions.reasoning`'de rakip referansı **olamaz**.
- **DB durumu doğrulanamadı (ortam kısıtı):** bkz. aşağıdaki Ortam Notu.

**Tanı:** Akış **kırık** — Apify çağrılsa ve veri `dijimagic_competitor_ads`'a yazılsa bile, o veri AI taramasına ulaşmıyor.

---

### 4. Business Profile Entegrasyonu — ⚠️ KISMİ

**Şema zengin** ([businessProfileStore.ts:25-140](../lib/dijimagic/businessProfileStore.ts#L25)):
- `user_business_profiles`: company_name, sector_main/sub, specialization, business_description, main_conversion_goal, target_locations, target_audience, website_url, instagram/facebook/linkedin/youtube/tiktok/google_business/marketplace_url, keywords, products_or_services, most_profitable_services, monthly_ad_budget_range, brand_tone, forbidden_claims, compliance_notes…
- `user_business_competitors`: rakip adı + tüm sosyal URL'ler.
- `user_business_intelligence`: company_summary, **competitor_summary, competitor_positioning_summary**, recommended_google_campaign_types, recommended_meta_objectives, recommended_content_angles, audience_pains, audience_motivations…

**Ama AI motoru bunun yalnızca küçük bir kısmını okuyor** ([scanUser.ts:152-177](../lib/dijimagic/ai/scanUser.ts#L152)):
```
.select('sector_main, sector_sub, business_description, brand_tone, target_audience, main_conversion_goal')
```
**Claude'a GİTMEYEN kritik alanlar:**
- ❌ `company_name` (marka adı!) — proje amacı Bölüm 3'te zorunlu
- ❌ `website_url` + sosyal hesaplar
- ❌ `products_or_services`, `most_profitable_services`, `keywords`
- ❌ `forbidden_claims`, `compliance_notes`
- ❌ Tüm `user_business_competitors` tablosu (rakipler)
- ❌ Tüm `user_business_intelligence` (sentezlenmiş rakip/konumlandırma/öneri zekası — zaten DB'de hazır ama kullanılmıyor)

Ayrıca `businessContext` `buildUserBrief`'te **1500 karaktere kırpılıyor** ([systemPrompt.ts:120](../lib/dijimagic/ai/systemPrompt.ts#L120)).

**Sonuç:** Proje amacındaki "aşçılık sertifikası" hatası **kısmen** önleniyor (sektör + iş tanımı gidiyor) ama marka adı, ürünler ve rakip bağlamı gitmediği için tam değil. En çarpıcısı: `user_business_intelligence` zaten sentezlenmiş rakip/konumlandırma özetini içeriyor ama AI taraması onu hiç çağırmıyor — **en düşük maliyetli kazanç buradadır** (Apify'ı yeniden çalıştırmadan, mevcut intelligence satırını payload'a eklemek).

---

### 5. Çıktı Yapısı — ❌ TAM AD SPEC ÜRETİLMİYOR

**Mevcut çıktı** ([types.ts](../lib/dijimagic/ai/types.ts), [persist.ts](../lib/dijimagic/ai/persist.ts)):
- `ai_alerts`: severity, title, reason, suggested_action, confidence, target_entity_*, evidence
- `ai_opportunities`: category, title, expected_impact, action_description, confidence, target_entity_*, evidence
- `ai_suggestions`: priority, action_type, title, reasoning, expected_impact, confidence, target_entity_*, **payload** (default `{}`)

**Eksik (proje amacı Bölüm 1 — tam ad spec):**
`ai_suggestions.payload` JSON kolonu mevcut ama system prompt onu doldurmayı **istemiyor** ve hiçbir yer yapılandırılmış ad spec yazmıyor. Üretilmeyen alanlar:
`campaign_type, conversion_goal, cta, budget, location, placements, demographics, creative_brief, headlines, descriptions`.

**Yorum:** Bu motor mevcut reklamları **optimize** ediyor (pause/budget/refresh önerileri), sıfırdan **reklam spec'i üretmiyor**. Tam ad spec üretimi muhtemelen ayrı akışta ([adCreator.ts](../lib/dijimagic/adCreator.ts), [generate-ad route](../app/api/dijimagic/generate-ad/route.ts), proposalEngineOrchestrator). Proje amacı DijiAlgoritma çıktısı olarak tam ad spec'i listelediğinden, bu ya (a) system prompt + types genişletilerek bu motora eklenmeli, ya da (b) proje amacı dokümanı "ad spec ayrı modülde üretiliyor" diye netleştirilmeli. **Karar Onur'a ait.**

---

## Ortam Notu (DB erişimi)

DB satır sayıları/örnekleri **bu oturumdan doğrulanamadı**:
- Sunucu supabase client'ı `SUPABASE_URL` (`fbqrhyxbdeejfcwsgixr.supabase.co`) + legacy JWT `SUPABASE_SERVICE_KEY` çiftini kullanıyor ([client.ts:4-5](../lib/supabase/client.ts#L4)) — ama bu host'a erişilemiyor (**HTTP 000 / DNS çözülmüyor**; proje paused/silinmiş olabilir).
- Aktif/public proje `NEXT_PUBLIC_SUPABASE_URL` (`omddqhcvhxvzrizehnzw`) yeni `sb_` anahtar sistemini kullanıyor; lokalde yalnızca `sb_publishable` (anon) anahtar var — RLS nedeniyle servis tabloları 0 satır döndürüyor; `sb_secret` anahtarı `.env.local`'de yok (muhtemelen sadece Vercel'de).

⚠️ **İkincil bulgu (setup):** `.env.local`'de iki farklı Supabase projesi var (`fbqr…` vs `omddq…`). Sunucu yazma yolu `fbqr…`'a, public okuma yolu `omddq…`'ya gidiyor gibi görünüyor. Lokal env'in stale olması muhtemel; **Vercel env'inin doğru tek projeye işaret ettiği ayrıca doğrulanmalı** (bu audit kapsamı dışı, ama AI motorunun yazdığı verinin UI'ın okuduğu projeyle aynı olduğundan emin olunmalı).

---

## Öncelik Sıralı Aksiyon Listesi

| # | Aksiyon | Etki | Tahmini iş yükü | Bağımlılık |
|---|---------|------|-----------------|------------|
| **A3** | `loadBusinessContext`'i genişlet: `company_name`, `website_url`, `products_or_services`, `most_profitable_services`, `forbidden_claims` + **`user_business_intelligence`** (özellikle competitor_summary, recommended_*) payload'a ekle. 1500 char limitini yükselt. | **Çok yüksek** — rakip & marka bağlamını Apify'ı bile çağırmadan getirir | Düşük (1 sorgu + brief genişletme) | Yok — veri zaten DB'de |
| **A2** | Rakip akışını AI motoruna bağla: scan sırasında `runCompetitorScanForUser` (veya hazır `dijimagic_competitor_ads`/`dijimagic_competitor_insights`) → `buildUserBrief`'e `competitor_ads` bölümü ekle. | Yüksek — 3. ayağı tamamlar | Orta (akış + payload + system prompt) | A4 (normalize fix) |
| **A4** | Apify normalize fix: (1) Meta için `snapshot.{body.text,title,cta_text,link_url}` iç içe okuma ekle; (2) Google actor'ın metin döndürmediğini kabul et → ya farklı actor/scrapeAdDetails, ya sadece advertiser+creative kullan. | Orta — rakip verisinin kalitesi | Düşük-Orta | Yok |
| **A1** | Platform dokümanlarını system prompt'a bağla (resmi_dokumanlar_index.md Seçenek A — platforma göre cache'li blok + uygunluk yönergesi). | Orta-Yüksek — 2. ayak + öneri uygunluğu | Düşük (cache zaten var) | Part 2 ✅ hazır |
| **A5** | Tam ad spec kararı: ya `ai_suggestions.payload`'ı yapılandırılmış spec ile doldur (system prompt + types genişlet), ya proje amacını "ad spec ayrı modül" diye netleştir. | Bağlama göre | Orta / Yok | Onur kararı |
| **A6** | (Setup) Supabase env tutarlılığını doğrula — `fbqr` vs `omddq`; AI motorunun yazdığı = UI'ın okuduğu proje. | Yüksek (veri görünürlüğü) | Düşük (env audit) | Yok |

---

## Hangi Parçalar Tamam, Hangi Parçalar Eksik

**✅ Tamam:**
- Aktif-only filtre (Meta + Google) — kusursuz.
- Apify altyapısı kod kalitesi — sağlam yazılmış, soft-fail, sahte veri üretmiyor, actor ID encoding doğru, Vercel timeout-safe. Canlı testte iki actor da çalıştı.
- Business profile'ın temel kısmı (sektör + iş tanımı + ton + hedef kitle + dönüşüm hedefi) Claude'a gidiyor.

**❌ / ⚠️ Eksik:**
- **Rakip analizi AI taramasına hiç bağlı değil** (3. ayak kopuk) — en kritik mimari boşluk.
- **Platform resmi dokümanları AI'a bağlı değil** (2. ayak yok).
- **Business profile'ın zengin kısmı kullanılmıyor** — marka adı, ürünler, rakipler ve hazır `user_business_intelligence` payload dışı.
- **Apify normalize katmanı actor'ların güncel çıktı şemasıyla uyumsuz** (Meta: nested snapshot; Google: metin yok).
- **Tam ad spec üretilmiyor** — motor optimizasyon odaklı, spec üretimi ayrı akışta.

**En yüksek getirili ilk adım: A3** — `user_business_intelligence` zaten sentezlenmiş rakip/konumlandırma zekasını içeriyor; tek bir sorgu + brief genişletmesiyle, ek maliyet veya Apify çağrısı olmadan, taramanın bağlam kalitesi büyük ölçüde artar.
