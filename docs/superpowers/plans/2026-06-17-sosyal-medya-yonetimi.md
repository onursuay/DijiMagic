# Sosyal Medya Yönetimi Implementation Plan

> **For agentic workers:** Bu plan task-by-task uygulanır. Adımlar checkbox (`- [ ]`) ile işaretlenir.

**Goal:** Görsel/video içeriklerin proje bazında planlanıp ileri tarih-saate zamanlandığı ve cron ile otomatik Instagram/Facebook'a yayınlandığı bir içerik takvimi modülü.

**Architecture:** Tablo + dakikalık cron + atomik claim deseni (mevcut `email_drip_process` + `seo-article-run` desenleri). Yayın, mevcut Meta publish mantığının user-id parametreli kopyası (`lib/social/metaPublisher.ts`) üzerinden — mevcut publish route'larına dokunulmaz. Medya Supabase Storage'da.

**Tech Stack:** Next.js (App Router), TypeScript, Supabase (pg + supabase-js service role), Meta Graph API, next-intl, Tailwind, lucide-react.

## Global Constraints

- UI standardı: `max-w-7xl mx-auto`, bölüm başlıkları `text-base font-semibold`, `animate-card-enter`, `hover:shadow-md transition-all`, amber/sarı YASAK.
- Renkler: planlandı=gri, yayında=emerald, hata=red. Uyarı=`bg-primary/5 text-primary`.
- EN/TR: her UI metni HEM `locales/tr.json` HEM `locales/en.json`, aynı key path. Hardcoded string yok.
- Dropdown: `WizardSelect` ([components/meta/wizard/WizardSelect.tsx](components/meta/wizard/WizardSelect.tsx)).
- Ham enum/teknik terim UI'da YASAK — sade Türkçe etiket.
- Meta publish route'larına (`app/api/meta/publish/*`) DOKUNMA — paralel helper yaz.
- DB: `user_id TEXT`, `gen_random_uuid()`, RLS açık (service-role bypass + app-layer user_id filtresi). Migration additive + idempotent (`IF NOT EXISTS`).
- Cron auth: `Authorization: Bearer ${process.env.CRON_SECRET}`.
- API auth: `getCurrentUser()` ([lib/billing/user.ts]) veya `readUserId(cookieStore)` ([lib/auth/userCookie.ts]).
- Abonelik guard: `chargeFeature({ featureKey, requireSubscription: true })` ([lib/billing/featureGuard.ts]).
- Otomatik commit + push her task sonunda. `docs/CHANGELOG.md` güncelle.
- Paralel oturum riski: ortak dosyalara (`lib/nav.ts`, `lib/routes.ts`, `locales/*`, `vercel.json`, `featureAccessMap.ts`) dokunmadan önce güncel hali oku, yalnız ekle.

---

### Task 1: DB şeması + migration + Storage bucket

**Files:**
- Create: `supabase/migrations/20260617000000_create_social_media_tables.sql`
- Create: `scripts/apply-social-media-migration.mjs`
- Create: `scripts/setup-social-media-storage.mjs`

**Interfaces:**
- Produces tablolar: `social_projects`, `social_scheduled_posts`, `social_post_targets`, `social_post_media`.
- Produces Storage bucket: `social-media` (public).

- [ ] **Step 1: Migration SQL yaz** — 4 tablo (spec §4), index'ler (`(status, scheduled_at)`, `(user_id, scheduled_at)`), CHECK kısıtları, RLS (website örneği deseni), `updated_at` default `now()`.
- [ ] **Step 2: Apply script yaz** ([scripts/db-apply-migration.mjs] deseni; `SUPABASE_DB_URL`, TLS doğrulaması AÇIK — `scripts/supabase-ca.pem` ile `ssl: { ca, rejectUnauthorized: true }`).
- [ ] **Step 3: Migration uygula** — `node scripts/apply-social-media-migration.mjs`. Beklenen: 4 tablo oluştu, hata yok.
- [ ] **Step 4: Storage setup script yaz + çalıştır** — supabase-js service role ile `createBucket('social-media', { public: true })`, varsa idempotent atla. Beklenen: bucket mevcut.
- [ ] **Step 5: Doğrula** — DB'de `social_%` tabloları listelenir; bucket listelenir.
- [ ] **Step 6: Commit** — `feat(sosyal-medya): DB şeması + Storage bucket`.

