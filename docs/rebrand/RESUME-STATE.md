# DijiMagic Rebrand — RESUME DURUMU (devam noktası)

> Son güncelleme: 2026-06-25. Branch: `rebrand/dijimagic`.
> Kullanıcı bilgisayarı kapattı; "devam et" deyince BURADAN devam.

## ✅ TAMAMLANAN (commit'li)
- **Faz 1+2+6** (commit `acccbd3`): 43 git mv (klasör/dosya/route/migration adları) + 498 dosyada
  case-aware string replace + legal sayfalar (satıcı = Onur Şuay şahıs işletmesi + adres) +
  voiceagent referansı temizlendi + TR ek grameri (nin→in, ye→e). **tsc 0 hata.**
- **Faz 3** (commit `7803aa1`): **Canlı Supabase DB RENAME tamam** — 11 tablo, 1 kolon
  (audiences.dijimagic_spec_json), 70 index, 34 constraint, 34 RLS policy, 1 trigger, 1 function,
  22 type → dijimagic. `ai_engine_runs`: 43 satır `yoalgoritma_hier`→`dijialgoritma_hier` + CHECK.
  Transaction + verify-or-rollback ile COMMIT (sıfır yoai DB nesnesi doğrulandı).
  Migration dosya içerikleri + collect-outcomes.mjs zaten dijimagic_ (bulk replace ile).
- **Faz 4a** (commit `7803aa1`): `.env.local` + `.env.example` domain/email/KEY → dijimagic
  (secret DEĞERLERİ korundu). Inngest event'leri kodda `dijialgoritma/*` (17×, send+trigger tutarlı).

## 📊 DURUM
- Kod tarafı **SIFIR yoai izi** (tek kalan: `package-lock.json` — `npm install` ile yenilenecek).
- TLS: `scripts/rebrand/_db.mjs` Supabase Root CA pinler (rejectUnauthorized:true, güvenli).
- DB bağlantısı CA pinli çalışıyor. `scripts/rebrand/introspect-db.mjs` ile durum okunabilir.

## ⏭️ SIRADAKİ (devam edince)
1. **Faz 4b:** `npm install` → package-lock.json yenilensin (son yoai izi temizlenir, name=DijiMagic).
   Sonra **Vercel CLI**: `vercel whoami` → env var rename (YOAI_→DIJIMAGIC_ + YOALGORITMA_→DIJIALGORITMA_,
   değer aynı), domain değerleri (NEXT_PUBLIC_APP_URL/META_REDIRECT_URI/TIKTOK_REDIRECT_URI/FROM_EMAIL/
   PLATFORM_FROM_ADDRESS → dijimagic.com), dijimagic.com domain ekle + production ata.
2. **Faz 5:** DijiMagic logo (frontend-design skill, PC+mobil önizleme+onay) → public/logos/dijimagic-logo.png
   + Meta App icon. (Owner "ben tasarlayayım" dedi.)
3. **Faz 7:** `npm run build` + adversarial doğrulama workflow + Meta izin baseline ile birebir karşılaştır.
4. **Faz 8a:** dijimagic.com deploy → Meta App (A) URL/isim/ikon checklist (owner dashboard) +
   TikTok/Google/iyzico/Supabase-Auth/Turnstile/DNS/SPF checklist. Bkz. docs/rebrand/meta-app-migration-checklist.md.
5. **Faz 8b:** Meta App'i "Yo Dijital Medya" → "Onur Şuay" portfolyosuna taşı — **Meta business
   verification (~2 gün) BİTİNCE.** Sıra: doğrula→taşı→/me/permissions baseline ile karşılaştır→eskini kaldır.
6. **Final temizlik:** `scripts/rebrand/` sil (yoai içeren tooling), CHANGELOG güncelle,
   yoai-brain repo içeriği (_learnings) + repo adı (Faz 8 dış).

## ❗ OWNER'DAN GEREKEN GİRDİLER
- Yasal sayfalar için **vergi dairesi + vergi no** (şu an "[Eklenecek]" placeholder).
- dijimagic.com **DNS erişimi** + **info@dijimagic.com** kutusu kuruldu mu (Vercel domain + SPF/DKIM).
- Meta verification durumu (owner bildirecek; ben de introspect/Graph ile kontrol edebilirim).

## 🔑 BASELINE (değişiklik öncesi — doğrulama için)
- Meta izinleri: 12 granted / 0 declined (docs/rebrand/meta-permissions-baseline.md).
- tsc: 0 hata (rename öncesi ve sonrası aynı).
