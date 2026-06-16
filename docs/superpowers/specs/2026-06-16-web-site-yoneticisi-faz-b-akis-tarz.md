# Web Site Yöneticisi — Faz B: akış sadeleştirme + tarz seçimi

**Tarih:** 2026-06-16
**Durum:** Onaylandı (kullanıcı: "devam et" + 6 tarz seti). Sıra: A bitti → **B** → C.
**İlgili:** `project_website_builder`, Faz A spec

## İstek
- **B1:** Detay sayfasında "Sitenizi tarif edin" formu (tarif/logo/AI/Hızlı butonları) TEKRAR soruluyor — kaldır. Wizard'dan üretim başlar → detay sayfası doğrudan üretim durumu → bitince önizleme + Onayla/Reddet/Düzenle/Yayınla.
- **B2:** Wizard'a görsel "Tarz" seçimi (Modern/Kurumsal/Keyifli/Lüks/Minimal/Canlı); AI tasarım tonuna yansıtır.

## Tasarım

### B2 — Tarz seçimi
- `ThemeTokens.style?: string` (modern|corporate|playful|luxury|minimal|vibrant) — theme jsonb, **migration yok**.
- `theme.ts` `STYLE_PRESETS`: tarz → `{ label, directive, fontHint }`. `directive` = AI prompt'a tasarım tonu yönergesi; `fontHint` = wizard'da tarz seçilince font ailesi varsayılanı (kullanıcı değiştirebilir).
- `CreateSiteWizard`: 6 görsel tarz kartı (seçilebilir); seçilince font varsayılanı `fontHint`'e güncellenir (kullanıcı yine değiştirebilir). `theme.style` gönderilir.
- `generate.ts` `GenerateInput.style` + prompt'a `TASARIM TARZI: <directive>` direktifi. `generate`/`build` route `site.theme.style`'ı üretime geçirir.
- Renk/font İNCE kontrolü Faz C'ye bırakılır; Faz B tarz = içerik tonu + font varsayılanı.

### B1 — Detay sayfası akışı
- `[id]/page.tsx` intake bölümü (logo kutusu + tarif textarea + Sesle yaz + AI/Hızlı butonları) KALDIRILIR.
- Yeni üst durum: pages yoksa + autostart üretiyorsa → premium "AI siteni hazırlıyor" durumu; üretim bitince → önizleme + aksiyon barı.
- Aksiyon barı (review entegre): **Detaylı Önizle** (→ `/onizleme`) · **Onayla/Yayınla** · **Reddet** · **Düzenle** (Reddet/Düzenle panelleri `/onizleme`'deki mantıkla; isteğe göre detayda da inline veya `/onizleme`'ye yönlendir).
- Sürüm geçmişi + DomainPanel altta korunur (katlanır).
- Logo değiştirme: küçük bir ayar olarak korunur (intake formundan ayrı, kompakt) — wizard'da alındı, sonradan değişebilsin.

## Risk / kapsam
- Migration yok (theme jsonb). Meta/Google/publish/domain/version çekirdeği + boş-durum animasyonu + Faz A (form/footer/hamburger) korunur.
- i18n: yeni UI metni (tarz etiketleri, durum metinleri) tr.json + en.json.
- Doğrulama: gerçek render (wizard tarz kartları + detay akışı) + adversarial review.