---

### Task 2: lib/social çekirdek tipleri + store

**Files:**
- Create: `lib/social/types.ts`
- Create: `lib/social/store.ts`

**Interfaces:**
- Produces tipler: `SocialFormat = 'feed'|'reels'|'story'`, `SocialPostStatus`, `SocialProject`, `SocialScheduledPost`, `SocialPostTarget`, `SocialPostMedia`, `SocialPostWithRelations`.
- Produces fonksiyonlar:
  - `listProjects(userId): Promise<SocialProject[]>`
  - `createProject(userId, {name, color, businessScope?}): Promise<SocialProject>`
  - `updateProject(userId, id, patch): Promise<boolean>`
  - `archiveProject(userId, id): Promise<boolean>`
  - `listPostsInRange(userId, {from, to, projectId?, format?}): Promise<SocialPostWithRelations[]>`
  - `getPost(userId, id): Promise<SocialPostWithRelations | null>`
  - `createPost(userId, input): Promise<SocialPostWithRelations>` (post + targets + media tek transaction-benzeri insert)
  - `updatePost(userId, id, patch): Promise<boolean>` (yalnız `draft|scheduled|failed` durumda)
  - `cancelPost(userId, id): Promise<boolean>` (status→`cancelled`)
  - `claimDuePosts(limit): Promise<SocialPostWithRelations[]>` (cron: `status='scheduled' AND scheduled_at<=now()` → atomik `publishing`)
  - `markPostPublished(id, targets): Promise<void>`
  - `markPostFailed(id, error, nextRetryAt|null): Promise<void>`

- [ ] **Step 1: types.ts yaz** — spec §4'teki tüm alanlar; satır tipleri DB ile birebir.
- [ ] **Step 2: store.ts yaz** — `supabase` client ile; claim atomik (koşullu update `.eq('status','scheduled')`); listPostsInRange targets+media join (ayrı sorgu + map).
- [ ] **Step 3: Build doğrula** — `npx tsc --noEmit` (veya `npm run build` bir sonraki task'ta). Tip hatası yok.
- [ ] **Step 4: Commit** — `feat(sosyal-medya): tipler + veri erişim katmanı`.

---

### Task 3: lib/social/metaPublisher (user-id parametreli yayın)

**Files:**
- Create: `lib/social/metaPublisher.ts`

**Interfaces:**
- Consumes: `getMetaConnection(userId)` ([lib/metaConnectionStore.ts]), `getPageAccessToken(userToken, pageId)` ([lib/meta/pageToken.ts]), `MetaGraphClient` ([lib/meta/client.ts]), `META_GRAPH_VERSION` ([lib/metaConfig.ts]).
- Produces: `publishToTarget(userId, { platform, pageId, igUserId, format, mediaUrl, mediaType, caption }): Promise<{ ok: boolean; publishedId?: string; error?: string }>`.

- [ ] **Step 1: metaPublisher.ts yaz** — IG mantığı (container→poll→publish, [instagram/route.ts] kopyası) + FB mantığı (photo/video/reels 3-phase, [facebook/route.ts] kopyası), ama `userId`'den token (`getMetaConnection`). `story` → IG `STORIES` / FB feed (FB story yok → feed'e düş veya hata). Cookie KULLANMA.
- [ ] **Step 2: Build doğrula** — tip hatası yok.
- [ ] **Step 3: Commit** — `feat(sosyal-medya): user-id parametreli Meta publisher`.

---

### Task 4: Yayın worker + cron

**Files:**
- Create: `lib/social/runScheduledPosts.ts`
- Create: `app/api/cron/social-publish/route.ts`
- Modify: `vercel.json` (cron ekle)

**Interfaces:**
- Consumes: `claimDuePosts`, `markPostPublished`, `markPostFailed` (Task 2), `publishToTarget` (Task 3).
- Produces: `runScheduledPosts(limit?): Promise<{ published: number; failed: number; total: number }>`.

