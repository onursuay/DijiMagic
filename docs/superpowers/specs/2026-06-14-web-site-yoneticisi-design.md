# Web Site Yöneticisi — Tasarım Belgesi (Spec)

> **Tarih:** 2026-06-14
> **Durum:** Faz 1 onaylandı, implementasyon planı bekleniyor
> **Referans:** [promake.ai](https://promake.ai/) (AI web sitesi kurucu)
> **Sahip kararı:** Onur Suay (onursuay@hotmail.com)

---

## 1. Vizyon

YoAi'ye yeni bir modül: **Web Site Yöneticisi**. Kullanıcı işletme bilgilerini verir, AI markaya uygun gerçek bir web sitesi üretir, kullanıcı önizleyip düzenler ve **tek tuşla yayına alır**. Hedef referans modeli Promake'tir: *"Talk to AI. Build a real website. Get your business online."*

Promake = aslında **6-7 bağımsız alt sistem**. Bu nedenle proje tek spec/plan'a sığmaz; **fazlara bölünür** ve her faz kendi tasarım→plan→inşa döngüsünden geçer. Bu belge **tüm yol haritasını** kaydeder ama **yalnız Faz 1'i** detaylandırır.

### Promake'ten doğrulanan kritik gözlem
Promake yayınlanan siteleri **kendi alt alan adlarında** barındırır (`apex-8831.published.promake.ai`, `panet-10818.site.promake.ai`). "Tek tuş yayın" sihrinin sırrı budur: site **platformun kendi altyapısında** yaşar. YoAi de aynı modeli benimser → `firma.yoai.app`.

---

## 2. Tam yol haritası (7 faz)

Her faz tek başına canlıya çıkabilir; bağımlılık sırası zorunludur.

| Faz | Kapsam | Dış bağımlılık / risk |
|-----|--------|----------------------|
| **Faz 1** 🔴 | **Üretim + Barındırma + Yayın (ÇEKİRDEK)** — bilgi/logo/kategori → AI çok-sayfalı site üretir → önizleme + yönlendirilmiş düzenleme → `firma.yoai.app` tek tuş yayın | Yok (Vercel + mevcut anahtarlar yeter) |
| **Faz 2** 🟡 | Sohbetle sürekli düzenleme + versiyon/rollback (logs + sandboxed edits) | Yok |
| **Faz 3** 🟡 | Kullanıcının kendi domainini bağlama + otomatik SSL | Vercel Domains API |
| **Faz 4** 🟠 | Domain **satın alma** (uygulama içinde) | **YASAL:** registrar reseller hesabı/API + markup + faturalama. Ayrı görüşülecek. |
| **Faz 5** 🟠 | İş e-postası (`contact@firma.com`) | E-posta sağlayıcı (forwarding hafif yolu önerilir) |
| **Faz 6** 🔴 | Ödeme alma + e-ticaret (üretilen sitelerde) | **YASAL:** para tutma riski. Hafif yol = her satıcı kendi ödeme hesabını bağlar (para YoAi'ye uğramaz). Ayrı görüşülecek. |
| **Faz 7** 🟡 | Sohbetle işletme yönetimi (indirim/banner/stok) + faturalar | Faz 2 + Faz 6 üstüne biner |

> **Sahip notu:** Faz 4-5-6'nın blokeri kod değil, dış hesap/sözleşme; başvuru süreleri uzun → Faz 1-3 inşa edilirken paralelde başlatılmalı. Faz 1-2-3 tamamen iç kaynaklarla, dışarıdan beklemeden yapılabilir.

---

## 3. Faz 1 — Detaylı Tasarım

### 3.1 Kullanıcı akışı (intake → üretim → yayın)

1. Sidebar → **Web Site Yöneticisi** → **"Yeni Site Oluştur"**.
2. **Otomatik tohumlama:** Sistem işletme profilinden çeker — firma adı, sektör, açıklama, ürün/hizmet, marka tonu, anahtar kelimeler, **logo**, renkler. Kaynak: `user_business_profiles` + `user_business_intelligence` (`ai_synthesis`).
3. **Site tipi sorusu:** AI sorar → **Karşılama sayfası (tek sayfa)** mı, **Çoklu sayfa** mı?
4. **Dil sorusu:** AI sorar → "Sadece Türkçe mi, hangi ek dilleri istersin?" → seçilen her dil ayrı içerik üretimi alır.
5. **Yönlendirilmiş onay:** AI bir **ilk öneri** sunar (site tipi + sayfa planı + çekilen bilgiler özeti + tema önerisi) ve sorar: *"Bunlarla başlıyorum — doğru mu, neyi değiştirelim?"*
6. **Serbest düzenleme girişi:** Kullanıcı ekranda doğal dille yazar ("logoyu şununla değiştir", "hizmet sitesi olsun", "şu hizmeti ekle", "renk daha koyu"). Bu, kör form **değildir**; sistem önerir, kullanıcı düzeltir.
7. **Finalize:** AI tüm girdileri birleştirir → çok-sayfalı siteyi üretir (içerik + bölüm seçimi + tema + görseller).
8. **Önizleme:** Masaüstü/mobil önizleme.
9. **Yayın:** Tek tuş → `firma.yoai.app` canlı (deploy yok, `status='published'`).
10. **Çoklu site:** Kullanıcı istediği kadar site oluşturur; her biri ayrı kayıt. Profil yalnız **başlangıç tohumu** — her sitede override edilebilir, sonradan revize edilebilir.

### 3.2 Mimari — veri-modeli + paylaşımlı çok-kiracılı renderer

**Temel ilke:** Üretilen site **gerçek dosya değil, veridir.** Veritabanında bir **sayfa modeli** (bölümler + içerik + tema tokenları, JSON). YoAi içindeki **tek bir site-renderer** bu modeli alt alan adına göre okuyup render eder.

```
Ziyaretçi → firma.yoai.app
   ↓ (Next.js middleware: subdomain → website_id çözümle)
   ↓
Site Renderer (dynamic route)
   ↓ websites + website_pages (yayınlanmış sürüm) oku
   ↓
Responsive bölüm bileşenleri (Hero, Hakkımızda, Hizmetler, İletişim…) içeriği render eder
```

**Avantajlar:**
- **Yayın anında** — deploy yok, sadece durum değişimi.
- **Düzenleme anında yansır** — model değişir, renderer aynısını render eder.
- **Çoklu site bedava ölçeklenir** — tek uygulama N siteyi sunar.
- **Rollback = eski model sürümüne dön** (`website_versions`).
- **Responsive garanti** — bölüm bileşenlerini **biz** yazarız (mobil öncelikli). AI yalnız içerik + bölüm seçimi + tema belirler; bozuk HTML üretemez.

**Reddedilen alternatif:** Her site için ayrı Vercel projesi deploy etmek — yayın yavaş, gereksiz karmaşık. Kod export (Promake Pro benzeri) gerekince ileride ayrı eklenir.

**Altyapı işi (tek seferlik):** Vercel'de bir **wildcard alt alan adı** (`*.yoai.app` veya ayrılacak `*.<site-domaini>`) + DNS + wildcard SSL tanımlanır. → **Açık karar:** Hangi wildcard domain? (bkz. §7)

### 3.3 Üretim hattı (generation pipeline)

```
[Profil tohumu + kullanıcı düzeltmeleri + site tipi + diller]
        ↓
1. PLANLAMA (Claude / claudeJson): sayfa listesi + her sayfanın bölüm planı + tema (renk/font tokenları, logodan türetilir)
        ↓
2. İÇERİK (Claude / claudeJson): her sayfa × her dil için bölüm içerikleri (başlık, metin, CTA) — TR imla kuralı uygulanır
        ↓
3. GÖRSEL: her görsel slotu için kaynak seç →
     - Stok (Freepik API / Pexels / Unsplash / Pixabay) anahtar kelimeyle ara, lisans-temiz indir
     - veya FAL.ai ile AI üretimi (imageForArticle.ts deseni)
     - storage'a kaydet, CDN URL'i modele yaz
        ↓
4. MONTAJ: website_pages JSON modeli oluştur (her dil için) + tema → website_versions'a sürüm yaz
        ↓
5. Durum: draft → (yayında) published
```

- **Uzun iş:** Üretim Inngest fonksiyonu olarak çalışır (`website/generate.user`), concurrency sınırlı, retries. Desen: mevcut `inngest/functions/` (örn. `brandIngestion.ts`).
- **AI motoru:** `lib/anthropic/text.ts` → `claudeJson` (yapılandırılmış çıktı). Yeni promptlar `lib/website/prompts/` altında.
- **TR imla:** Üretilen Türkçe içerik proje imla kuralına uyar (ç/ğ/ı/İ/ö/ş/ü eksiksiz; ASCII eşdeğer yasak).

### 3.4 Veri modeli (yeni tablolar)

Tümü `user_id` scope'lu (Supabase, omddq). Migration'lar omddq'da **uygulanmadan** deploy edilmez (bkz. proje hafızası).

- **`websites`** — `id, user_id, label, subdomain (unique), site_type ('landing'|'multipage'), default_locale, locales (text[]), category, status ('draft'|'published'|'unpublished'), theme (jsonb), published_version_id, created_at, updated_at`
- **`website_pages`** — `id, website_id, locale, slug, page_role ('home'|'about'|'services'|'contact'|…), sections (jsonb: sıralı bölüm + içerik), seo (jsonb: title/description), order_index`
- **`website_versions`** — `id, website_id, snapshot (jsonb: tüm sayfalar + tema), reason ('initial'|'revision'|'rollback'), credit_charged, created_at` → rollback ve audit için.
- **(Opsiyonel)** `website_assets` — üretilen/indirilen görsellerin storage referansları + lisans/kaynak (audit).

### 3.5 Kredi modeli

Kredi = **taban × sayfa çarpanı × dil çarpanı**; **her revizyon kredi yakar.**

- **İlk üretim:** `taban × sayfa_çarpanı(site_type, sayfa_sayısı) × dil_çarpanı(dil_sayısı)`.
  - Karşılama (tek sayfa): en düşük taban.
  - Çoklu sayfa: sayfa sayısına göre kademeli daha yüksek.
  - Her ek dil: dil başına ek oran (her dil ayrı içerik üretimi olduğu için).
- **Revizyon:** Her "şunu değiştir" talebi kredi düşer (kullanıcı sınırsız bedava düzenleme yapamaz). Kapsama göre kademelendirilebilir.
- **Yayın:** Ücretsiz (yalnız durum değişimi).
- **Barındırma:** Abonelik planında (hangi planda kaç site / kaç dil dahil).
- **Entegrasyon:** Sunucu-taraflı `chargeFeature` guard (mevcut desen, `lib/billing/`), `featureAccessMap.ts`'e yeni `featureKey`. Bariyer UI'ı `AccessRequiredModal type="credit"`.
- **Owner bypass:** `SUPER_ADMIN_EMAILS` kredi modalını görmez (mevcut kural).

> **Açık karar:** Taban/çarpan **rakamları** sonra netleştirilecek (bkz. §7).

### 3.6 Stok görsel + AI görsel kaynakları

**Karar (sahip delegasyonuyla):** Web ürününün canlı motoru = **Freepik resmi API + Pexels/Unsplash/Pixabay (ücretsiz, ticari serbest) + FAL.ai**.

- Hepsi **sunucu-taraflı, API anahtarıyla**, Vercel'de sorunsuz çalışır.
- **Lisans-temiz:** Müşteri sitelerine gömülecek görseller için API lisansları uygundur.
- **Envato Elements DIŞARIDA:** Sponsorlu'daki Envato entegrasyonu bir **Playwright tarayıcı scraper'ı** (API değil) — ekranlı tarayıcı + elle captcha + kalıcı profil ister; çok-kullanıcılı serverless web ürününde çalışmaz. **Asıl engel lisans:** Envato Elements lisansı, indirileni abonenin **kendi** ürününde kullanmak içindir; bir SaaS'ın müşteri sitelerine dağıtması lisansa aykırı. Bu yüzden müşteri ürününün kaynağı olamaz. (Envato girişi, sahibin **yerel** kreatif üretiminde değerli kalır — bu modül kapsamı dışında.)
- **Soyutlama:** `lib/website/stock/` altında ortak `StockProvider` arayüzü (`search`, `pickBest`); Freepik/Pexels/Unsplash implementasyonları. Sonuçlar normalize edilir (`{ url, thumb, width, height, license, source }`).

> **Açık karar:** Freepik API anahtarı/aboneliği gerekecek (bkz. §7).

### 3.7 i18n (iki katman)

İki ayrı dil katmanı vardır, karıştırılmaz:

1. **Modül UI dili (TR/EN):** Web Site Yöneticisi arayüzünün kendisi — `next-intl`, `locales/tr.json` + `locales/en.json`, **her ikisi de** güncellenir. Hardcoded string yasak.
2. **Üretilen sitenin dili:** Son kullanıcının seçtiği diller (TR + ek diller). Bu, üretilen sitenin içeriğidir; `website_pages.locale` ile çok-dilli tutulur. UI dilinden bağımsızdır.

### 3.8 Modül yapısı (dosya iskeleti)

```
app/web-site-yoneticisi/
  layout.tsx              # user guard + sidebar
  page.tsx                # site listesi + "Yeni Site Oluştur"
  [id]/page.tsx           # tek site: intake diyaloğu + önizleme + yayın

app/api/website/
  route.ts                # GET liste / POST yeni site (tohum)
  [id]/route.ts           # GET/PATCH/DELETE site
  [id]/generate/route.ts  # üretim/revizyon tetikle (Inngest event) — kredi guard
  [id]/publish/route.ts   # yayınla / yayından kaldır

app/sites/[...]            # PAYLAŞIMLI RENDERER (subdomain → site) — veya middleware tabanlı
  (renderer + responsive bölüm bileşenleri)

lib/website/
  types.ts                # Website, Page, Section, Theme şemaları
  store.ts                # CRUD + version + scope (user_id)
  prompts/                # planlama + içerik promptları (Claude)
  generate.ts             # üretim hattı orkestrasyonu
  stock/                  # StockProvider arayüzü + Freepik/Pexels/Unsplash
  render/                 # bölüm bileşenleri (responsive) + tema uygula

inngest/functions/
  websiteGenerate.ts      # website/generate.user (üretim + revizyon işi)

components/website/
  SiteList.tsx, IntakeDialog.tsx, Preview.tsx, PublishBar.tsx …

lib/nav.ts                # "Web Site Yöneticisi" NavItem
lib/routes.ts             # ROUTES + TR/EN slug eşlemesi
lib/billing/featureAccessMap.ts  # yeni featureKey
locales/tr.json, en.json  # tüm yeni metinler
```

### 3.9 Hata yönetimi

- **AI/stok hazır değil:** `isClaudeReady()` / API anahtarı yoksa graceful başarısızlık; kullanıcıya net mesaj (i18n), kredi **düşmez** (refund deseni — `access.refund()`).
- **Üretim başarısız:** Inngest retry; kalıcı hatada site `draft` kalır, kullanıcıya bilgi, kredi iade.
- **Subdomain çakışması:** `subdomain` unique; çakışmada otomatik sonek (`firma-2`).
- **Yayın guard:** Sadece sahibi yayınlar; RLS + route guard.
- **Sahte veri yok:** Hiçbir alan mock/simülasyon değil — tüm görseller gerçek (stok/AI), tüm içerik gerçek üretim (proje kuralı).

### 3.10 Test stratejisi

- **Birim:** sayfa modeli şeması, kredi hesaplama (sayfa × dil × revizyon), subdomain çözümleme, stok provider normalize.
- **Entegrasyon:** intake → üretim → model persist → render; revizyon → yeni version + kredi düşümü; rollback → eski version.
- **Renderer:** responsive bölüm bileşenleri (mobil/masaüstü) görsel snapshot.
- **i18n:** TR/EN UI anahtarları eksiksiz; üretilen site çok-dilli model doğru.
- **Gerçek doğrulama:** En az bir gerçek profil ile uçtan uca site üretip `firma.yoai.app` önizleme/yayın testi.

---

## 4. Faz 1 DIŞI (kapsam neti)

Şunlar Faz 1'de **yok**, sonraki fazlarda: sohbetle sürekli düzenleme (Faz 2 — Faz 1'de düzenleme "yeniden üret/revize" odaklı, tam konuşma motoru değil) · kendi domainini bağlama (Faz 3) · domain satın alma (Faz 4) · iş e-postası (Faz 5) · ödeme/e-ticaret checkout (Faz 6) · sohbetle işletme yönetimi (Faz 7) · kod export.

---

## 5. Mevcut altyapıdan yeniden kullanılan parçalar

- **Marka verisi:** `user_business_profiles`, `user_business_intelligence` (`ai_synthesis`), `lib/yoai/businessIntelligenceBuilder.ts`, `lib/yoai/ai/brandSynthesis.ts`.
- **AI metin:** `lib/anthropic/text.ts` (`claudeJson`, `claudeText`).
- **AI görsel:** `lib/seo/imageForArticle.ts` (FAL.ai deseni).
- **Şifreleme:** `lib/seo/crypto.ts` (AES-256-GCM) — gerekirse API anahtarları için.
- **Billing:** `lib/billing/featureAccessMap.ts`, `chargeFeature`, `components/billing/AccessRequiredModal.tsx`.
- **Inngest:** `inngest/client.ts`, `inngest/functions/` deseni.
- **Modül/nav:** `lib/nav.ts`, `lib/routes.ts`.
- **i18n:** `next-intl`, `locales/tr.json` + `locales/en.json`.

---

## 6. Riskler

- **Wildcard subdomain + SSL** doğru kurulmazsa yayın çalışmaz → erken doğrula.
- **omddq migration:** Yeni tablolar omddq'da uygulanmadan deploy = çalışmaz (proje hafızası: migration gaps).
- **Üretim kalitesi:** AI çıktısının "Promake kalitesi"nde olması, bölüm bileşeni kütüphanesinin ve promptların kalitesine bağlı → tasarım titizliği şart.
- **Kredi dengesi:** Çarpanlar yanlış kalibre edilirse ya pahalı (kullanıcı kaçar) ya ucuz (maliyet zararı) → gerçek üretim maliyetine göre ölçülmeli.

---

## 7. Açık kararlar (implementasyon öncesi netleştirilecek)

1. **Wildcard domain:** Yayın için hangi alan adı? `*.yoai.app` mi, ayrı bir `*.<marka>.com` mu?
2. **Kredi rakamları:** Taban + sayfa çarpanı + dil çarpanı + revizyon maliyeti — somut değerler (gerçek üretim maliyetine göre).
3. **Freepik API:** Anahtar/abonelik temin edilecek (yoksa Faz 1 ücretsiz API'lerle başlar, Freepik sonra eklenir).
4. **Storage:** Üretilen/indirilen görseller nerede tutulacak (Supabase storage / S3 / Vercel Blob)?
5. **Faz 1 düzenleme derinliği:** "Revize et" ne kadar serbest — bölüm bazlı yeniden üretim mi, yoksa hafif sohbet mi (tam sohbet Faz 2)?
