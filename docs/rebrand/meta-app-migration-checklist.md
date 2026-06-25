# Meta App + İşletme Portfolyosu — Migrasyon Checklist'i

> **Tespit kaynağı:** Owner ekran görüntüleri (2026-06-25). App: `YoAI Ads Manager`,
> App ID `1643957336983150`, Mode: **Live**, type: İşletme.

## 🔴 İKİ AYRI OPERASYON — karıştırma

### (A) Domain/URL/isim/ikon rebrand — izinden BAĞIMSIZ, güvenli
**Önkoşul:** dijimagic.com canlı + privacy/ToS/data-deletion sayfaları 200 dönüyor
(yani önce kod rebrand'i + Vercel deploy). Sonra App Dashboard → Settings → Basic:

| Alan | Eski | Yeni |
|------|------|------|
| Display name | `YoAI Ads Manager` | `DijiMagic Ads Manager` |
| App domains | `yoai.yodijital.com` | `dijimagic.com` |
| Privacy policy URL | `https://yoai.yodijital.com/en/privacy-policy` | `https://dijimagic.com/en/privacy-policy` |
| Terms of Service URL | `https://yoai.yodijital.com/en/terms-of-service` | `https://dijimagic.com/en/terms-of-service` |
| User data deletion (callback) | `https://yoai.yodijital.com/api/meta/data-deletion` | `https://dijimagic.com/api/meta/data-deletion` |
| Website Site URL | `https://yoai.yodijital.com/` | `https://dijimagic.com/` |
| App icon | "YO DİJİTAL" logo | DijiMagic logo (tasarım sonrası) |
| Contact email | onursuay@hotmail.com | (kalabilir veya info@dijimagic.com) |

**Ekran görüntüsünde görünmeyen ama kodda var olan, AYNI domaine çevrilecekler:**
- Facebook Login for Business → **Valid OAuth Redirect URIs:**
  `https://yoai.yodijital.com/api/meta/callback` → `https://dijimagic.com/api/meta/callback`
- Webhooks → **Callback URL:** `https://yoai.yodijital.com/api/meta/webhook` →
  `https://dijimagic.com/api/meta/webhook` (verify token AYNI kalır)
- Deauthorize callback URL (varsa) → dijimagic.com
> Bu bölümlerin de ekran görüntüsünü al; alan adlarını birebir doğrulayalım.

### (B) App'i "Yo Dijital Medya" → "Onur Şuay" portfolyosuna taşı — İZİN RİSKİ BURADA
**Mevcut durum:**
- App sahibi portfolyo: **Yo Dijital Medya** (ID `617472891065421`) — Verified + Tech Provider verified.
- Yeni portfolyo: **Onur Şuay İşletme portfolyosu** (business_id `21232107045594…`) — **Business
  Verification: DEĞERLENDİRMEDE (~2 iş günü, 2026-06-25 itibarıyla).**

**Bağlayıcı güvenli sıra:**
1. ⏳ "Onur Şuay" portfolyosunun **doğrulanmasını bekle**.
2. (Gerekirse) yeni portfolyoda **Tech Provider / Access verification** başvurusu.
3. App'i Onur Şuay portfolyosuna **taşı** (Business Settings → Hesaplar → Uygulamalar → app → taşı).
4. `GET /me/permissions` → baseline (12 granted) ile **birebir** karşılaştır.
5. **Ancak ondan sonra** "Yo Dijital Medya"yı App'ten kaldır.

> ⚠️ Doğrulama bitmeden taşıma/kaldırma YAPMA. App Review onayları App'e bağlı (silinmez); fakat
> gelişmiş izin **erişilebilirliği** sahip işletmenin doğrulamasına bağlıdır.

## Sıra bağımlılığı (özet)
```
kod rebrand → Vercel deploy (dijimagic.com canlı) → (A) Meta URL/isim → [logo] App icon
                                                              ↘ (B) portfolyo taşıma — Meta onayı bekler (~2 gün)
```

## Yasal sayfalar için ele geçen bilgi (DPO bölümünden)
- Satıcı: **Onur Şuay** (şahıs işletmesi)
- Adres: **İlkbahar Mah. 621 Sk. No: 24, Çankaya / Ankara, 06550, Türkiye**
- E-posta: onursuay@hotmail.com (yasal iletişim info@dijimagic.com olabilir — owner teyit edecek)
- **HÂLÂ GEREKEN:** vergi dairesi + vergi no (şahıs işletmesi).
