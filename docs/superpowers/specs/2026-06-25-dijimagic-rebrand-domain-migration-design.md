# DijiMagic Rebrand + Domain Geçişi — Tasarım Dökümanı

> **Tarih:** 2026-06-25
> **Sahip:** Onur Şuay (onursuay@hotmail.com)
> **Durum:** Tasarım onayı bekliyor (brainstorming → spec aşaması)

## 1. Amaç ve Değişmez Kural

Proje, ayrılınan firma **YO Dijital Medya A.Ş. / `yodijital.com`** izlerinden ve eski ürün
adı **YoAi / YoAlgoritma**'dan **tamamen** arındırılacak. Yeni kimlik:

| Eski | Yeni |
|------|------|
| `YoAi` (ürün) | **DijiMagic** |
| `YoAlgoritma` (AI modülü) | **DijiAlgoritma** |
| `yoai.yodijital.com` (domain) | **dijimagic.com** |
| `info@yodijital.com` | **info@dijimagic.com** |
| `YO Dijital Medya Anonim Şirketi` | **DijiMagic** (marka) — yasal satıcı: **Onur Şuay (şahıs işletmesi)** |
| `voiceagent.yodijital.com` | kaldır |

**🔴 Hard requirement (sahip talimatı, birebir):** "yoai ile ilgili tek bir kelime bile
kalmayacak." Çalışma ağacında (working tree) `yoai`, `YoAi`, `YOAI`, `yoalgoritma`,
`YoAlgoritma`, `yodijital`, `YO Dijital` — **hiçbir formda, hiçbir katmanda kalmayacak.**
(Git geçmişi/log'ları immutable'dır ve sevk edilmez; kapsam dışıdır.)

**Büyük avantaj:** Uygulama **henüz kullanıcılara açılmadı** → canlı müşteri trafiği,
uçuştaki Inngest event'i veya kesinti riski yok. Bu, canlı DB yeniden adlandırmayı güvenli kılar.

## 2. İsim Haritası (büyük/küçük harf duyarlı)

```
YoAi          → DijiMagic         yoai          → dijimagic       YOAI → DIJIMAGIC
YoAlgoritma   → DijiAlgoritma     yoalgoritma   → dijialgoritma   YOALGORITMA → DIJIALGORITMA
yodijital     → dijimagic         YO Dijital Medya A.Ş. → DijiMagic (marka)
info@yodijital.com → info@dijimagic.com
```

**İstisna — yasal sayfalar:** `mesafeli-satis-sozlesmesi`, `on-bilgilendirme-formu` (+ TR/EN
karşılıkları). Marka **DijiMagic**, ama Mesafeli Sözleşmeler Yönetmeliği m.5 gereği satıcının
gerçek kimliği zorunludur → satıcı bloğu: **"DijiMagic — Onur Şuay (şahıs işletmesi)"** +
vergi dairesi/no + açık adres (sahip sağlayacak). Bu iki sayfa otomatik replace'ten **muaf**,
elle yeniden yazılır.

## 3. Envanter (kanıta dayalı, 2026-06-25)

| Token | Satır | Dosya |
|-------|------:|------:|
| `yoai` (tüm case) | 2922 | 450 |
| `yoalgoritma` (tüm case) | 629 | 181 |
| `yodijital` | 74 | 41 |
| `YO Dijital` | 29 | 16 |

### 3.1 Katmanlar
- **Metin/string:** `locales/tr.json` + `locales/en.json` (75+ marka, 14+ modül), UI bileşenleri,
  metadata (`app/layout.tsx`, `sitemap.ts`, `robots.ts`, per-page canonical), e-posta şablonları
  (`lib/email/*`, `lib/notifications/ownerNotifier.ts`, `lib/yoai/watchdog/notify.ts`), yasal sayfalar.
- **Klasör/dosya adları:** `lib/yoai/`, `components/yoai/`, `app/yoalgoritma/`, `app/api/yoai/`,
  `public/yoai-select.js`, `public/yoai-site-runtime.js`, `public/logos/yoai-logo.png`,
  `_automation/com.yoai.saglik.plist`, `src/tests/yoalgoritma*.test.ts` (5), `docs/*yoalgoritma*`/`*YoAi*`.