- [ ] **Step 1: runScheduledPosts.ts yaz** — due postları claim et; her post için her target'a `publishToTarget`; tüm target ok → `markPostPublished`; biri fail → `attempts++`, retry<3 ise `next_retry_at = now + backoff` & status geri `scheduled`, yoksa `failed`. (Not: claim `publishing` yaptı; başarısızlıkta status'u tekrar `scheduled` veya `failed` yap.)
- [ ] **Step 2: Cron route yaz** — `CRON_SECRET` Bearer auth, `maxDuration=60`, `runScheduledPosts(25)` çağır, sonuç JSON.
- [ ] **Step 3: vercel.json'a ekle** — `{ "path": "/api/cron/social-publish", "schedule": "* * * * *" }` (mevcut crons dizisine APPEND).
- [ ] **Step 4: Build doğrula.**
- [ ] **Step 5: Commit** — `feat(sosyal-medya): zamanlanmış yayın worker + cron`.

---

### Task 5: API route'ları (projects, posts, media upload)

**Files:**
- Create: `app/api/social/projects/route.ts` (GET liste, POST oluştur)
- Create: `app/api/social/projects/[id]/route.ts` (PATCH, DELETE→archive)
- Create: `app/api/social/posts/route.ts` (GET range, POST oluştur)
- Create: `app/api/social/posts/[id]/route.ts` (GET, PATCH, DELETE→cancel)
- Create: `app/api/social/media/upload/route.ts` (POST multipart → Storage)
- Create: `app/api/social/targets/route.ts` (GET — bağlı IG/FB hesapları; targets route mantığı)

**Interfaces:**
- Consumes: store fonksiyonları (Task 2), `getCurrentUser`/`readUserId`, `chargeFeature` (subscription guard), Supabase Storage.
- Produces HTTP: `/api/social/*` JSON `{ ok, data|error }`.

