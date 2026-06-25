# Web Site Yöneticisi — Kod-Üretim Motoru (Tasarım Dokümanı)

- **Tarih:** 2026-06-17
- **Durum:** Onaylandı (sahip onayı 2026-06-17) → writing-plans
- **Kapsam:** DijiMagic "Web Site Yöneticisi" modülünün site üretim motorunun yeniden tasarımı
- **Çalışma alanı:** izole worktree `worktree-web-site-yoneticisi-codegen` (main tabanlı)

> **Tek cümle:** AI'nın markaya özgü, Lovable/Bolt seviyesinde göz alıcı pazarlama/kurumsal siteleri **serbest HTML/CSS/JS** olarak ürettiği bir kod-üretim motoru kuruyoruz; ön şart, üretilen siteyi dashboard origin'inden ve provider zincirinden **izole etmek + sıkı CSP + deny-by-default sanitize**. Omurga = güvenlik/izolasyon, kalite beyni = DesignSystem + çok-aşamalı pipeline, iskelet = mevcut yayın/veri altyapısını koru.

---

## 0. Kilitlenmiş Kararlar (sahip onayı, 2026-06-17)

1. **Çıktı formatı = Serbest HTML/CSS/JS.** AI her sayfayı sıfırdan, özgür HTML + (derlenmiş) Tailwind + güvenli hareket katmanı ile yazar. Sabit bölüm şeması YOK.
2. **Düzenleme = Chat-native.** Doğal komut → AI kodu **blok-bazlı** güvenilir yamalar → anında önizleme. Tam-dosya yeniden-yazım yasak.
3. **Geçiş = Şablon motorunu tamamen değiştir.** Yeni kod-üretim motoru tek üretici olur; ancak **yayınlanmış eski şablon-format siteler dual-read ile bozulmadan yaşamaya devam eder.**
4. **Yayın adresi = Alt adres (Seçenek A).** Siteler `*.dijimagic.com` altında kalır (mevcut URL'ler korunur). İzolasyon kod tarafında sağlanır: provider'sız `app/(sites)/` layout + CSP. Ayrı apex (`*.sites.dijimagic.com`) **kapsam dışı / ileride opsiyonel** — bu spec'te uygulanmaz.
5. **Kalite önceliği = dördü birden:** layout/kompozisyon çeşitliliği, görsel/imaj kalitesi, hareket/mikro-etkileşim, tipografi/içerik hiyerarşisi.

---

## 1. Hedef & Kapsam (YAGNI)

**YAPAR:**
- Kullanıcının markasına özgü, görsel kaliteli pazarlama/kurumsal siteleri sıfırdan serbest HTML ile üretir.
- Çok-sayfa + çift dil (site içeriği kullanıcının dilinde).
- Chat-native, blok-bazlı güvenilir düzenleme.
- Mevcut yayın / custom-domain / rollback / kredi yolunu koruyarak yayınlar.

**YAPMAZ (sınır):**
- Genel amaçlı web-app / SaaS / uygulama üretmez (yalnız pazarlama/kurumsal site).
- AI **keyfi `<script>` yazamaz** (yalnız declarative `data-dijimagic-*` + sürümlü runtime).
- E-ticaret / ödeme / kullanıcı-veri formu üretmez (phishing yüzeyi).
- Eski siteleri toplu zorla-migrate etmez.
- Meta/Google entegrasyonuna (`lib/meta/*`, `lib/google/*`) **dokunmaz.**

---

## 2. Mimari Genel Bakış

> **Not (snapshot uyarısı):** Aşağıdaki dosya yolları bir keşif anlık görüntüsünden (2026-06-17) gelmektedir. Implementasyon öncesi her dosya yeniden doğrulanacaktır.

**SİL / DEVRE DIŞI (kod fiziksel silinmez, çağrılmaz):**
- `lib/website/ai/generate.ts` — JSON-şema-doldurma yolu artık ana üretici değil.
- `lib/website/templates/deterministic.ts` — yalnız fallback olarak kalır.
- `lib/website/render/sections.tsx` + `theme.ts` + `SiteRenderer` — **SİLİNMEZ**; eski `format='sections'` siteler için canlı kalır (dual-read).

**EKLE:**
- `app/(sites)/` route group — **minimal layout** (NextIntl/Credit/Subscription/Analytics provider'ı YOK, cookie okumaz). Mevcut `app/s/[subdomain]` ve `[slug]` sayfaları bu gruba taşınır. Root layout provider sızıntısını çözer.
- `lib/website/codegen/`:
  - `buildCodegenContext.ts` — girdi toplama + prompt-injection karantinası
  - `designSystem.ts` — DesignSystem sözleşmesi (Aşama 1)
  - `sanitizeHtml.ts` — deny-by-default sanitize
  - `renderGate.ts` — parse + kritik-bölüm + class-allowlist kapısı
  - `assembleDocument.ts` — `<head>` montajı + CSP nonce
  - `tailwindCompile.ts` — server-side JIT Tailwind derleme
  - `patchPlanner.ts` — chat-edit blok planlayıcı
- `public/dijimagic-site-runtime.js` — sürümlü, parametrize edilebilir hareket runtime'ı.
- `lib/website/render/HtmlSiteRenderer.tsx` — `format='html'` sayfaları sanitize + CSP'li basar.

**Veri akışı (üretim):** marka girdisi (karantinalı) → DesignSystem → layout-arketip planı → tam HTML (Opus, Inngest/Batch) → görsel çözümleme + sanitize → renderGate → head montajı → `website_versions` snapshot → yayın.

**Servis akışı:** `getPublishedSiteBySubdomain` → `format` kontrolü → `'html'` ise `HtmlSiteRenderer` + CSP, `'sections'` ise mevcut `SiteRenderer`.

---

## 3. Üretim Hattı (Pipeline)

| # | Aşama | Amaç | Model / Nerede |
|---|-------|------|----------------|
| **0** | Girdi + prompt-injection karantinası | Profil/intelligence + `referenceScanner` (SSRF-korumalı) + kullanıcı talimatı toplanır. **Site/marka-özgü kaynak öncelikli; global profile yalnız SON ÇARE** (SEO `getProfileForScope` dersinin web karşılığı). Dış metin `<untrusted_source>…</untrusted_source>` olarak **veri** konumlanır. | Kod; `buildCodegenContext.ts` |
| **1** | DesignSystem sözleşmesi | Markadan **sayısal** tasarım sistemi: palet, font çifti, spacing/radius/gölge ölçekleri, gradyan/noise reçeteleri, spring-easing hareket dili. Çeşitlilik **üretimin başında token olarak** doğar. JSON çıktı. | Opus 4.8, effort:high |
| **2** | Layout-arketip planı | Sayfa başına bölüm sırası + her bölüme **kompozisyon arketipi**. Ardışık bölüm aynı arketipi tekrarlayamaz. Sabit 10-bölüm şeması YOK. | Opus 4.8; DesignSystem prompt-cache prefix |
| **3** | Tam HTML üretimi | Semantik HTML + **yalnız DesignSystem-türevli Tailwind class'ları** (allowlist). Görseller `{{IMG:query}}`. Hareket `data-dijimagic-reveal`. SEO: tek `<h1>`, landmark. **Streaming zorunlu.** | Opus 4.8; **Batch API** sayfa başına |
| **4** | Görsel çözümleme + sanitize | `{{IMG:query}}` → `lib/website/stock` veya Magnific (Inngest step + timeout + stock fallback; polling YASAK). Sonra **deny-by-default sanitize**. | Kod + Magnific; Inngest |
| **5** | renderGate (zorunlu kapı) | parse-hatası yok + kritik bölüm var + class-allowlist + boyut. Geçmezse 1 self-repair → fallback + kredi iade. **Bozuk/boş site ASLA yayınlanmaz.** | Kod; Inngest |

---

## 4. Çıktı & Güvenlik Modeli

**HTML yapısı:** AI yalnız `<body>` gövdesi üretir; `<head>` (meta/SEO, derlenmiş Tailwind CSS, font preconnect, nonce, lang, charset/viewport) **deterministik biz monteleriz** (`assembleDocument.ts`). Çok-sayfa: her sayfa ayrı HTML (`website_pages` locale+slug korunur).

**Tailwind — CDN DEĞİL, derlenmiş:** `cdn.tailwindcss.com` production'da kullanılmaz (LCP/CLS/FOUC + CSP çelişkisi). Üretilen class'lar DesignSystem token'larından türetilmiş **safelist/allowlist**'e bağlanır; `tailwindCompile.ts` server-side JIT ile per-site CSS üretir, kritik-CSS gömülür.

**JS politikası:** AI **keyfi `<script>` yazamaz.** Etkileşim yalnız sürümlü `dijimagic-site-runtime.js`'ten; AI `data-dijimagic-*` declarative attribute'larla işaretler. Runtime nonce'lı tek `<script src>`. Parametrize (süre/easing/threshold `data-attribute`'tan).

**Sandbox — üç kademe:**
- **(A) İzolasyon:** servis `app/(sites)/` altında **provider'sız / cookie-okumayan** minimal layout. URL'ler korunur (`*.dijimagic.com`).
- **(B) CSP:** `default-src 'none'; script-src 'self' 'nonce-…'; style-src 'self'; img-src <stok+logo> data:; font-src https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'`. Yalnız `(sites)` segmentine. **`unsafe-inline`/`eval` ASLA.**
- **(C) Sanitize:** server-only deny-by-default allowlist. `<script src dış>`, `on*`, `javascript:`/`data:`-script, `<iframe>/<object>/<embed>`, `svg use`/`foreignObject`, CSS `url(javascript:)` strip. **Persist/publish kapısı.**

**Prompt-injection:** Aşama 0 karantinası + `connect-src 'self'`. **Phishing:** üretim prompt'unda parola/ödeme formu reddi; renderGate'te şüpheli form blok; footer kaynak işareti; takedown `status='suspended'`.

---

## 5. SEO & Performans

- **SSR/statik:** published HTML için `force-dynamic` yerine **ISR/CDN `s-maxage`** (`published_version_id` immutable). **`WEBSITE_ISR` default-OFF flag** arkasında kademeli.
- **Crawlability:** SSR ham HTML; head deterministik → meta/title/desc/canonical/`lang`/`og:` garanti. `robots.txt` + `sitemap.xml` `(sites)` altında.
- **Core Web Vitals:** gömülü kritik-CSS → düşük LCP; tek küçük script → düşük TBT; görsel `width/height` + `loading="lazy"`; font `preconnect` + `display=swap`.

---

## 6. Önizleme & Chat-native Düzenleme

**Önizleme:** mevcut `app/website-preview/[id]` iframe korunur — `HtmlSiteRenderer` çıktıyı `srcdoc` + `sandbox="allow-scripts allow-forms"` (**`allow-same-origin` ASLA**) ile basar. Taslak linkler `data-dijimagic-href` ile işaretlenip sunucuda çevrilir.

**Chat-edit = blok-bazlı targeted-rewrite** (tam-dosya yeniden-yazım YASAK):
1. Her bölüm kararlı `data-dijimagic-block` + `data-dijimagic-id`; ID'ler snapshot `blockMap`'inde.
2. **Planner** (Sonnet) komutu atomik op'lara çevirir: `{op, targetId, after?}`; deterministik doğrulama.
3. AI'a **yalnız hedef blok** + komut verilir → yeni blok HTML'i döner.
4. Birleştirme sunucuda; dokunulmayan bloklar byte-aynı.
5. Yine sanitize + renderGate. Geçmezse patch UYGULANMAZ + kredi iade.

**Log + rollback:** her patch öncesi otomatik snapshot; "Geri Al" → `rollbackToVersion`. İlk 3 revizyon ücretsiz / sonra `WEBSITE_REVISION_COST`.

---

## 7. Veri Modeli Değişiklikleri

- `website_pages`: `sections JSONB` korunur + **YENİ** `html TEXT NULL` + `format TEXT NOT NULL DEFAULT 'sections'`.
- HTML `website_pages.html` (TEXT, <200KB varsayımı). Ayrı obje deposu gerekmez (YAGNI; bkz. Riskler).
- `website_versions.snapshot` (JSONB) genişler: `pages[].html` + `format` + `designSystem` + `blockMap`. Migration gerekmez; reader hem eski hem yeniyi okur.
- `theme JSONB`: eski alanlar silinmez; yeni `theme.compiledCssVersion`.
- `createVersion`/`rollbackToVersion` imzaları korunur; `published_version_id` immutable.

---

## 8. Yayın & Hosting

Mevcut yayın mekaniği korunur: `publishWebsite` → `status='published'` + `published_version_id`; servis `getPublishedSiteBySubdomain`. **Tek değişiklik:** servis `format`'a bakar → `'html'`→`HtmlSiteRenderer`, `'sections'`→`SiteRenderer`. Custom domain (`vercelDomain.ts` + `edgeConfig.ts` + middleware) korunur (rewrite hedefi `(sites)`). `force-dynamic` → ISR/CDN flag.

---

## 9. AI Model & Kredi Modeli

- **Model:** ilk üretim/DesignSystem/layout = **Opus 4.8** (`claude-opus-4-8`); revizyon/patch/planner/çeviri = **Sonnet 4.6** (`claude-sonnet-4-6`). Env: `ANTHROPIC_MODEL_WEBSITE_INITIAL` / `_REVISION`. Adaptive thinking; `budget_tokens` YOK.
- **Kaldıraçlar:** çok-dil = ana dil üret + diğer diller text-node çevirisi; prompt caching; Batch API %50; blok-patch küçük context.
- **Fiyat (ref):** Opus 4.8 $5/$25; Sonnet 4.6 $3/$15. Tahmini ham maliyet: tek sayfa ~$0.5–1.1; 5 sayfa ~$1.5–2.5 (Batch); düzenleme ~$0.05–0.15.
- **Kredi:** `computeGenerationCost` yeniden kalibre; `WEBSITE_REVISION_COST` + ilk 3 ücretsiz korunur; owner bypass + `AccessRequiredModal type="credit"`; renderGate başarısız → iade.

---

## 10. Migrasyon / Replace (DUAL-READ — sıfır risk)

1. `website_pages.format` eklenir; mevcut TÜM satırlar `'sections'`.
2. Servis tek noktadan `format`'a göre seçer; eski renderer SİLİNMEZ.
3. Eski site düzenlenince → `format='html'` yazılır → otomatik migrate. Toplu zorla-migrasyon YOK.
4. **Bayrak `WEBSITE_CODEGEN_V2`**; render bayrağa değil `format`'a bakar.
5. `published_version_id` değişmedikçe canlı çıktı değişmez.

---

## 11. Riskler & Açık Noktalar

- DesignSystem allowlist genişliği kalibre edilmeli (dar→yaratıcılık boğulur, geniş→bundle şişer).
- HTML boyutu <200KB doğrulanmalı; büyük inline SVG → ileride Storage.
- renderGate self-repair: 1 deneme + deterministik fallback zorunlu.
- Magnific/Freepik latency → Inngest step + timeout + stock fallback.
- Cross-business sızıntı → Aşama 0 site-özgü-öncelik guard'ı (`getProfileForScope` deseni).
- **Paralel oturum:** ortak dosyalar (`locales/*.json`, sol menü, migration sıra no, `package.json`) **additive** işlenir; iş izole worktree'de.
- **Reklam izolasyonu:** `lib/meta/*`/`lib/google/*`'a dokunulmaz; öncesi/sonrası akış doğrulanır.

---

## 12. Fazlama

- **Faz 0 — İzolasyon altyapısı (ön şart):** `app/(sites)/` route group + minimal layout, CSP, `sanitizeHtml.ts`, `tailwindCompile.ts`, `dijimagic-site-runtime.js`.
- **Faz 1 — İlk çalışan sürüm:** Opus tek-atış HTML + DesignSystem + renderGate, **tek sayfa landing**, `format='html'` persist, `HtmlSiteRenderer` + önizleme. **Çalışan minimum.**
- **Faz 2 — Çok-sayfa + dil:** Inngest fan-out + ana-dil-üret+çeviri + Batch/caching + layout-arketip planı.
- **Faz 3 — Chat-native düzenleme:** blok-bazlı targeted-rewrite + planner + blockMap; opsiyonel görsel cilası; ISR/CDN flag.
