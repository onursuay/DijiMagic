# Web Site Yöneticisi — Faz C1: alan bazlı tasarım (3 alan, çekirdek)

**Tarih:** 2026-06-16
**Durum:** Onaylandı (3 alan Üst/Gövde/Alt; önce çekirdek font+metin rengi+arka plan rengi+canlı önizleme; C2 = boyut ölçeği+opaklık+vurgu).
**İlgili:** `project_website_builder`, Faz A/B

## İstek (kullanıcının 7. maddesi)
Header/Footer dahil alanların yazı ailesi, boyutu, metin + arka plan rengi, opaklığı kullanıcı tarafından ayarlanabilsin; canlı/dinamik gösterilsin; bilmeyen için profesyonel varsayılan uygulansın.

## Mimari (matematiğe uygun token modeli)
- **Global tema = varsayılan** (zaten var: `--site-ink/accent/surface/font-*`). Kullanıcı dokunmazsa bu uygulanır.
- **3 alan** global'i ezer (override; yalnız set edilen değer ezilir): **header · body · footer**.
- `ThemeTokens.areaStyles?: { header?: AreaStyle; body?: AreaStyle; footer?: AreaStyle }` — theme jsonb, **migration yok**.
- **C1 AreaStyle:** `{ fontPairing?: string; textColor?: string; bgColor?: string }`. (C2: `fontScale`, `opacity`, `accentColor` eklenecek.)

## Render
- `SiteRenderer`: bölümler 3 gruba ayrılır (header / body / footer; sıra zaten header→body→footer bitişik). Her grup bir **wrapper div**'e sarılır; wrapper inline CSS değişkenleri ile o alanın override'ını yazar (`areaCssVars(area)`):
  - `--site-ink` ← textColor · `--site-surface` ← bgColor · `--site-font-heading/body` ← fontPairing.
  - header/footer arka planı: `HeaderSection`/`FooterSection` sabit `bg-white`/`var(--site-ink)` yerine `var(--site-area-bg, <varsayılan>)` kullanır → wrapper `--site-area-bg` = bgColor.
- Font: her alanın `fontPairing`'i farklıysa o ailenin Google Fonts linki ek yüklenir (`SiteRenderer` link'leri birleştirir).
- previewId/logo/contact enjeksiyonu korunur.

## UI — `DesignPanel` (client)
- Detay sayfasında **"Tasarım"** girişi → tam-ekran panel (blur backdrop).
- Sol: alan sekmesi (Üst/Gövde/Alt) → her alanda **yazı ailesi (WizardSelect)** + **metin rengi** + **arka plan rengi** (renk seçici) + "Varsayılana dön".
- Her alan için **mini canlı örnek** (client; areaStyles state'ten anında font/renk/bg gösterir → "dinamik gösterim").
- "Uygula" → `PATCH /api/website/[id]` `{ theme: { ...theme, areaStyles } }` → tam önizleme iframe `reloadKey++`.
- Bilmeyen kullanıcı: her alan "Varsayılan"da başlar (global tema).

## Risk / kapsam
- Migration yok. Meta/Google/publish/domain/version + Faz A/B (form/footer/hamburger/wizard/tarz) korunur.
- `SiteRenderer` 3-grup wrapper'a geçer → mevcut render REGRESYON riski; gerçek render (Playwright) ile doğrulanır (global default'ta görünüm AYNI kalmalı).
- i18n: panel metinleri tr+en.
- C2 (sonra): yazı boyutu ölçeği + opaklık + vurgu rengi.
