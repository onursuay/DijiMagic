# Erken Uyarı — Günlük Reklam Nöbetçisi (Spec + Uygulama Kaydı)

**Tarih:** 2026-06-15
**Branch:** `feat/erken-uyari-watchdog`
**Durum:** Kod tamam + doğrulandı (tsc 0 hata, `next build` EXIT=0). **Canlıya alınmadı** (deploy/env owner onayı bekliyor).

## Amaç
yoalgoritma'nın **haftalık** AI taramasından ayrı, **günlük (05:00 UTC)**, **deterministik (LLM'siz → maliyetsiz)** bir nöbetçi. Tek soruya bakar: *"Dün gece bir şey ters mi gitti — para yanıyor mu, reklam kırık mı, hesap durdu mu?"* Optimizasyon/strateji üretmez; yalnız acil durum + bozulma tespit eder ve uyarır.

## Karara bağlanan tasarım (owner ile)
- **Yer:** yoalgoritma altında, kendi sekmesi (`/yoalgoritma/erken-uyari`). Yeni sidebar başlığı YOK; "Gözetim Merkezi" adı super-admin paneline ait olduğu için kullanılmadı.
- **Zaman:** her sabah 05:00 (UTC) — `vercel.json` cron.
- **Maliyet:** Claude/LLM çağrısı YOK. Yalnız Meta/Google **salt-okuma** API çağrıları. Reklamlara/hesaplara hiç dokunmaz.
- **Kapsam:** Bağlı token'ın eriştiği **tüm** Meta + Google hesapları **otomatik keşfedilir** (elle liste yok). **Aktivite filtresi:** yalnız son 30 günde harcaması olan hesaplar taranır → yedek/test/kapalı/uzun-ölü hesaplar atlanır (gürültü yok). Aktif bir hesap askıya/kapanmaya düşerse yine yakalanır.
- **Yalnız aktif reklamlar** taranır ama "duraklatılmış" iki ayrı şeydir: kullanıcının bilerek durdurduğu atlanır; platformun durdurduğu/reddettiği/ödeme nedeniyle kapattığı = **uyarı**.

## Tespit kuralları (`lib/yoai/watchdog/rules.ts`)
Eşikler mevcut `lib/meta/optimization/ruleEngine.ts` ile tutarlı; para birimi zayıfsa (TRY=1.0 taban) ölçeklenir.

| Tür (alert_type) | Severity | Tetik |
|---|---|---|
| `wd_account_suspended` | critical | Hesap aktif değil (politika/risk) |
| `wd_payment_issue` | critical | Ödeme/bakiye sorunu (unsettled/grace/risk_payment) |
| `wd_ad_disapproved` | high | Aktif reklam reddedilmiş / sorunlu (effective DISAPPROVED/WITH_ISSUES) |
| `wd_dead_active_ad` | high | Aktif ama 0 gösterim & 0 harcama (teknik hata) |
| `wd_spend_no_conversion` | high | Son 3g anlamlı harcama (≥150×factor) + 0 dönüşüm |
| `wd_roas_below_1` | high | Satış kampanyası, ROAS < 1 (zarar) |
| `wd_cpa_spike` | medium/high | 3g CPA, baseline (30g) × 1.5 (med) / × 2.0 (high) — yeterli veri varsa |
| `wd_delivery_stopped` | medium | Aktif + bütçe var ama harcama bütçenin <%50'si |
| `wd_high_frequency` | medium/high | Frekans > 4 (med) / > 6 (high) |
| `wd_impression_share_lost` | medium | Google: bütçeden kaybedilen gösterim payı > %20 |

"İki sıfır" ayrımı: **0 gösterim/harcama = ölü reklam (teknik hata)** ≠ **harcama var + 0 dönüşüm = para sızıntısı**.

