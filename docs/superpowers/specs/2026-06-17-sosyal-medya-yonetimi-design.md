# Sosyal Medya Yönetimi — Tasarım Spec'i

**Tarih:** 2026-06-17
**Durum:** Onaylandı (kullanıcı onayı 2026-06-17)
**Branch:** `feat/sosyal-medya-yonetimi`

## 1. Amaç

Kullanıcıların görsel/video içeriklerini proje (kampanya) bazında planlayıp, ileri bir
tarih-saate zamanlayabildiği ve zamanı gelince **otomatik** Instagram/Facebook'a yayınlanan
bir içerik takvimi modülü. Meta Business Suite'in "Planner" deneyimine benzer.

Yayın altyapısı (organik Instagram Feed/Reels/Hikaye + Facebook Feed/Reels) projede
**zaten mevcut** — bu modül onun üstüne planlama + zamanlama + medya deposu katmanı ekler.

## 2. Onaylanan kararlar

| Konu | Karar |
|---|---|
| Organizasyon birimi | Adlandırılmış **kampanya/proje**; bir proje bir veya çok hesaba bağlanabilir |
| İçerik kaynağı | **Kullanıcı yüklemesi + Tasarım modülünden aktarım** |
| Yayın davranışı | **Tam otomatik + başarısızlık bildirimi & sınırlı yeniden deneme** |
| Erişim modeli | **Hibrit** — modül erişimi abonelik; AI üretim Tasarım kredisinde |
| Ana görünüm | **Hibrit takvim** (sol ay ızgarası + sağ gün detayı), üstte format sekmeleri |
| Hedef kapsam | **Instagram + Facebook, çoklu hedef** (tek planlama → çoklu yayın / cross-post) |

## 3. Mimari yaklaşım

**Zamanlama motoru: tablo + dakikalık cron + atomik claim** (Inngest `sleepUntil` yerine).

Gerekçe: projedeki kanıtlanmış desen (`article_schedules` + `email_drip_queue`). Düzenleme/iptal
sadece satır güncellemesi; Vercel 60s limitine takılmaz; başarısızlık + retry doğal modellenir.

Akış:
1. Kullanıcı içerik planlar → `social_scheduled_posts` satırı `status='scheduled'`, `scheduled_at` UTC.
2. Dakikalık cron (`/api/cron/social-publish`) `scheduled_at <= now() AND status='scheduled'` satırları çeker.
3. Her satır **atomik claim** edilir (`status='scheduled' → 'publishing'` koşullu UPDATE; SEO `claimScheduleRun` deseni).
4. Her hedef (`social_post_targets`) için mevcut Meta publish route'ları çağrılır.
5. Tüm hedefler başarılı → `status='published'`. Bir/birden çok hata → `status='failed'`,
   `attempts++`, `next_retry_at` ayarlanır (exponential backoff, maks. 3 deneme).
6. `failed` + retry tükendi → kullanıcı bildirimi (toast/in-app; ileride e-posta).

## 4. Veri modeli (yeni tablolar)

Tümü additive migration, RLS açık (mevcut tabloların RLS desenine uyumlu), `gen_random_uuid()`.

### `social_projects`
- `id uuid pk`, `user_id text/uuid` (mevcut tablolarla aynı tip), `business_scope text null`
  (yoai_business_scope ile uyum; null = tüm hesaplar), `name text`, `color text` (hex etiket),
  `status text` ('active'|'archived'), `created_at timestamptz`, `updated_at timestamptz`.

### `social_scheduled_posts` (çekirdek)
- `id uuid pk`, `user_id`, `project_id uuid fk → social_projects(id) on delete cascade null`,
  `format text` ('feed'|'reels'|'story'),
  `caption text null`,
  `scheduled_at timestamptz`, `timezone text` (IANA, örn. 'Europe/Istanbul'),
  `status text` ('draft'|'scheduled'|'publishing'|'published'|'failed'|'cancelled'),
  `attempts int default 0`, `last_error text null`, `next_retry_at timestamptz null`,
  `published_at timestamptz null`, `source text` ('upload'|'tasarim'),
  `created_at`, `updated_at`.
- Index: `(status, scheduled_at)` (cron taraması), `(user_id, scheduled_at)` (takvim sorgusu).

### `social_post_targets` (post ↔ hesap; cross-post)
- `id uuid pk`, `post_id uuid fk → social_scheduled_posts(id) on delete cascade`,
  `platform text` ('instagram'|'facebook'),
  `page_id text`, `ig_user_id text null`,
  `target_status text` ('pending'|'published'|'failed'),
  `target_error text null`, `published_id text null` (Meta media/post id),
  `created_at`.

### `social_post_media`
- `id uuid pk`, `post_id uuid fk → social_scheduled_posts(id) on delete cascade`,
  `media_type text` ('image'|'video'), `storage_path text`, `public_url text`,
  `sort_order int default 0`, `width int null`, `height int null`, `duration numeric null`,
  `created_at`.
- MVP: tek medya (sort_order=0). Carousel Faz 2 (şema hazır).

Durum makinesi: `draft → scheduled → publishing → published | failed`.
`failed` → `next_retry_at` ile sınırlı retry; tükenince kullanıcı bildirimi.

## 5. Medya deposu

**Supabase Storage** bucket'ı: `social-media`. Yol: `social-media/{userId}/{postId}/{uuid}.{ext}`.
- Bucket programatik oluşturulur (service role; setup script + idempotent kontrol).
- **Yükleme:** `POST /api/social/media/upload` (multipart) → Storage → kalıcı `public_url`.
- **Tasarım aktarımı:** Tasarım çıktısının URL'i indirilip Storage'a kopyalanır (geçici CDN linkine güvenilmez).
- Meta IG Content Publishing API public erişilebilir URL ister → **public bucket** (en basit; yalnız medya, hassas veri yok).
- Boyut/format doğrulaması: görsel (jpg/png) ve video (mp4); Meta format limitleri (Reels 9:16, vb.) UI'da uyarılır, sertçe engellenmez.

