# DijiMagic Rebrand — RESUME DURUMU (güncel)

> Son güncelleme: 2026-06-26. Branch: yerel `main` = `rebrand/dijimagic` (FF merge, commit 8458e37).
> Meta izin baseline: 12/12 granted (docs/rebrand/meta-permissions-baseline.md).

## ✅ TAMAMLANAN — KOD/DB/YEREL %100 + BUILD ✓
- **Faz 1+2+6**: 43 git mv + 498 dosya case-aware string replace + legal (satıcı=Onur Şuay) +
  voiceagent + TR gramer + YOALGORITHM gap fix. tsc 0 hata, git grep zero-trace.
- **Faz 3**: Canlı Supabase DB RENAME — 11 tablo + audiences.dijimagic_spec_json kolonu + 70 index +
  34 constraint + 34 RLS + trigger + function + 22 type → dijimagic; ai_engine_runs 43 satır
  yoalgoritma_hier→dijialgoritma_hier + CHECK. COMMIT'li (kalıcı). Migration dosyaları + collector dijimagic_.
- **Faz 4a**: env dosyaları + Inngest (dijialgoritma/*) + package-lock + .gitignore.
- **Faz 5**: DijiMagic logo (Montserrat wordmark+sparkle, public/logos/dijimagic-logo.png) + favicon (app/icon.png).
- **Faz 7**: npm run build ✓ Compiled successfully.
- Commit zinciri: aeedefe→acccbd3→7803aa1→d198fc9→3bdca1d→74e524f→134f77f→ecb4d0d→c3b333a→8458e37.

## ✅ VERCEL (CLI)
- dijimagic.com domaine eklendi (projeye). Flag env: DIJIMAGIC_PER_ACCOUNT_SCOPE + DIJIALGORITMA_SCRAPE_COMPETITORS
  production'a eklendi (değer "true"). Diğer 8 flag boş (`""`=off) → DIJIMAGIC_* eklemeye gerek yok (yokluk=off).

## ✅ DNS (owner yaptı, 2026-06-26)
- Turhost: NS = **dns1.turhost.com / dns2.turhost.com**; apex **A @ → 216.150.1.1** (Vercel IP).
- Public DNS: dijimagic.com → 216.150.1.1 **çözülüyor** ✓. Vercel SSL provizyonda (birkaç dk).
- NOT: Vercel'in kendi NS'i (ns1/ns2.vercel-dns.com) DEĞİL; A-kaydı yöntemi. DNS Turhost'ta kalır
  (e-posta MX/SPF/DKIM kayıtları da Turhost dns1/dns2 panelinde eklenecek).

## ⏸️ ŞU AN BLOKE — PRODUCTION DEPLOY (kullanıcı onayı bekliyor)
- Yerel `main`, rebrand'e FF-merge edildi (8458e37) AMA **`git push origin main` otomatik sınıflandırıcı
  tarafından bloke edildi** ("default branch'e push açık izin ister"). → **origin/main hâlâ ESKİ kod →
  canlı production hâlâ YO DİJİTAL + yoai_* sorguluyor (DB dijimagic olduğu için derin özellikler KIRIK).**
- ÇÖZÜM (kullanıcı seçecek): (a) push'a izin ver (settings permission / kendi push'la), (b) GitHub'da PR aç+merge,
  (c) onay ver ben push edeyim. Push → Vercel auto-deploy → dijimagic.com + yoai.yodijital.com DijiMagic servis eder + DB uyumu düzelir.

## ⏭️ DEPLOY SONRASI KALAN (koordineli — cross-domain OAuth/oturum kısıtı)
> NEXT_PUBLIC_APP_URL + META_REDIRECT_URI + TIKTOK_REDIRECT_URI + harici panolar AYNI domaini göstermeli.
> Şu an hepsi yoai (tutarlı → OAuth yoai.yodijital.com'da çalışır). dijimagic.com'a tam geçiş için:
1. **Harici panolar (owner)** → dijimagic.com redirect URI: Meta App (domain/redirect/webhook/privacy/ToS/site/isim/ikon),
   TikTok, Google OAuth authorized domains, iyzico callback, Supabase Auth URL, Cloudflare Turnstile. (Değerler: FINAL-CUTOVER-CHECKLIST.md)
2. **Vercel env flip (Claude)** → NEXT_PUBLIC_APP_URL/META_REDIRECT_URI/TIKTOK_REDIRECT_URI/GOOGLE_SETUP_REDIRECT_URI = dijimagic.com → **redeploy** (NEXT_PUBLIC build-time).
3. **FROM_EMAIL** → info@dijimagic.com (info@dijimagic.com kutusu + Turhost SPF/DKIM TXT hazır olunca; Resend domain doğrulaması).
4. **Meta App (B)** portfolyo taşıma: "Yo Dijital Medya"(617472891065421)→"Onur Şuay"(2123210704559483) — verification ~2g BİTİNCE; sonra /me/permissions baseline ile karşılaştır → eskini kaldır.
5. **Doğrulama**: dijimagic.com DijiMagic + OAuth + izin baseline + smoke.
6. **Final temizlik**: eski YOAI_* Vercel env sil (11), yoai.yodijital.com domain kaldır, scripts/rebrand sil, yoai-brain repo.

## ❗ OWNER GİRDİSİ
- Production deploy için push ONAYI (yukarıda).
- vergi dairesi + vergi no (legal `[Eklenecek]`).
- info@dijimagic.com kutusu + SPF/DKIM.
- Harici pano güncellemeleri (checklist'te birebir).