- [ ] **Step 1: projects route'ları** — auth + abonelik guard; store CRUD.
- [ ] **Step 2: posts route'ları** — GET `?from&to&projectId&format`; POST validation (format↔mediaType, scheduled_at gelecekte, en az 1 target, en az 1 media).
- [ ] **Step 3: media/upload route** — multipart parse, boyut limiti (örn. 50MB), Storage'a yükle, `{ publicUrl, storagePath, width?, height? }` döndür. `maxDuration` uygun.
- [ ] **Step 4: targets route** — `getMetaConnection(userId)` → user token → `/me/accounts` (targets/route mantığı, user-id'li). Bağlı sayfalar + IG hesapları.
- [ ] **Step 5: Build doğrula.**
- [ ] **Step 6: Commit** — `feat(sosyal-medya): API route'ları`.

---

### Task 6: Billing + nav + routes + i18n kayıtları

**Files:**
- Modify: `lib/billing/featureAccessMap.ts` (ekle `social_media_management`)
- Modify: `lib/nav.ts` (ekle nav öğesi)
- Modify: `lib/routes.ts` (ROUTES + SLUG map)
- Modify: `locales/tr.json`, `locales/en.json` (sidebar + dashboard.sosyalmedya.*)

- [ ] **Step 1: featureAccessMap** — `social_media_management: { tier: 'subscription_required', label, description }`.
- [ ] **Step 2: routes.ts** — `ROUTES.SOCIAL_MEDIA='/sosyal-medya'`; `SLUG_TR_TO_EN['sosyal-medya']='social-media'` + ters.
- [ ] **Step 3: nav.ts** — yeni öğe (Tasarım yakını), lucide ikon (`CalendarClock` veya `Share2`), `href: ROUTES.SOCIAL_MEDIA`.
- [ ] **Step 4: i18n** — `sidebar.sosyalmedya`, `dashboard.sosyalmedya.*` HEM tr HEM en. (SidebarNav'ın i18n key türetme desenine uy — okuyup teyit et.)
- [ ] **Step 5: i18n parity kontrol** — `node scripts/i18n-parity.mjs` (varsa). Eksik key yok.
- [ ] **Step 6: Build doğrula + Commit** — `feat(sosyal-medya): nav, routes, i18n, billing kaydı`.

---

### Task 7: UI — modül iskeleti + hibrit takvim + içerik ekleme

**Files:**
- Create: `app/sosyal-medya/layout.tsx`
- Create: `app/sosyal-medya/page.tsx` (veya `[[...segments]]/page.tsx`)
- Create: `app/sosyal-medya/SocialMediaPage.tsx` (ana client component)
- Create: `components/social/SocialCalendar.tsx` (sol ay ızgarası + sağ gün detayı)
- Create: `components/social/FormatTabs.tsx` (Akış/Reels/Hikaye)
- Create: `components/social/ProjectBar.tsx` (proje seçici + yeni proje)
- Create: `components/social/PostComposerModal.tsx` (içerik ekleme/düzenleme)
- Create: `components/social/PostCard.tsx` (gün detayı kartı, durum rozeti)

**Interfaces:**
- Consumes: `/api/social/*` (Task 5), `frontend-design` skill çıktısı, `useTranslations`, `AccessRequiredModal`.

- [ ] **Step 1: `frontend-design` skill'ini çağır** — modülün görsel tasarımı için (hibrit takvim, composer modal, format sekmeleri, durum rozetleri).
- [ ] **Step 2: layout.tsx** — SidebarNav + AccountApprovalGuard (mevcut modül layout deseni).
- [ ] **Step 3: SocialMediaPage** — Topbar + ProjectBar + FormatTabs + SocialCalendar; veri fetch (`/api/social/posts?from&to`); abonelik kontrolü → `AccessRequiredModal type=subscription` (owner bypass).
- [ ] **Step 4: SocialCalendar** — sol ay grid (gün hücresi önizleme + durum noktası), sağ panel seçili gün saat-saat + "İçerik ekle"; `animate-card-enter`.
- [ ] **Step 5: PostComposerModal** — kaynak (Yükle / Tasarım'dan getir [Faz2 placeholder]) → format → hedef hesaplar (WizardSelect/çoklu) → caption (story'de gizli) → tarih-saat → Planla; düzenleme modu.
- [ ] **Step 6: Durum rozetleri + Tekrar dene** — failed post için retry tetikleyici (`PATCH` status→scheduled, scheduled_at=now).
- [ ] **Step 7: Build doğrula** — `npm run build` temiz.
- [ ] **Step 8: Commit** — `feat(sosyal-medya): UI modülü (takvim + composer)`.

---

### Task 8: Uçtan uca doğrulama + finalize

- [ ] **Step 1: `npm run build`** — temiz geçer.
- [ ] **Step 2: DB doğrulama** — örnek bir post insert→claim→status akışı (script veya manuel) mantığını gözden geçir.
- [ ] **Step 3: CHANGELOG.md güncelle.**
- [ ] **Step 4: Geçici scriptleri temizle/gizle** (CLAUDE.md gizleme kuralı — teknik dosyalar).
- [ ] **Step 5: Final commit + push** branch'e.
- [ ] **Step 6: Kullanıcıya özet + yapması gerekenler** (Vercel cron deploy, Storage bucket onayı, gerekirse env).

---

## Self-Review Notları

- **Spec coverage:** §3 zamanlama→Task4; §4 veri modeli→Task1-2; §5 medya→Task1,5; §6 UI→Task7; §7 erişim→Task6; §8 entegrasyon→Task3-4; §9 i18n/nav→Task6; §11 paralel→Global Constraints.
- **Story hedefi:** Facebook'ta organik "Story" Graph API ile sınırlı; MVP'de Hikaye yalnız Instagram hedeflerinde tam çalışır, FB hedefi seçilirse feed'e düşülür veya UI'da FB+story kombinasyonu engellenir (Task3 Step1 + Task7 Step5).
- **Carousel:** MVP tek medya; şema çoklu medyaya hazır (Task1).
- **Tasarım'dan getir:** UI'da yer alır, tam aktarım Faz 2 (Task7 Step5).
