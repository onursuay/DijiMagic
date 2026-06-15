# Web Site Yöneticisi — Üretilen Site Tasarım Revizyonu (Kalite Yükseltme)

**Tarih:** 2026-06-15
**Durum:** Onaylandı (kapsam: tam redesign, tek seferde)
**İlgili:** `feedback_website_builder_design_quality`, `project_website_builder`

## Problem

Üretilen müşteri siteleri profesyonel bir tasarım gibi durmuyor. Kullanıcı geri bildirimi:
"web sitesi tasarlanmıyor, saçma sapan yazılar, çok küçük, görsel ile yazılar arası mesafe çok dar,
hiç modern ve yaratıcı değil, görsel eklenmiyor — her açıdan çöp."

### Kök nedenler (kod analizi)
1. **Görsel fakirliği:** `templates/deterministic.ts` (Hızlı Oluştur) **sıfır görsel** koyar
   (`heroContent`/`aboutContent`'te `imageUrl` yok, servis/özellik açıklamaları boş string).
   `ai/generate.ts` (AI yolu) yalnız **2 görsel** çözer (hero + about). Servis/özellik kartlarında
   görsel yerine boş renkli kare (`sections.tsx` ServicesSection `h-11 w-11` placeholder).
2. **Küçük tipografi:** hero `2.25–3.4rem` (~36–54px); referanslar **84–96px**. Gövde 15–17px;
   referanslar **18–20px**.
3. **Tek tip "şablon" bölümler:** sadece hero/about/services/features/contact/footer; modern
   bölüm tipi (full-bleed hero, görsel galeri, koyu atmosfer, split panel, istatistik, yorum, CTA) yok.
4. **Sönük renk:** marka rengi yoksa hep `#0f172a` slate + `#0f766e` teal'e düşer.
5. Önizleme iframe'i içeriği `scale` ile küçültür → "çok küçük" hissi katlanır.

## Referans kalite dili (kullanıcının verdiği 3 site — gerçek görsel + branding analizi)

| Site | Font | Aksan | H1 | Gövde | İmza öğeler |
|------|------|-------|----|----|-------------|
| Elysium Garden Hotel | Montserrat | altın `#B88A30` / petrol `#133047` | 84px | 18px | full-bleed hero+overlay, görselli oda kartları, koyu atmosfer bölümü, görsel grid, testimonial, blog, zengin footer |
| Anamour Natural | Plus Jakarta Sans | fuşya `#B70049` | 96px | 20px | yan zengin ürün kolajı, görselli yuvarlak kartlar, fuşya split panel+fotoğraf, pill buton + renkli gölge, ikonlu adımlar |
| Antso (booking app) | Inter | lacivert `#1A2E45` | 60px | — | temiz, zengin çok-kolonlu koyu footer |

**Ortak kalite dili:**
- Full-bleed / büyük görselli hero (fotoğraf + koyu overlay + dev başlık + çift CTA).
- Her kartta gerçek fotoğraf, 12–24px yuvarlak köşe, yumuşak/renkli gölge, hover-lift.
- Bölüm çeşitliliği + ritim (açık ↔ koyu kontrast bölümler dönüşümlü).
- Belirgin marka aksanı + tematik açık zemin.
- Büyük tipografi, ferah ve tutarlı boşluk (8px taban).
- Pill butonlar.

## Hedef tasarım

### 1. Render motoru (`lib/website/render/sections.tsx`) — yeniden yazım
Mevcut tipler zenginleştirilir + yeni tipler eklenir. **Geriye uyumluluk:** eski DB sitelerinde
`imageUrl` yoksa zarif gradyan+doku fallback; bilinmeyen tip sessiz atlanır (mevcut davranış korunur).

Bölüm tipleri (taxonomy):
- `hero` → **full-bleed**: arka plan fotoğrafı + okunabilirlik için koyu gradyan overlay + dev
  başlık (`clamp(2.5rem, 6vw, 5.5rem)`) + alt başlık + birincil (pill) + ikincil CTA.
  Görsel yoksa: katmanlı marka gradyanı + ince grain + büyük tipografi (boş durmaz).
- `stats` (yeni) → 3–4 öne çıkan rakam/etiket şeridi.
- `services` → **görselli kartlar** (üstte fotoğraf, başlık, açıklama); boş kare kaldırılır.
- `features` → ikon/numara + başlık + açıklama (mevcut, tipografi/boşluk büyütülür).
- `split` (yeni) → yarı fotoğraf + yarı renkli panel (metin + madde + CTA).
- `gallery` (yeni) → 4–6 görselli grid (asimetrik/masonry hissi).
- `about` → görsel + metin, daha büyük tipografi.
- `testimonial` (yeni) → müşteri yorumları (koyu veya açık kart grid).
- `cta` (yeni) → koyu kontrast tam genişlik çağrı bölümü + aksan buton.
- `contact` → mevcut koyu bölüm, tipografi büyütülür.
- `footer` → mevcut zengin çok-kolon (korunur, ölçek ayarı).

Ortak ölçek: container `max-w-6xl`, bölüm dikey ritmi büyütülür, başlık ölçeği büyür,
boşluk 8px tabana oturur.

### 2. Tema (`lib/website/render/theme.ts`)
- Marka rengi (logo/profil) varsa ondan; yoksa **sektöre göre** canlı bir palet seç
  (otel→petrol+altın, doğal/gıda→yeşil/fuşya, kurumsal→lacivert, vb.) — sönük default'tan çık.
- CSS değişkenleri: `--site-ink`, `--site-accent`, ek olarak `--site-surface` (tematik açık zemin),
  `--site-on-accent`. Mevcut değişkenler korunur (geriye uyumlu).

### 3. Üretim motorları
- **AI (`ai/generate.ts`):** içerik şeması genişler — hero/about + her servis kartı + galeri +
  split + (varsa) stats/testimonial için `imageQuery`. Görseller **paralel** çözülür (6–10 adet,
  Pexels). Bölüm seti sektöre göre seçilir. Boş açıklama bırakılmaz.
- **Deterministik (`templates/deterministic.ts`):** görsel ekler (hero + servis + galeri + about
  stoktan); açıklama boşsa nötr ama dolu metin. Hızlı Oluştur da görselli site üretir.

### 4. Tipler (`lib/website/types.ts`)
`PageRole`/`SectionBlock` zaten esnek (string type, jsonb). Yeni tipler için **migration gerekmez**.

## Doğrulama (zorunlu — tasarım kalite kuralı)
1. Gerçek bir test sitesi üret (AI + Hızlı Oluştur ikisi de).
2. Yayınla → `/s/<subdomain>` herkese açık URL → **firecrawl ile fullPage ekran görüntüsü**.
3. Referanslarla yan yana karşılaştır; somut farkları (tipografi px, boşluk, görsel varlığı,
   bölüm ritmi) düzelt. **En az 2 tur**, görünür fark kalmayana dek.
4. Masaüstü + mobil; TR + EN.

## Risk / kapsam
- **Prod risk:** Bu modül flag'siz canlı. Değişiklik **render + üretim katmanı**; DB şeması
  değişmez (sections jsonb). Eski siteler crash etmez (fallback), yeniden üretilince yeni tasarımı alır.
- **Dokunulmuyor:** Meta/Google entegrasyonu, billing/kredi guard, publish/domain/version akışları,
  SSRF/XSS güvenlik katmanı (`safeHref`/`safeImg`/`referenceScanner`).
- **i18n:** Yeni UI metni (modül tarafı) çıkarsa `tr.json` + `en.json` ikisi birden. Üretilen
  site içeriği zaten site diline göre AI/etiket sözlüğünden gelir.