- **DB (canlı, Supabase `omddqhcvhxvzrizehnzw`):**
  - **Tablolar (12):** `yoai_action_outcomes`, `yoai_approval_versions`, `yoai_articles`,
    `yoai_business_scope`, `yoai_competitor_ads`, `yoai_competitor_insights`, `yoai_daily_runs`,
    `yoai_model_decisions`, `yoai_pending_approvals`, `yoai_platform_doctrine`,
    `yoai_publish_audit_log`, `yoai_recommendation_results`.
  - **Kolonlar:** `yoai_spec_json` (audiences), `yoai_business_context_prompt`.
  - **~80 nesne:** RLS policy (`*_select_own` vb.), index (`idx_yoai_*`, `uq_yoai_*`),
    constraint (`*_user_id_fkey`, `*_source_check`), trigger (`*_updated_at_trigger`).
  - **Cross-FK:** `yoai_approval_versions → yoai_pending_approvals → yoai_publish_audit_log`
    (Postgres FK'leri OID'e bağlıdır → RENAME FK'yi bozmaz).
  - **14 migration dosyası** (ad + içerik).
- **env (`YOAI_*`):** `YOAI_ACTIVE_PUBLISH_ENABLED`, `YOAI_DIRECT_PUBLISH_ENABLED`,
  `YOAI_DAILY_RUN_ENABLED`, `YOAI_COMPETITOR_INTEL_ENABLED`, `YOAI_MAX_DAILY_BUDGET_TRY`,
  `YOAI_MULTI_AI_ENABLED`, `YOAI_MULTI_AI_MAX_COST_PER_RUN_TRY`, `YOAI_MULTI_AI_TIMEOUT_MS`,
  `YOAI_PER_ACCOUNT_SCOPE`, `YOAI_SECRET`, `YOAI_SIGNATURE`.
  - ⚠️ `YOAI_SECRET`/`YOAI_SIGNATURE`: yalnız **değişken adı** değişir, **değer** aynı kalır →
    imza/HMAC bozulmaz.
- **localStorage anahtarları:** `yoai_cc_cache_v1/v2`, `yoai_cc_deep_cache`,
  `yoai_proposals_cache_v1..v4`, `yoai_gate_*`, `yoai_adimg_*`, `yoai_kart_bootstrap_at`,
  `yoai_scope_autoinit`, `yoai_seo_wp_incompatible` (yeniden adlandırma cache'i sıfırlar — pre-launch, sorun değil).
- **Inngest event ID'leri:** `yoalgoritma/scan.user`, `yoalgoritma/improvements.user`,
  `yoalgoritma/campaign-improvements.user` → `dijialgoritma/*`. (`brand/ingest.user` yoai içermez, kalır.)
- **Domain değerleri:** `NEXT_PUBLIC_APP_URL`, `META_REDIRECT_URI`, `TIKTOK_REDIRECT_URI`,
  `FROM_EMAIL`, `middleware.ts` `APP_HOST`, hardcoded fallback'ler (~32 dosya).

### 3.2 Route yeniden adlandırma kararı
| Eski | Yeni |
|------|------|
| `app/yoalgoritma` (URL `/yoalgoritma`) | `app/dijialgoritma` (URL `/dijialgoritma`) |
| `app/api/yoai/*` | `app/api/dijimagic/*` |
| `lib/yoai/` | `lib/dijimagic/` |
| `components/yoai/` | `components/dijimagic/` |

Tüm `import` yolları + `fetch('/api/yoai/…')` çağrıları senkron güncellenir.

## 4. Yaklaşım — Katmanlı, fazlar arası doğrulamalı, tek branch

Branch: `rebrand/dijimagic`. Değerlendirilen alternatifler:
- **(A) Katmanlı + fazlar arası doğrulama** — *Seçilen.* Her faz `build + typecheck + test`
  yeşil olmadan sonrakine geçmez; hata izole edilir. Mekanik yığında paralel ajan kullanılabilir.
- (B) Tek seferde scriptle replace + tek commit — hızlı ama gözden geçirilemez, substring
  bozma riski yüksek. Reddedildi.
- (C) Worktree + katman başına paralel ajan — mekanik bulk için hızlı; (A) içine gömülecek.

**Replace güvenliği:** case-aware + kelime-sınırı duyarlı; `node_modules`/`.next`/`.git` hariç;
yasal sayfalar + isim haritası muafiyetleri elle. Compound kimlikler tutarlı eşlenir
(`yoai_articles→dijimagic_articles`, `YOAI_DAILY_RUN_ENABLED→DIJIMAGIC_DAILY_RUN_ENABLED`,
`useYoai*→useDijiMagic*`, `YoAlgoritmaHeader→DijiAlgoritmaHeader`).

## 5. Faz Sırası

1. **Metin/string replace** (kod-içi, kullanıcı-yüzlü) — isim haritası; yasal/marka cümleleri elle.
   EN/TR locale paritesi korunur. → build+test.
2. **Klasör/dosya/route yeniden adlandırma** — `git mv` + import/fetch yolları + public scriptler
   + plist + testler + docs. → build+test.
3. **DB yeniden adlandırma (canlı):**
   - `scripts/rebrand/rename-db.sql`: `ALTER TABLE … RENAME` (12 tablo), `RENAME COLUMN` (2),
     `ALTER INDEX … RENAME`, `ALTER TABLE … RENAME CONSTRAINT`, `ALTER … RENAME` (policy/trigger).
     `SUPABASE_DB_URL` ile canlıya uygulanır.
   - 14 migration dosyasının **adı + içeriği** `dijimagic_*` olacak şekilde yeniden yazılır
     (timestamp'ler değişmez → Supabase tracking version eşleşir, re-apply olmaz; fresh
     `db reset` dijimagic şemasını üretir).
   - **`yoai-brain` repo'su** (`scripts/brain/collect-outcomes.mjs`) `dijimagic_action_outcomes`
     + `dijimagic_recommendation_results`'a güncellenir (lockstep).
   - Doğrulama: `\dt` → `dijimagic_*`; `rg yoai supabase/ scripts/` → 0.
4. **env + Vercel** — kod + `.env.local`'de `YOAI_*→DIJIMAGIC_*` ve domain değerleri;
   **Vercel env'i ben CLI ile** (lockstep). `.env.example` güncellenir.
5. **Inngest event'leri** — `yoalgoritma/*→dijialgoritma/*` (send + function trigger eşzamanlı).
6. **Logo + marka görseli** — `public/logos/dijimagic-logo.png` (yeni tasarım, bkz. §7).
7. **Dış panolar (checklist, §8)** — Vercel domain (ben), Meta/TikTok/Google/iyzico/Supabase-Auth/
   Turnstile/DNS/SPF-DKIM (sahip). Meta izin koruması §8.1.
8. **Doğrulama** — tam `npm run build` + `tsc` + tüm testler + smoke (signup→e-posta linki,
   Meta OAuth, iyzico callback, sitemap/robots/canonical, DijiAlgoritma sayfası) + `rg` ile sıfır-iz kontrolü.

## 6. Logo Tasarımı (alt-teslimat)
`yoai-logo.png` görsel olarak "YoAi" wordmark'ı içeriyor → dosya adı değişimi yetmez.
Tasarımcı kararıyla (global persona kuralı) DijiMagic wordmark + ikon üretilir, mevcut
palet/stile uyumlu; **PC + mobil önizleme** ile sunulur, onay sonrası yerleştirilir.
`frontend-design` skill'i bu adımda çağrılır.

## 7. Dış Sistem Checklist'i (uygulama planında genişletilecek)

### 7.1 Meta (izin riski — KRİTİK, sıralama bağlayıcı)
0. Önce mevcut izinleri teyit: `debug_token` + `/me/permissions` (merkezi token, app-token ile).
1. dijimagic.com'u Business Manager → Brand Safety → Domains'e **ekle + doğrula** (DNS TXT/meta-tag).
2. App Dashboard → Settings: **App Domains**'e dijimagic.com ekle (eskisini henüz silme).
3. Facebook Login → **Valid OAuth Redirect URIs**: `https://dijimagic.com/api/meta/callback` ekle.
4. **Webhook callback URL** → `https://dijimagic.com/api/meta/webhook` (verify token aynı).
5. **Privacy Policy URL** → `https://dijimagic.com/en/privacy-policy`,
   **Data Deletion** → `https://dijimagic.com/data-deletion` (veya callback), **Deauthorize** güncelle.
6. Yeni domainde uçtan uca OAuth + webhook doğrulandıktan **sonra** eski yoai.yodijital.com URL'lerini kaldır.
7. Onaylı izinler App'e bağlıdır; domain App Review kapsamını değiştirmez — yine de adım adım doğrula.

### 7.2 Diğer
- **Vercel (ben):** dijimagic.com domain ekle + production ata; env var'lar; (checklist) proje adı `yoai-project→dijimagic`.
- **TikTok Developer:** redirect URI `https://dijimagic.com/api/integrations/tiktok-ads/callback`.
- **Google Cloud OAuth:** authorized domains + redirect URI'ler (çoğu `${origin}`'den türer; env-pinli olanlar: GSC/GA/Gmail/Ads — varsa güncelle) + consent screen.
- **iyzico:** callback domain whitelist (ödeme).
- **Supabase:** Auth → URL Configuration → Site URL + Redirect URLs (kullanılıyorsa); proje adı (checklist).
- **Cloudflare Turnstile:** dijimagic.com'u allowed domains'e ekle (site key).
- **DNS:** dijimagic.com → Vercel (A/CNAME) + Meta doğrulama TXT + e-posta SPF/DKIM/DMARC.
- **GitHub:** ana repo + `yoai-brain` repo adlarını güncelle (remote + collector).
- **launchd:** `com.yoai.saglik.plist` yüklüyse unload→rename→reload.
- **Yerel klasör:** `YoAi_Project` → `DijiMagic_Project` (yolları değiştirir → en son, ayrı adım).

## 8. Risk Kontrolleri
- Pre-launch → kesinti/uçuştaki event riski yok.
- Meta/Google **publish akışı korunur** (proje kuralı): rebrand çoğunlukla entegrasyon-dışı kodu etkiler;
  env değer (ad değil) değişimi sonrası kampanya çekme/oluşturma/yayınlama smoke ile doğrulanır.
- Her faz build+test gate'i; tek branch, atomik commit'ler.
- DB: RENAME metadata işlemi (veri kopyalanmaz); FK'ler OID bağlı (bozulmaz); brain repo lockstep.
- `YOAI_SECRET`/`YOAI_SIGNATURE`: yalnız ad değişir, değer korunur.

## 9. Proje Kurallarına Uyum (uygulama sırasında)
- EN/TR i18n paritesi (tr.json + en.json birlikte); amber/sarı yasağı; UI standartları (max-w-7xl,
  animate-card-enter, text-base başlıklar); WizardSelect; ham enum yasağı.
- Her faz sonrası auto-commit + push; `docs/CHANGELOG.md` güncelle; `_learnings` döngüsü;
  teknik dosya gizleme hook'u.

## 10. Sahipten Gereken Girdiler
- Yasal satıcı detayları (vergi dairesi/no, açık adres) — yasal sayfalar için.
- dijimagic.com DNS erişimi + `info@dijimagic.com` kutusu durumu.
- (Logo: sahip "ben tasarlayayım" dedi → önizleme onayı alınacak.)

## 11. Kapsam Dışı
- Git geçmişi/log yeniden yazımı (immutable, sevk edilmez).
- 301 yönlendirme (kullanıcılara açılmadı — gereksiz).
- Eski yoai.yodijital.com'un Vercel'de tutulması (kaldırılır).
