# Web Site Yöneticisi — Faz A: "Gerçek çalışan site"

**Tarih:** 2026-06-16
**Durum:** Onaylandı (kullanıcı). Sıra: Faz A → B → C. İletişim formu → site sahibinin e-postası.
**İlgili:** `project_website_builder`, `feedback_no_fake_data`, 2026-06-16 wizard/review turu

## Problem (kullanıcı testi)
1. Önizlemede menü linkleri 404 / yanlış sayfa. 2. Stok görsellerde Çince yazı. 3. İçerik zayıf. 4. Footer zayıf. 5. Responsive sorunlu + hamburger menü yok. 6. 404 sayfalar. 7. İletişim sayfasında form/iletişim alanı yok — standart web öğeleri eksik.

## Kök nedenler
- **404/yanlış link:** Üretilen menü `/s/<altalan>/…` (yayın adresi) kullanıyor; `/s/` sayfaları yalnız `getPublishedSiteBySubdomain` ile YAYINLANMIŞ siteyi gösterir → taslak önizlemede `notFound()` → 404.
- **Hamburger yok:** `HeaderSection` mobilde `hidden md:flex` → menü kaybolur, açma butonu yok. Render saf-sunum (JS yok).
- **İletişim formu yok:** `ContactSection` sadece metin.
- **Çince görsel:** Pexels stok fotoğrafları içinde metinli kareler döndürebiliyor.

## Tasarım (A1–A6)

### A1 — Önizleme menü/404 fix
- `generate.ts` + `deterministic.ts`: nav öğelerine `slug` alanı ekle → `{ label, href, slug }`. href = yayın (`/s/<altalan>/<slug>`), slug = sayfa anahtarı.
- `SiteRenderer`'a `previewId?: string` prop. `website-preview/[id]` bunu `id` ile geçer; `/s/[subdomain]` geçmez.
- `renderSection` → header/footer/hero/cta'ya `previewId` taşı. previewId varsa nav/cta href = `/website-preview/<previewId>?slug=<slug>` (anchor `#...` aynen kalır); yoksa href (yayın).

### A2 — Mobil hamburger menü
- Yeni client island `components/website/render/MobileNav.tsx` (`'use client'`): hamburger butonu + açılır menü (useState). Header'a gömülür; masaüstü `hidden`, mobil `flex`.
- nav (preview-aware href'ler) prop olarak geçer.

### A3 — Gerçek iletişim sayfası
- `ContactSection`: çalışan form (ad, e-posta, telefon, mesaj) — client island `components/website/render/ContactForm.tsx`.
- `POST /api/website/[id]/contact` (public; honeypot alanı + basit rate-limit; auth yok). Site sahibi e-postasına gönderir (`lib/email` / `ownerNotifier`). Sahte değil.
- Harita: `locations[0]` varsa anahtarsız Google Maps embed (`https://maps.google.com/maps?q=<adres>&output=embed`).
- İletişim bilgileri: profilden gelen lokasyon + sosyal linkler (uydurma yok; profilde yoksa gösterme).

### A4 — Zengin footer
- `FooterSection`: marka + tagline, sayfalar, iletişim (lokasyon + sosyal), opsiyonel alt-link grubu, telif. AI prompt'unda footer içeriği (kısa kurumsal cümle + hizmet alt-linkleri) istenir.

### A5 — Çince görsel filtresi
- `stock`: Pexels `locale` param + sorguları nötr/Batı bağlama çekme; metin-yoğun olası kareleri elemek için sorgu iyileştirme. (Mükemmel değil — stok görsel içeriği kontrol edilemez; belirgin azaltma hedefi.)

### A6 — İçerik kalitesi
- `generate.ts` prompt: her bölüm dolu, gerçek web sitesi tonunda, daha güçlü başlık/açıklama; footer + iletişim içeriği; daha fazla servis/özellik maddesi.

## Üretilen site etiketleri (i18n)
Form/iletişim/footer etiketleri ÜRETİLEN SİTE dilinde — `deterministic.ts` `SiteLabels` sözlüğüne eklenir (YoAi UI i18n değil). TR + EN doldurulur; eksik dilde TR fallback.

## Risk / kapsam
- Render'a 2 client island (form + mobil menü) eklenir; gerisi mevcut yapıyı korur. Migration yok.
- Form endpoint public → spam koruması (honeypot + rate-limit) zorunlu; SSRF yok (dış istek yok).
- Meta/Google/publish/domain/version çekirdeği + boş-durum animasyonu korunur.
- Doğrulama: gerçek render (Playwright) — önizleme nav, mobil menü, form, footer; sonra adversarial review.
