# DijiMagic — FİNAL CUTOVER CHECKLIST (DNS hazır olunca)

> Kod/DB/yerel rebrand %100 bitti + build ✓. Bu liste **canlı geçiş** içindir.
> Owner "DNS'i en son yapacağım" dedi → sıra: önce panolar pre-update, sonra DNS, sonra Vercel env+deploy.
> Meta izin baseline: 12/12 granted (docs/rebrand/meta-permissions-baseline.md) — sonunda birebir karşılaştır.

## 0) Ön gereksinimler (owner)
- [ ] **dijimagic.com DNS** (Turhost): `A  @  → 76.76.21.21` (Vercel apex). İstenirse `www` için `CNAME → cname.vercel-dns.com`.
- [ ] **info@dijimagic.com** kutusu + **SPF/DKIM/DMARC** (e-posta gönderimi; Resend/SMTP sağlayıcına göre TXT kayıtları).
- [ ] **vergi dairesi + vergi no** → legal sayfalardaki `[Eklenecek]` placeholder'ları doldur
      (app/mesafeli-satis-sozlesmesi, app/on-bilgilendirme-formu — TR+EN satıcı bloğu).

## 1) Harici panolar — dijimagic.com redirect/whitelist (DNS'ten ÖNCE pre-update OK; test DNS sonrası)
> Bu değerler kod ile BİREBİR aynı olmalı (mismatch = OAuth kopar).
- [ ] **Meta App (1643957336983150) → Settings/Basic:** App Domains `dijimagic.com`; Privacy `https://dijimagic.com/en/privacy-policy`;
      ToS `https://dijimagic.com/en/terms-of-service`; Data Deletion `https://dijimagic.com/api/meta/data-deletion`;
      Site URL `https://dijimagic.com/`; Display name `DijiMagic Ads Manager`; App icon = yeni DijiMagic ikonu (app/icon.png).
- [ ] **Meta → Facebook Login:** Valid OAuth Redirect URIs `https://dijimagic.com/api/meta/callback` (+ eski URI'yi test sonrası kaldır).
- [ ] **Meta → Webhooks:** Callback `https://dijimagic.com/api/meta/webhook` (verify token AYNI).
- [ ] **TikTok Developer:** redirect `https://dijimagic.com/api/integrations/tiktok-ads/callback`.
- [ ] **Google Cloud OAuth:** Authorized domains `dijimagic.com` + redirect `https://dijimagic.com/api/oauth/setup-google/callback`
      (+ GSC/GA/Gmail redirect'leri origin'den türer; env-pinli olan GOOGLE_SETUP_REDIRECT_URI Vercel'de güncellenecek — adım 3).
- [ ] **iyzico:** callback/whitelist domain `dijimagic.com`.
- [ ] **Supabase → Auth → URL Configuration:** Site URL + Redirect URLs `https://dijimagic.com` (kullanılıyorsa).
- [ ] **Cloudflare Turnstile:** allowed domains'e `dijimagic.com` ekle (mevcut site key).

## 2) DNS (owner — EN SON, tetikleyici)
- [ ] Turhost'ta A kaydını ekle (adım 0). Vercel otomatik doğrular (e-posta gelir). `vercel domains inspect dijimagic.com` ile teyit.

## 3) Vercel env domain-değerleri → dijimagic.com (Claude/CLI — DNS doğrulanınca)
> Şu an hâlâ yoai.yodijital.com. Komutlar (her biri production):
```
printf 'https://dijimagic.com' | vercel env add NEXT_PUBLIC_APP_URL production --force
printf 'https://dijimagic.com/api/meta/callback' | vercel env add META_REDIRECT_URI production --force
printf 'https://dijimagic.com/api/integrations/tiktok-ads/callback' | vercel env add TIKTOK_REDIRECT_URI production --force
printf 'https://dijimagic.com/api/oauth/setup-google/callback' | vercel env add GOOGLE_SETUP_REDIRECT_URI production --force
printf 'DijiMagic <info@dijimagic.com>' | vercel env add FROM_EMAIL production --force   # SPF/DKIM hazır olunca
```
> (Eski değerleri önce `vercel env rm <NAME> production` ile sil, sonra add — `--force` yoksa.)

## 4) Deploy (Claude/CLI)
- [ ] `git checkout main && git merge rebrand/dijimagic` (veya PR merge) → sonra `vercel deploy --prod`
      VEYA doğrudan branch'i prod'a: `vercel deploy --prod` (rebrand/dijimagic checkout'tayken).
- [ ] dijimagic.com'u production domain yap (Vercel otomatik, doğrulandıysa).

## 5) Doğrulama (deploy sonrası)
- [ ] dijimagic.com açılıyor; logo/favicon DijiMagic; legal sayfalar Onur Şuay + vergi no.
- [ ] Meta OAuth (login→callback) çalışıyor; `GET /me/permissions` → **12/12 granted** (baseline ile birebir).
- [ ] TikTok/Google OAuth, iyzico callback, signup→e-posta linki (dijimagic.com), sitemap/robots/canonical = dijimagic.com.
- [ ] Inngest function registry: `dijialgoritma/*` event'leri görünür.

## 6) Meta App (B) — portfolyo taşıma (verification ~2 gün BİTİNCE)
- [ ] "Onur Şuay İşletme portfolyosu" (2123210704559483) doğrulandı mı (`GET /me/permissions` + dashboard).
- [ ] App'i "Yo Dijital Medya" (617472891065421) → "Onur Şuay"a taşı.
- [ ] `GET /me/permissions` baseline ile karşılaştır → 12/12 korunuyor mu.
- [ ] Sonra "Yo Dijital Medya"yı App'ten kaldır.

## 7) Temizlik (cutover doğrulandıktan SONRA)
- [ ] Eski Vercel env sil: 11× `vercel env rm YOAI_*/YOALGORITMA_*/YOALGORITHM_EXPERT_COPY_ENABLED production`.
- [ ] yoai.yodijital.com domain'ini Vercel projeden kaldır.
- [ ] `scripts/rebrand/` sil (yoai içeren migrasyon tooling) + git commit.
- [ ] `yoai-brain` private repo: içerik (_learnings) dijimagic_* tablo referansları zaten kodda güncel; repo ADI opsiyonel `dijimagic-brain`.
- [ ] Vercel proje adı `yoai-project` → `dijimagic` (opsiyonel, kozmetik).
- [ ] GitHub repo adı (opsiyonel).
```
```