## 6. UI / UX

Yeni modül: `app/sosyal-medya/`. Mevcut modül kalıbı (SidebarNav + AccountApprovalGuard + Topbar).
UI kodu **`frontend-design` skill'i** ile, proje UI standardına tam uyumlu (max-w-7xl, `animate-card-enter`,
amber yasağı, WizardSelect, hover standartları, EN/TR).

- **Üst format sekmeleri:** `Akış` · `Reels` · `Hikaye`. Her format alana özel:
  - Hikaye: caption yok, 24s doğası gösterilir.
  - Reels: video zorunlu.
  - Akış: görsel veya video + caption.
- **Hibrit takvim:** Sol ay ızgarası (gün hücrelerinde küçük önizleme + durum noktaları),
  sağ panel seçili günün saat-saat içerikleri + "İçerik ekle".
- **Proje seçici/filtre:** üstte aktif proje (renk etiketli); takvim seçili projeye göre filtrelenir.
  "Yeni proje" oluşturma.
- **İçerik ekleme drawer/modal:** kaynak (Yükle / Tasarım'dan getir) → format → hedef hesaplar
  (IG/FB çoklu seçim, WizardSelect tarzı) → caption → tarih-saat (timezone-aware) → "Planla".
  Yayından önce kart düzenlenebilir/iptal edilebilir.
- **Durum rozetleri:** planlandı (gri) / yayında (emerald) / başarısız (kırmızı + "Tekrar dene").
  Amber yok.

## 7. Erişim & kredi

- Modül girişinde **`AccessRequiredModal type="subscription"`**; `featureAccessMap`'e
  `social_media_management: subscription_required` eklenir. Owner bypass korunur (mevcut mekanizma).
- AI içerik üretimi Tasarım modülünde olduğundan **kredi orada** düşülür; planlama/yayın ek kredi almaz.
- Backend guard: API route'larında abonelik kontrolü (UI modal sadece UX katmanı).

## 8. Entegrasyon noktaları (mevcut kod yeniden kullanımı)

- **Yayın:** `app/api/meta/publish/instagram/route.ts` ve `.../facebook/route.ts` **olduğu gibi**
  kullanılır (Meta API/publish koruması — dokunma). Cron worker bunları dahili çağırır veya
  ortak publish helper'a refactor edilir (davranış birebir korunarak).
- **Token & hesap çözümleme:** `lib/metaConnectionStore.ts`, `lib/meta/pageToken.ts`,
  `lib/meta/ig.ts` yeniden kullanılır.
- **Hedef hesap listesi:** `app/api/meta/publish/targets/route.ts` mevcut → içerik ekleme
  ekranında hedef seçimi bundan beslenir.
- **Scope:** `lib/account/businessGroups.ts` / `registeredAccounts.ts` ile çoklu işletme uyumu.

## 9. i18n / nav / routes

- `lib/nav.ts`: yeni öğe `sosyal-medya` (Reklam grubu yakınına veya bağımsız). İkon lucide.
- `lib/routes.ts`: `SLUG_TR_TO_EN`'e `'sosyal-medya': 'social-media'`.
- `locales/tr.json` + `locales/en.json`: `sidebar.sosyalmedya` + `dashboard.sosyalmedya.*` (tüm UI metinleri).
- **Hardcoded string yasak**; tüm metinler `t(...)` üzerinden.

## 10. Fazlama

1. **MVP (bu spec):** Migration'lar + Storage + modül iskeleti + yükleme + hibrit takvim
   (Akış/Reels/Hikaye) + IG+FB çoklu hedef + cron yayın + retry/bildirim + abonelik bariyeri.
2. **Faz 2:** Tasarım modülünden aktarım butonu, carousel (çoklu medya), proje renk/filtre zenginleştirme.
3. **Faz 3:** Yayınlanan içerik analitiği, optimal saat önerisi.

> Not: Kaynak olarak "Tasarım'dan getir" MVP'de UI'da yer alır; tam aktarım mantığı Faz 2'de
> derinleşebilir. Yükleme yolu MVP'de tam çalışır.

## 11. Paralel geliştirme notu (ÖNEMLİ)

Aynı projede paralel bir Claude oturumu çalışıyor olabilir (kullanıcı uyarısı).
- Çalışma izole bir branch'te: `feat/sosyal-medya-yonetimi`.
- Modül büyük ölçüde **yeni dosyalarda** yaşar (düşük çakışma yüzeyi).
- Riskli ortak dosyalar: `lib/nav.ts`, `lib/routes.ts`, `locales/tr.json`, `locales/en.json`,
  `vercel.json`, `lib/billing/featureAccessMap.ts`. Bunlara dokunmadan önce güncel hali okunur,
  **yalnızca ekleme** yapılır, mevcut girdiler ezilmez.

## 12. Açık riskler / kullanıcı görevleri

- **Supabase Storage bucket:** programatik oluşturulacak; başarısız olursa kullanıcının
  Dashboard'dan `social-media` (public) bucket açması gerekebilir.
- **Vercel cron:** `vercel.json`'a `/api/cron/social-publish` (`* * * * *`) eklenecek; deploy sonrası aktif olur.
- **Meta token kapsamı:** `instagram_content_publish`, `pages_manage_posts` izinleri zaten var.
- **Medya boyutu:** Vercel serverless body limiti nedeniyle büyük video yüklemeleri için
  doğrudan-Storage (signed upload URL) gerekebilir; MVP'de makul boyut sınırı + sunucu üzerinden upload.
