# Web Site Yöneticisi — Faz C2: Alan bazlı ölçek + opaklık + vurgu rengi

**Tarih:** 2026-06-16
**Bağlam:** Faz C1 (alan bazlı yazı tipi + metin rengi + zemin rengi) CANLI. C2 bu yapının üzerine, yine `theme.areaStyles` jsonb içine (migration YOK) üç yeni per-alan kontrol ekler.

## Kapsam (Üst/Gövde/Alt her alan için)

1. **Yazı boyutu ölçeği** (`textScale`) — Küçük(0.9) / Normal(1) / Büyük(1.1) / Çok Büyük(1.25).
2. **Vurgu rengi** (`accentColor`) — alanın buton/CTA/ikon/çizgi aksanı.
3. **Zemin opaklığı** (`bgOpacity`, 0–100) — seçilen zemin renginin saydamlığı (özellikle header'da cam/blur efekti).

"Opaklık" yorumu: en savunulabilir/değerli/uygulanabilir olan **alan zemin opaklığı**. Metin/overlay opaklığı yerine seçildi çünkü (a) header'ın cam efektini gerçekten kontrol eder, (b) tek noktadan `color-mix` ile uygulanır, (c) bgColor yoksa/100 ise C1 davranışı birebir korunur.

## Token modeli (`AreaStyle` genişler — jsonb, migration yok)

```ts
interface AreaStyle {
  fontPairing?, textColor?, bgColor?  // C1
  textScale?: string | null           // '0.9' | '1' | '1.1' | '1.25'
  accentColor?: string | null         // #rrggbb
  bgOpacity?: number | null           // 0..100 (yalnız bgColor ile anlamlı)
}
```

## Render (CSS değişken cascade)

`areaCssVars(area, footer)` (lib/website/render/theme.ts) genişler:
- `textScale` → `--site-text-scale` (yalnız ≠1 ise yazılır).
- `accentColor` → `--site-accent` override + `--site-accent-soft = color-mix(in srgb, accent 12%, transparent)` + **luminance-aware `--site-on-accent`** (açık accent → koyu metin, koyu accent → beyaz; sarı+beyaz okunmazlığını önler).
- `bgColor` + `bgOpacity<100` → `--site-surface`/`--site-area-bg = color-mix(in srgb, bgColor X%, transparent)`.

`themeToCssVars` köke `--site-text-scale: '1'` default ekler.

**Tipografi ölçeği:** `sections.tsx`'teki tüm font-size token'ları (`text-[Xrem]`, `text-[clamp(...)]`) — **sabit string** olduğundan Tailwind build-time tarar — `text-[calc(var(--site-text-scale,1)*…)]` formuna çevrilir. `text-[color:…]` (renk) ve `tracking/leading` arbitrary'lerine DOKUNULMAZ. `--site-on-accent`/accent cascade olduğu için **sections accent/opacity için değişmez** (sadece tipografi calc'a döner).

**Doğrulama riski:** Tailwind 3.4 arbitrary value içinde `calc(var(...)*clamp(...))` (iç içe virgül) — gerçek render ile doğrulanır; parse edilmezse o token'lar inline `style` fontSize'a düşürülür.

## Panel (DesignPanel.tsx)

Mevcut alan sekmesi içine: **Yazı boyutu ölçeği** (WizardSelect), **Vurgu rengi** (ColorField), **Zemin opaklığı** (0–100 slider). Mini canlı örnek üçünü de yansıtır. Accent + on-accent kontrastı < 4.5:1 ise uyarı (C1 kontrast altyapısı yeniden kullanılır). Geçersiz değer kaydedilmez (textScale preset dışı / accentColor geçersiz hex atlanır).

## Geriye uyumluluk / regresyon

Hiçbir alan C2 alanı set etmezse render birebir C1 ile aynı (`--site-text-scale` yoksa 1, accent global, bgColor tam opak). Migration yok. Mevcut çalışan yayın/önizleme akışı korunur.

## i18n

`designTextScale`, `designScale_small/normal/large/xlarge`, `designAccentColor`, `designBgOpacity`, `designAccentContrastWarn` → tr.json + en.json.

## Doğrulama

1. tsc temiz.
2. Gerçek render: default (C2 alanları yok) = C1 ile bit-aynı; alan override (header accent+opacity, body textScale, footer accent) görsel doğrulanır; clamp+calc Tailwind parse edilir.
3. Adversarial review (regresyon / correctness / i18n-UX) → doğrulanan bulgular düzeltilir.
