# Web Site Yöneticisi — Tek-Ekran Wizard + Firecrawl Referans + Onayla/Reddet/Düzenle Review

**Tarih:** 2026-06-16
**Durum:** Onaylandı (kullanıcı kararları aşağıda)
**İlgili:** `project_website_builder`, `feedback_website_builder_design_quality`, 2026-06-15 tasarım turu

## İstek (kullanıcı)
1. "Yeni Site Oluştur" formu (ad/tür/dil/font/referans) ile "Sitenizi tarif edin" alanı **tek ekranda** olmalı (iki step birleşsin).
2. "AI ile Oluştur" **referans siteleri Firecrawl ile tarayıp** header/footer/layout/sayfalar dahil en yakın tasarımı üretsin; kullanıcı açıklaması da bu taramayla **birlikte** değerlendirilsin.
3. Site hazır olunca **ayrı sayfada detaylı + responsive** önizleme; **Onayla / Reddet / Düzenle**.
4. Reddet/Düzenle → kullanıcıdan sebep/talep metni → AI revize. "AI nereyi düzelteceğini anlasın" mantığını tasarla.

## Kullanıcı kararları
- **Kredi:** İlk üretim kredili + **3 ücretsiz revize**, sonrası revize başına kredili. (Owner/süper admin muaf — mevcut featureGuard.)
- **Form:** **Ayrı tam-sayfa wizard** (modal değil) — arka plan **blur**, wizard çerçevesinde **soldan sağa sonsuz dönen yeşil shimmer** ("yılan" border). Tüm alanlar tek ekranda.
- **Reddet = radikal** (baştan farklı düzen/ton/renk), **Düzenle = cerrahi** (mevcut yapı korunur, yalnız belirtilen yerler değişir; AI'a mevcut içerik özeti verilir).
- **KORU:** Boş-durum karşılama animasyonu (`WebsiteBuilderAnimation`) — dokunma.

## Tasarım

### 1. Tek-ekran wizard (`CreateSiteWizard`)
- Tam-ekran overlay: `bg-black/50 backdrop-blur-md` (arka plan dashboard blur).
- Ortada büyük wizard kartı; çerçevede **animated shimmer border** (conic-gradient + `@property --angle` rotation, yeşil; `globals.css`).
- Alanlar (tek scroll, tek ekran): site adı · tür · diller · yazı stili · referans URL'ler (3) · **marka açıklaması/tarif (textarea + Sesle yaz)** · **logo (opsiyonel)**.
- Aksiyon: **"AI ile Oluştur"** (birincil) + "Hızlı Oluştur" (ikincil).
- Akış: `POST /api/website` (draft + instructions theme'e) → dönen id → logo varsa upload → `POST /api/website/[id]/generate` (instructions ile) → detay sayfasına git (review modu).
- Boş-durum `WebsiteBuilderAnimation` korunur; "Yeni Site Oluştur" butonu modal yerine bu wizard'ı açar.

### 2. Firecrawl referans tarama (`referenceScanner.ts`)
- `isFirecrawlReady()` ise `firecrawlScrape` (temiz markdown, JS-render dahil) + opsiyonel `firecrawlMap` (sayfa listesi → multipage ipucu). Key/flag yoksa **mevcut Cheerio'ya düşer (sıfır kesinti)**.
- Her iki yolda **yapı sinyalleri** çıkarılır: başlık hiyerarşisi/bölüm sırası, nav (header) öğeleri, footer varlığı, tema rengi, CTA örnekleri, sayfa sayısı.
- `.env.local` + Vercel'e `FIRECRAWL_API_KEY` + `FIRECRAWL_ENABLED=true` kullanıcı ekleyince Firecrawl devreye girer (default-off, prod risk yok).

### 3. AI üretim (`generate.ts`)
- Prompt'a referans **yapı/layout** vurgusu: "bu sitelerin header/footer/bölüm düzenini yaklaştır; ama kullanıcı açıklamasını ÖNCELE; birebir kopya değil."
- `GenerateInput`'a `revisionMode?: 'reject' | 'edit'` + `currentSummary?: string`.
  - **reject:** "Kullanıcı mevcut tasarımı reddetti. Şikayet: [instructions]. Tamamen FARKLI bir yön (düzen/ton/renk) dene." (mevcut içerik verilmez)
  - **edit:** "Mevcut siteyi KORU; yalnız şu düzeltmeleri uygula: [instructions]. MEVCUT İÇERİK: [currentSummary]." → AI hedefli değiştirir.

### 4. Ayrı önizleme + review (`/web-site-yoneticisi/[id]/onizleme`)
- Büyük responsive önizleme (masaüstü/tablet/mobil toggle), dil + sayfa sekmeleri, `/website-preview/[id]` iframe.
- Aksiyon barı: **Onayla** (→ publish akışı aktif) · **Reddet** · **Düzenle**.
- Reddet/Düzenle → panel açılır (sebep/talep textarea + Sesle yaz) → `POST generate { instructions, revisionMode }` → yeni üretim → önizleme tazelenir.
- Detay sayfasından "detaylı önizle" **ikonu** ile açılır.

### 5. Kredi (`generate` route)
- `revisionMode` set ise revize. Ücretsiz hak: `reason='revision'` sürüm sayısı < 3 → **cost 0**; ≥3 → `WEBSITE_REVISION_COST`. (listVersions ile sayılır — migration yok.)
- İlk üretim eskisi gibi `computeGenerationCost`.
- Owner bypass korunur (chargeFeature).

## Mimari / risk
- **Migration YOK:** instructions `theme.initialInstructions` (jsonb); pending state'e gerek yok (mevcut **version** sistemi her üretimi kaydeder, review = UI state + revize).
- **Dokunulmuyor:** Meta/Google, publish/domain/version çekirdek akışı, SSRF/XSS koruması, `WebsiteBuilderAnimation`.
- **i18n:** tüm yeni metin `tr.json` + `en.json` (wizard, review, Reddet/Düzenle panelleri, Onayla/Reddet/Düzenle — common'dan tekrar kullan).
- **Doğrulama:** gerçek render (Playwright) — wizard shimmer + review akışı + responsive; ardından adversarial review workflow.