## Mimari (dosyalar)
- `lib/yoai/watchdog/types.ts` — sözleşmeler.
- `lib/yoai/watchdog/rules.ts` — **saf** deterministik kural motoru (I/O yok).
- `lib/yoai/watchdog/metaWatchdog.ts` — Meta keşif + fetch (durum, kampanya/reklam, dün/3g/30g insight, reddedilen/ölü).
- `lib/yoai/watchdog/googleWatchdog.ts` — Google keşif (MCC customer_client) + GAQL fetch + reddedilen + IS kaybı.
- `lib/yoai/watchdog/notify.ts` — Resend e-posta özeti (severity'ye göre); `notification_log`'a yazar.
- `lib/yoai/watchdog/runWatchdog.ts` — orkestratör: önceki `wd_*` uyarıları superseded (AI uyarılarına DOKUNMAZ) → Meta+Google paralel → (hesap,tür) bazında **grupla** → `account_alerts`'e yaz → e-posta.
- `app/api/cron/erken-uyari/route.ts` — günlük cron (Bearer `CRON_SECRET`, `WATCHDOG_ENABLED` flag, `?onlyUser` smoke).
- `app/api/yoai/watchdog/route.ts` — GET (uyarı listesi) + POST (interaktif tarama, e-postasız).
- `app/yoalgoritma/erken-uyari/page.tsx` + `components/yoai/ErkenUyariClient.tsx` — kullanıcı görünümü.
- `components/yoai/YoAiTabs.tsx` + `app/yoalgoritma/layout.tsx` — Komuta Merkezi ↔ Erken Uyarı sekme bar + rozet.
- `lib/yoai/featureFlag.ts` — `isWatchdogEnabled()`.
- `vercel.json` — `/api/cron/erken-uyari` @ `0 5 * * *`.

**Migration GEREKMEZ:** `account_alerts.alert_type` serbest metin (CHECK yok); `wd_*` türleri doğrudan yazılır. account_id/business_key kolonları yoksa `insertAccountAlert` zaten zarifçe degrade eder.

## Canlıya alma adımları (owner döndüğünde)
1. **`WATCHDOG_ENABLED=true`** Vercel env'e eklenir (kapalıyken cron no-op = sıfır maliyet). `CRON_SECRET` zaten var.
2. Branch incelenir → main'e merge → Vercel prod deploy. (Cron yalnız prod'da, main'den çalışır.)
3. **Smoke:** deploy sonrası `GET /api/cron/erken-uyari?onlyUser=<owner_user_id>` (Bearer CRON_SECRET) ile tek kullanıcı taraması; ya da UI'da "Şimdi tara".
4. (İsteğe bağlı) çoklu-hesap fan-out için `YOAI_PER_ACCOUNT_SCOPE` — watchdog buna bağlı değil (kendi keşfini yapar), ama haftalık tarama için açılabilir.

## Açık konular (owner kararı / aksiyonu)
- **Meta erişimi:** Mevcut token **Antso Denizcilik (act_829085015937551)** ve **Ada Trust Life (act_843888504554766)** hesaplarını GÖRMÜYOR (farklı BM olabilir). Erişim açılınca otomatik taranır. Elysium Garden, The Elysium, Fikret Petrol erişilebilir ✓.
- **Abonelik kapısı:** Şu an `/api/yoai/watchdog` oturum açmış her kullanıcıya açık (owner bypass). Ürün kararı: temel uyarı herkese / gelişmiş nöbetçi aboneliğe → gerekirse route'a `hasActiveSubscription` guard eklenir (desen mevcut).
- **i18n:** Erken Uyarı UI metinleri şimdilik doğrudan Türkçe (uygulama Türkçe-öncelikli; uyarı içeriği zaten DB'den TR). Proje standardı gereği `tr.json`/`en.json`'a anahtar çıkarımı = takip işi.
- **Ölçek:** Cron şu an kullanıcıları sıralı (inline) işler. Kullanıcı sayısı çok artarsa Inngest'e (mevcut `yoalgoritmaScan` deseni) taşınır.

## Doğrulama
- `npx tsc --noEmit` → tüm projede **0 hata**.
- `npx next build` → **EXIT=0**; `/yoalgoritma/erken-uyari` ve API rotaları derlendi, komuta merkezi sayfası bozulmadı.
- Canlı dry-run: deploy sonrası `?onlyUser` smoke ile (read-only) yapılacak.
