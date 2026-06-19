# YoAi — Promake-benzeri AI Website Builder (Deploy + Visual Edit + Kredi + Hata-Telafi)
## ✅ ONAYLANAN KARARLAR (sahip onayı — 2026-06-18)
1. ÜRETİM MODELİ = HİBRİT. Ana yapı: component-library + JSON-blueprint. Serbest-HTML motoru KALDIRILMAZ — yalnız özel tasarım / özel component / yüksek kredi / Pro-Ajans. MVP kalite+hız+maliyet için component-library ANA yapı. Anti-clone: variant + seed + theme token + layout permütasyon + section kompozisyon.
2. YAYINLAMA MODELİ = tek-YoAi-uygulaması DB-servisi + markalı *.preview.<marka> wildcard (MVP), tenant/site_id bazlı. GitHub+Vercel+kod indirme YALNIZ Pro/Ajans.
3. İMPLEMENTASYON: sahip "şu an başlama" dedi → KOD YAZILMADI, onay bekliyor. Onayda ilk taş = component-library variant kataloğu (lib/website/components/).

---

## MASTER TEKNIK PLAN — uygulama oncesi, ONAY BEKLIYOR (kod yazilmadi)
- Tarih: 2026-06-18 · Durum: PLAN · Calisma alani: worktree-web-site-yoneticisi-codegen

---

# A) MIMARI · RISKLER · YOL HARITASI · UYGULAMA SIRASI (Bolum 1,2,3,16,17)
Bu kapsamlı bir mimari plan görevi. Analiz girdilerini okudum; istenen bölümleri (1, 2, 3, 16, 17) somut, dosya referanslı ve kesin kurallara uyumlu şekilde yazıyorum.

---

# YoAi Web Site Yöneticisi — Promake-Benzeri AI Website Builder: Teknik Plan (Bölüm 1, 2, 3, 16, 17)

## BÖLÜM 1 — MEVCUT PROJE ANALİZ ÖZETİ

Bu modül **sıfırdan başlamıyor**: bu oturumda `web-site-yoneticisi-codegen` worktree'sinde tam işlevsel bir serbest-HTML üretim motoru kuruldu. Aşağıda her katmanın mevcut durumu ve bağlanma noktaları özetlenir.

### 1.1 Auth / Onay
- **Signed user cookie** — `lib/auth/userCookie.ts`: `user_id = ${id}.${hmac(id)}` (HMAC-SHA256), `readUserId()` taklit değerleri reddeder.
- **Manuel onay akışı** — `lib/auth/accountApproval.ts`: `signups.approval_status` (`pending|approved|rejected|call_scheduled|...`). İç panellere erişim `approved` ister; `isAccountApprovedForPanel()`.
- **Owner allowlist** — `SUPER_ADMIN_EMAILS` (default `onursuay@hotmail.com`), `lib/admin/superAdmin.ts` → `getIsCurrentUserSuperAdmin()`. Owner kredi/abonelik/profil guard'larını bypass eder.

### 1.2 Payment (İyzico)
- `app/api/billing/iyzico/start/route.ts` → checkout (server-side fiyatlama, `createPendingTransaction`, token bağlama).
- `app/api/billing/iyzico/callback/route.ts` → **atomik** `markTransactionSucceeded()` (WHERE status='pending', yarış güvenli) + ayrı try/catch'te grant. Grant başarısız → `grant_status='failed'` + `?payment=success&reason=activation_pending` (çift ödeme riski yok).
- Tablo: `payment_transactions` (`item_type`, `grant_status: pending|granted|failed`, `raw_init/raw_callback`).
- Katalog: `lib/billing/catalog.ts` (kredi paketleri), `lib/subscription/plans.ts` (planlar).

### 1.3 Credit (atomik ledger)
- Tablolar: `credit_balances` (`balance|total_earned|total_spent`), `credit_transactions` (değişmez ledger: `delta|reason|balance_after`).
- RPC (atomik): `add_credits / spend_credits (WHERE balance>=amount) / refund_credits` — `20260521000000_billing_atomic_credits_and_ledger.sql`.
- Guard: `lib/billing/featureGuard.ts` → `chargeFeature({ featureKey, creditCost, requireSubscription? })` → `{ ok, isOwner, spent, refund() }`. Owner bypass `spent=0`.
- Website sabitleri: `lib/website/credits.ts` — `base:40`, `perExtraPage:15`, `WEBSITE_REVISION_COST:10`, `WEBSITE_FREE_REVISIONS:3`; `computeGenerationCost({siteType,pageCount,localeCount}) = (40 + (pageCount-1)*15) * localeCount`.

### 1.4 Dashboard / Sidebar / Route
- Shell: `app/dashboard/layout.tsx` (SidebarNav 260/72px + MainContent). İçerik yüzeyi `.app-content-surface` (emerald gradient), `app/globals.css:18-20`.
- Nav: `lib/nav.ts` — "Web Site Yöneticisi" `/web-site-yoneticisi`. Dinamik: **Gözetim Merkezi** (`SidebarNav.tsx:14-48`, `/api/admin/me` → `hasAccess`).
- Topbar: `components/Topbar.tsx` (title/description + ticker + account switcher + actionButton).
- UI standardı: `max-w-7xl mx-auto`, başlık `text-base font-semibold`, `animate-card-enter`, amber/sarı YASAK, i18n zorunlu (`locales/tr.json` + `en.json`).

### 1.5 DB
- `websites` (id, user_id, label, subdomain UNIQUE, site_type, default_locale, locales[], status `draft|published|unpublished`, theme JSONB, published_version_id) — `20260614120000`.
- `website_pages` (website_id FK CASCADE, locale, slug, page_role, sections JSONB, **html TEXT**, **format `sections|html`**, seo JSONB, order_index) — `+20260617120000`.
- `website_versions` (snapshot JSONB, reason `initial|revision|rollback`, credit_charged).
- RLS: `*_own` policy'ler (user_id veya FK üzerinden). Migration adlandırma: `YYYYMMDDHHMMSS_snake.sql`, ASCII-only.

### 1.6 Component / Create Modal
- `components/website/CreateSiteWizard.tsx` (tek ekran): siteAdı, siteType (`multipage|landing`), fontPairing, siteStyle (6 preset), mobileMenuAnim (`left|right|top`), locales[] (tr zorunlu), instructions + dictate, logo, 3 referans URL, dataSourcePriority (`reference|manual`). → POST `/api/website` → logo PUT → navigate `/web-site-yoneticisi/{id}?create={ai|quick}`.
- Detay/preview: `app/web-site-yoneticisi/[id]/page.tsx`, `app/website-preview/[id]/page.tsx` (owner-only iframe, sandbox).

### 1.7 Mevcut Website Motoru (bu oturumda kuruldu)
- **4 aşamalı codegen** `lib/website/codegen/*` (`WEBSITE_CODEGEN_V2='1'`): buildCodegenContext (Stage 0, cross-business sızıntı koruması + untrusted kapsül) → designSystem (Opus, sayısal CSS sistemi) → multipagePlan (Opus, 3–6 sayfa) → htmlGenerate (Opus, raw HTML).
- **Cerrahi patch** (PATCH sistemi zaten var): `patchPlanner.ts` (Sonnet: edit → ops) → `blockMap.mjs` (id-bazlı blok haritası + offset) → `applyBlockPatch.ts` (edit/insert/delete/move, fail → full regen).
- **Güvenlik kapısı**: `sanitizeHtml.ts` + `sanitizeAllowlist.mjs` (deny-by-default) → `renderGate.mjs` (SEO/OG/CSP/print) → `assembleDocument.ts/mjs` → `tailwindCompile` (per-site CSS) → `translateHtml` (multi-locale).
- **Servis**: `app/(sites)/s/[subdomain]/route.ts` (dual-read html/sections), `[slug]/route.ts`, `lead/route.ts` (honeypot + rate-limit + `notifySiteOwnerOfContact`). Provider'sız çıplak HTML, `SITE_CSP`.
- **Generate akışı**: `app/api/website/[id]/generate/route.ts` (sahiplik → `chargeFeature` → generate → replacePages → createVersion → hata = refund).

### 1.8 Deployment (mevcut model)
- **Tek YoAi Vercel uygulaması, DB-servisi**: tüm siteler `GET /s/<subdomain>` üzerinden tek Next.js instance'ından servis edilir.
- Custom domain altyapısı **hazır ama default-OFF**: `middleware.ts:85-105` (`WEBSITE_CUSTOM_DOMAINS='1'`), `lib/website/edgeConfig.ts` (Edge Config `cd_<host>` map), `lib/website/vercelDomain.ts` (Vercel Domains API: A 76.76.21.21 / CNAME cname.vercel-dns.com).
- **GitHub/Vercel kullanıcıya görünmüyor** — zaten DB-servis modelinde gizli.

### 1.9 E-posta / CRM / Ekosistem
- `lib/website/contactNotify.ts` — Resend (`FROM_EMAIL`, `RESEND_API_KEY`), `notifySiteOwnerOfContact` (owner = `signups.email`).
- Gözetim Merkezi bildirim: `lib/yoai/watchdog/notify.ts` (`notification_log` tablosu).
- CRM köprüsü: Meta webhook → `lib/crm/metaLeadIngest.ts` → `crm_leads` → `syncLeadToContact` → `email_contacts`. Upsell route'ları `lib/routes.ts`.

---

## BÖLÜM 2 — RİSKLİ / EKSİK NOKTALAR (mevcut yapıyla çatışmalar)

| # | Risk / Eksik | Mevcut durum | Çatışma / Etki | Önlem |
|---|---|---|---|---|
| R1 | **Kredi tahmini create-modal'da gösterilmemeli** | `CreateSiteWizard` kredi göstermiyor (iyi), ama `computeGenerationCost` ilk üretimde topluca düşülüyor | Kural: tüketim **işlem sırasında adım-adım**. Şu an tek atımlık charge. | Generate'i adım bazlı charge'a böl (Bölüm 3.i'de). Modal'da hiçbir kredi metni eklenmeyecek. |
| R2 | **Dashboard'a sıkışmış dar önizleme YOK** | `app/website-preview/[id]/page.tsx` owner-only iframe; detayda da iframe gösteriliyor olabilir | Kural: yeni sekmede markalı preview URL. İframe-içi dar görünüm kuraldışı. | Detay sayfasındaki gömülü iframe'i "Yeni sekmede önizle" markalı URL'ye çevir; iframe sadece thumbnail/opsiyonel kalsın. |
| R3 | **.vercel.app asla gösterilmemeli** | DB-servis modelinde zaten `/s/<sub>`; ama preview için wildcard kurulmamış | Per-site Vercel modeli seçilirse `*.vercel.app` sızıntı riski yüksek. | Preview için markalı wildcard `*.preview.<marka>` kur (Bölüm 3.ii). Per-site modeli MVP'de seçilmez. |
| R4 | **Anti-clone yok** | designSystem + htmlGenerate serbest-HTML üretiyor; component-library/variant kompozisyonu yok | Prompt: siteler birbirinin kopyası olmayacak + AI her şeyi sıfırdan kodlamasın. İki kural gerilimde. | Hibrit: component-library + variant seed (Bölüm 3.i). |
| R5 | **"Kod Hatası" / telafi / hata-bildir akışı YOK** | Sadece `applyBlockPatch` fail → full regen; kullanıcıya hata-onarım UI'ı yok | Prompt'un en kritik UX zinciri eksik (kredi düşmeyen onarım, 2. deneme, kırmızı "Hata Bildir", Gözetim Merkezi'ne düşme). | Yeni `website_error_reports` + `website_repair_attempts` tabloları + onarım endpoint'i + admin entegrasyonu (Bölüm 16 Faz 2). |
| R6 | **Mobil header/hamburger kalite garantisi yok** | htmlGenerate AI üretimi; saydam/açık-kalma/kapat-iconu bug'ları kontrol edilmiyor | Prompt kesin kuralı: şeffaf değil + okunabilir + aç/kapa + kapat-iconu + açık-kalma bug'ı YOK. | Header component-library variant'ı **sabit/test edilmiş** olacak (AI üretmeyecek), `renderGate` invariant kontrolü ekle. |
| R7 | **Header/footer başlık satır kayması** | AI üretimi; nav item taşması test edilmiyor | Prompt: PC/tablet/mobilde alt satıra kaymayacak. | Nav/footer için `white-space:nowrap` + overflow stratejisi component-library'de zorunlu; renderGate doğrulaması. |
| R8 | **Footer yılı** | AI üretimi sabit yıl yazabilir | Prompt: 2026/current. | assembleDocument'te footer yılı **server-side** enjekte edilecek (AI'a bırakılmaz). |
| R9 | **Cross-business profil sızıntısı** | `buildCodegenContext` site-scoped (iyi) | SEO tarafındaki "yanlış firma" hatasının website'te tekrarı riski | Mevcut site-scoped öncelik korunacak; component-library içerik doldurma da site brief'inden gelecek. |
| R10 | **Meta/Google'a dokunma yasağı** | generate akışı `chargeFeature` kullanıyor (ortak) | `lib/meta/*`, `lib/google/*` değişmez | Tüm website değişiklikleri `lib/website/*` + `lib/billing/*` (ortak guard, dokunulmaz çekirdek) içinde kalacak. |
| R11 | **PATCH yerine full regen riski** | `applyBlockPatch` fail → full regen | Prompt: her revizede tüm site yeniden üretilmesin | Patch fail durumunda **sadece ilgili sayfayı/bloğu** regen et; tam-site regen yalnız son çare + version snapshot. |
| R12 | **Visual editing MVP'de yok** | Sadece chat-edit var | Prompt: visual editing MVP'de | Seçili-alan tıklama → blockMap id eşleme → PATCH (Bölüm 16 MVP). Altyapı (`blockMap.mjs`) hazır, UI eksik. |
| R13 | **DB migration çakışması** | aynı dakika dosya adı çakışır | Yeni tablolar eklenecek | Saniye-precision + +1s offset, ASCII isim. |

---

## BÖLÜM 3 — ÖNERİLEN MİMARİ (iki kritik çatallanma kararı)

### 3.(i) ÜRETİM MODELİ — KARAR: **HİBRİT (component-library + JSON-blueprint, serbest-HTML motorun ÜSTÜNE)**

**Karar net:** Prompt'un istediği **component-library + JSON-blueprint** modeli **ana yapı** olur; bu oturumda kurulan **serbest-HTML motoru korunur ve altta kalır** (özgünlük/ekstra kredi katmanı). Anti-clone, **component-variant kompozisyonu** ile sağlanır.

**Gerekçe:**
1. Prompt iki şey istiyor: "AI her şeyi sıfırdan kodlamasın" (→ template/component library) **ve** "siteler birbirinin kopyası olmasın" (→ dinamik kompozisyon). Saf serbest-HTML (R4) her seferinde sıfırdan kodlar (pahalı, tutarsız, mobil/header kalite garantisi yok — R6/R7). Saf statik template ise klon üretir. **Hibrit ikisini de çözer.**
2. Mevcut motorun değerli parçaları (sanitize, renderGate, blockMap, patchPlanner, assembleDocument, translateHtml, tailwindCompile) **aynen kullanılabilir** — blueprint katmanı bunların önüne girer, arkasını bozmaz.

**Mimari (yeni katman → mevcut motora bağlanma):**

```
Stage A — BLUEPRINT (yeni, Opus)
  designSystem.ts (mevcut, Stage 1) + multipagePlan.ts (mevcut, Stage 2)
  → ek çıktı: blueprint JSON
     { page: { sections: [{ type:'hero', variantId:'hero-split-A', seed, contentRefs }, ...] } }
  type'lar: lib/website/codegen/types.ts'e Blueprint eklenir

Stage B — COMPONENT LIBRARY (yeni)
  lib/website/components/  (yeni klasör — mevcut htmlGenerateShared.mjs blok üreticileri
  buraya VARIANT'lara dönüştürülür: her section type için 4-8 varyant + parametre)
  - hero: hero-split-A/B, hero-centered-A/B, hero-image-bg-A...
  - header (SABİT, test edilmiş — R6/R7 invariant): nowrap nav, hamburger aç/kapa + kapat-icon, opak bg
  - footer (yıl server-side — R8)
  - services/features/testimonial/cta/contact/gallery...
  variant seçimi: blueprint.variantId; içerik: designSystem token + site brief

Stage C — KOMPOZİSYON (anti-clone)
  composeBlueprint(blueprint, designSystem, brand) → raw HTML
  Anti-clone: (variant permütasyonu) × (designSystem renk/font/spacing seed)
              × (section sırası/yoğunluk) → kombinatoryal benzersizlik
  Aynı sektör 2 site → farklı variantId seti + farklı seed → görünür farklı

[BURADAN İTİBAREN MEVCUT MOTOR — DEĞİŞMEZ]
  → sanitizeHtml → renderGate (+ yeni invariant kontroller: header opak,
    nav nowrap, footer yıl, mobil menü kapanır) → assembleDocument
  → tailwindCompile → translateHtml

SERBEST-HTML KATMANI (korunur, ekstra kredi):
  "Özgün tasarım" / "tam serbest" istenirse htmlGenerate.ts (mevcut Stage 3)
  doğrudan devreye girer — blueprint'i atlar. Bu yol ekstra kredi düşer.
```

**Mevcut işin eşleşmesi:**
- `htmlGenerateShared.mjs` (48KB blok üreticileri) → **component-library variant'larının kaynağı** (yeniden yazılmaz, variant'lara parçalanır).
- `blockMap.mjs` / `patchPlanner.ts` / `applyBlockPatch.ts` → blueprint section id'leri ile **birebir uyumlu** (PATCH sistemi zaten id-bazlı).
- `designSystem.ts` → blueprint seed'inin renk/font/spacing kaynağı (anti-clone'un yarısı).
- Serbest-HTML motoru hiç silinmez → "ekstra kredi ile özgün tasarım" feature'ı olarak satılır.

---

### 3.(ii) YAYINLAMA MODELİ — KARAR: **MEVCUT DB-SERVİSİ (MVP), per-site GitHub+Vercel Pro/Ajans için saklanır**

**İki seçenek net karşılaştırma:**

| Boyut | Seçenek A: DB-Servis (mevcut) | Seçenek B: Site-başına GitHub repo + Vercel projesi |
|---|---|---|
| Altyapı | 1 Vercel projesi, tüm siteler `/s/<sub>` | Site başına repo + proje + deploy |
| Maliyet | ~$20/ay sabit | 100 site ≈ $2000/ay Vercel Pro + repo kotası |
| Ölçek | 10.000+ site (DB I/O) | ~1000 proje soft-limit; GitHub org ~10 repo |
| Deploy hızı | 1-2 dk (tek build) | 15+ dk (6 eşzamanlı build kuyruğu) |
| GitHub token riski | Tek repo, minimal | Tek token = 100+ repo üzerinde tam yetki (blast-radius) |
| Secrets | Tek set | ANTHROPIC/SUPABASE × 100 proje rotasyonu |
| Domain bağlama | Edge Config + middleware (hazır) | Vercel project settings (per-site) |
| **.vercel.app gizleme** | **Doğal — kullanıcı görmez** | **Sızıntı riski yüksek (her proje kendi vercel.app)** |
| Kullanıcı "kod indir/sahipli repo" | Yok | Var (Pro/Ajans değer önerisi) |
| Ops/izleme | Tek dashboard | 100 proje log/analytics dağınık |

**KARAR — net öneri:**
- **MVP + Faz 2 → Seçenek A (DB-Servis).** Kesin kurallarla (kullanıcı Vercel/GitHub görmeyecek, `.vercel.app` gösterilmeyecek) **birebir uyumlu**, en ucuz, en hızlı, en güvenli. Mevcut `/s/<sub>` + custom-domain rewrite zaten kurulu.
- **Markalı preview wildcard** kurulur: `*.preview.<marka-domain>` → middleware rewrite `/s/<sub>` (R3 önlemi). Yeni sekmede açılan URL bu olur — `.vercel.app` asla görünmez.
- **Custom domain MVP sonrası** (Türkiye için **manuel DNS ana akış**): kullanıcıya A/CNAME kayıtları gösterilir, "Doğrula" butonu (`lib/website/vercelDomain.ts:checkDomainConfig`). Domain **satın alma** Faz 2+.
- **Seçenek B (per-site GitHub+Vercel) → Pro/Ajans tier için saklanır:** yalnızca "kod indirme / sahipli repo / kendi Vercel hesabı" isteyen enterprise müşteri için, opt-in, müşteri kendi öder. MVP'de **kurulmaz** (maliyet + blast-radius + .vercel.app sızıntısı).

**Mevcut işin eşleşmesi:** `middleware.ts:85-105`, `edgeConfig.ts`, `vercelDomain.ts` zaten Seçenek A için yazılmış → MVP'de sadece wildcard preview DNS + Domain Panel UI eklenecek; çekirdek hazır.

---

## BÖLÜM 16 — YOL HARİTASI (MVP / Faz 2 / Faz 3)

Prompt'un faz listesiyle hizalı; **"zaten yapıldı" düşülerek**.

### ✅ ZATEN YAPILDI (bu oturum — tekrar yapılmayacak)
4-aşamalı codegen motoru, sanitize/renderGate/CSP, blockMap+patchPlanner+applyBlockPatch (PATCH altyapısı), assembleDocument, translateHtml, tailwindCompile, dual-format servis (`/s/<sub>`), iletişim formu + owner email, cross-business koruması, create-modal, kredi/refund entegrasyonu, custom-domain altyapısı (default-OFF).

### MVP (Faz 1)
1. **Component-library + blueprint katmanı** (Bölüm 3.i) — `htmlGenerateShared.mjs` blokları → variant'lara; `composeBlueprint`; anti-clone seed.
2. **Sabit/test edilmiş header + footer variant'ları** — mobil hamburger (opak, aç/kapa, kapat-icon, açık-kalma bug'ı YOK — R6), nav/footer nowrap (R7), footer yılı server-side current (R8).
3. **Create-modal → generation aktif bağlama** (modal KORUNUR; alanlar blueprint'e map'lenir). Kredi metni eklenmez (R1).
4. **Adım-adım kredi tüketimi** — generate akışını sayfa/locale bazlı charge'a böl; modal'da tahmin yok.
5. **Yeni sekmede markalı preview URL** + wildcard `*.preview.<marka>` DNS (R2/R3). Dashboard'da dar iframe kaldırılır.
6. **Visual editing (seçili-alan PATCH)** — iframe'de tıklama → blockMap id → PATCH (R11/R12). Her revizede tüm site regen edilmez.
7. **renderGate invariant kontrolleri** — header opak/nav nowrap/footer yıl/mobil menü kapanır doğrulaması.

### Faz 2
8. **"Kod Hatası" → AI onarım zinciri** (R5):
   - "Kod Hatası" butonu → AI onarım (kredi **DÜŞMEZ**).
   - Başarılı → popup AYNEN: *"Harika sorun düzeltilmiştir. Üstelik bu düzenleme için sizden ekstra kredi bakiyesi düşülmemiştir."*
   - 2. AI denemesi de başarısız → "Kod Hatası" butonu → kırmızı **"Hata Bildir"**.
   - "Hata Bildir" popup AYNEN: *"Sorunu teknik ekibimize ilettik en kısa sürede gerekli düzenlemeleri yapıp, kayıt olduğunuz mail adresi üzerinden size geri bildirimde bulunulacaktır."*
   - Kayıt → **Gözetim Merkezi**: ekran görüntüsü + log + metadata + AI deneme geçmişi.
   - Yeni tablolar: `website_error_reports`, `website_repair_attempts`.
9. **Admin onarım entegrasyonu** — admin düzeltmeyi müşteri paneline entegre eder → redeploy/verify → kayıtlı mail bilgilendirme (Resend, mevcut `contactNotify` deseni).
10. **Custom domain (manuel DNS ana akış)** — Domain Panel UI + A/CNAME gösterimi + Doğrula. `WEBSITE_CUSTOM_DOMAINS='1'`.
11. **Gözetim Merkezi website sekmesi** — error reports + repair attempts + KPI (`GozetimMerkeziClient.tsx`).

### Faz 3
12. **Domain satın alma** (registrar entegrasyonu).
13. **Per-site GitHub+Vercel (Pro/Ajans)** — kod indirme / sahipli repo / kendi Vercel hesabı; opt-in enterprise.
14. **E-ticaret/form/ürün tabloları** (`website_products/orders/forms`), ISR cache (`WEBSITE_ISR='1'`).
15. **Ekosistem upsell** — site yayını sonrası CRM/Email/Ads modüllerine yönlendirme kartları.

---

## BÖLÜM 17 — UYGULAMA SIRASI (bağımlılıklar, ilk taş)

**İlk taş:** Component-library variant kataloğu (R4/R6/R7'nin kökü; her şey buna dayanır).

```
1. [DB] Migration — website_error_reports + website_repair_attempts
        (Faz 2'de kullanılır ama şemayı erken sabitle; çakışmayı önle — R13)
        Bağımlılık: yok. ASCII isim, +1s offset.

2. [Library] lib/website/components/ — variant kataloğu
        2a. header variant (SABİT, test edilmiş): opak bg, nowrap nav,
            hamburger aç/kapa + kapat-icon, açık-kalma bug yok (R6/R7)
        2b. footer variant: server-side current yıl (R8)
        2c. hero/services/features/testimonial/cta/contact/gallery variant'ları
            (htmlGenerateShared.mjs bloklarından türetilir)
        Bağımlılık: yok. ← İLK İŞ.

3. [Blueprint] lib/website/codegen/types.ts → Blueprint type
        + designSystem.ts/multipagePlan.ts blueprint çıktısı
        + composeBlueprint() (anti-clone seed)
        Bağımlılık: (2).

4. [Gate] renderGate.mjs → invariant kontroller
        (header opak / nav nowrap / footer yıl / mobil menü kapanır)
        Bağımlılık: (2),(3). Mevcut sanitize→assemble zinciri DEĞİŞMEZ.

5. [Generate] app/api/website/[id]/generate/route.ts
        → blueprint yolu varsayılan; serbest-HTML yolu (ekstra kredi) korunur
        → adım-adım kredi charge (R1)
        Bağımlılık: (3),(4). chargeFeature (ortak guard) DEĞİŞMEZ.

6. [Modal] CreateSiteWizard alanları → blueprint map
        (modal KORUNUR, kredi metni eklenmez)
        Bağımlılık: (5).

7. [Preview] Wildcard *.preview.<marka> DNS + middleware rewrite
        + "Yeni sekmede önizle" markalı URL; dar iframe kaldır (R2/R3)
        Bağımlılık: (5). middleware.ts custom-domain bloğu paterni.

8. [Visual edit] iframe tıklama → blockMap id → PATCH UI
        (seçili-alan, full regen YOK — R11/R12)
        Bağımlılık: (5),(7). blockMap.mjs/patchPlanner zaten hazır.

— MVP biter —

9. [Onarım] "Kod Hatası" → AI onarım (kredi düşmez) → telafi popup
        → 2. deneme fail → kırmızı "Hata Bildir" → hata-bildir popup
        → website_error_reports + repair_attempts kaydı
        Bağımlılık: (1),(8).

10. [Admin] Gözetim Merkezi website sekmesi + admin onarım entegrasyonu
         → redeploy/verify → kayıtlı mail bilgilendirme (Resend)
         Bağımlılık: (9). GozetimMerkeziClient.tsx + contactNotify deseni.

11. [Domain] Manuel DNS Domain Panel UI + Doğrula
         Bağımlılık: edgeConfig.ts/vercelDomain.ts (hazır). WEBSITE_CUSTOM_DOMAINS='1'.

— Faz 2 biter; Faz 3: domain satın alma → per-site GitHub+Vercel → e-ticaret —
```

**Kesin kural uyumu (özet checklist):** Vercel/GitHub gizli ✓ (DB-servis) · `.vercel.app` yok ✓ (wildcard preview) · dar iframe yok ✓ (adım 7) · modal'da kredi tahmini yok ✓ (R1) · template+component ana yapı ama klon yok ✓ (3.i hibrit + anti-clone) · visual editing MVP ✓ (adım 8) · PATCH sistemi ✓ (mevcut + adım 8) · domain satın alma MVP sonrası ✓ (Faz 3) · manuel DNS ✓ (adım 11) · mobil header kalite + nowrap + footer yıl ✓ (adım 2,4) · "Kod Hatası"/telafi/hata-bildir metinleri AYNEN ✓ (adım 9) · Gözetim Merkezi'ne düşme + admin entegrasyon + mail ✓ (adım 9,10) · create-modal korunur ✓ (adım 6) · Meta/Google'a dokunulmaz ✓ (R10, tüm iş `lib/website/*`+`lib/billing/*` içinde).

---

**İlgili dosya yolları (load-bearing):**
- Üretim motoru: `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/.claude/worktrees/web-site-yoneticisi-codegen/lib/website/codegen/` (designSystem.ts, multipagePlan.ts, htmlGenerate.ts, blockMap.mjs, patchPlanner.ts, applyBlockPatch.ts, sanitizeHtml.ts, renderGate.mjs, assembleDocument.ts, tailwindCompile.ts, types.ts)
- Yeni eklenecek: `lib/website/components/` (variant kataloğu — ilk taş)
- Kredi/guard: `lib/billing/featureGuard.ts`, `lib/website/credits.ts`
- Generate: `app/api/website/[id]/generate/route.ts`
- Modal: `components/website/CreateSiteWizard.tsx`
- Servis/preview: `app/(sites)/s/[subdomain]/route.ts`, `app/website-preview/[id]/page.tsx`, `middleware.ts:85-105`
- Domain: `lib/website/edgeConfig.ts`, `lib/website/vercelDomain.ts`
- Onarım/admin: yeni `website_error_reports`+`website_repair_attempts` migration, `app/gozetim-merkezi/GozetimMerkeziClient.tsx`, `lib/website/contactNotify.ts`

---

# B) URETIM MOTORU · COMPONENT LIBRARY · DB · API · FRONTEND (Bolum 4,5,6,7,8)
I now have everything I need to write the plan grounded in real names. Writing the final output (Bölümler 4-8).

---

# BÖLÜM 4 — Website Kit / Component Library Planı

## 4.0 Mimari karar: Hibrit (serbest-HTML + Component Library), serbest-HTML omurgada kalır

Mevcut motor (`lib/website/codegen/*`, kilitlenmiş karar #1) **serbest HTML/CSS/JS üretir**; bunu silmiyoruz. Component Library, serbest-HTML üretiminin **üstüne kurulmuş bir prompt + render katmanı** olarak eklenir — ayrı/paralel bir render ağacı değil. Üç entegrasyon noktası:

1. **Üretim girişi (prompt katmanı):** Library = AI için **"design vocabulary"**. `designSystem.ts` (Aşama 1) ve `htmlGenerate.ts` (Aşama 3), kütüphanedeki bileşen/preset/template tanımlarını **örnek/iskelet referansı** olarak `cache_control` prefix içinde alır. AI hâlâ serbest HTML yazar, ama "Navbar variant'ı `centered-logo`, Hero `SplitImage`, ProductCard `compact`" gibi **isimlendirilmiş seçimler** yapar ve bu seçimler `blueprint`'e (Bölüm 5) kaydedilir. Çıktı `format='html'` olarak kalır.
2. **Block kimliği (render + patch katmanı):** Üretilen her üst-düzey bölüm, mevcut `htmlGenerateShared.mjs` + `blockMap.mjs` desenine uygun `data-yoai-block="<componentKey>" data-yoai-id="<id>"` taşır. `componentKey` artık kütüphane kayıt defterindeki bir anahtardır (`navbar.centered`, `hero.split-image`, `product.card.compact`). Böylece chat-patch ve visual edit, "hangi bileşen" sorusuna deterministik yanıt verebilir.
3. **Deterministik fallback (kod katmanı):** renderGate (Aşama 5) başarısız olursa, `lib/website/templates/deterministic.ts` yerine kütüphanenin **kod-içi block üreticileri** (`htmlGenerateShared.mjs` içindeki mevcut hero/services/cta/footer üreticilerinin genişletilmiş hâli) devreye girer → boş/bozuk site asla yayınlanmaz (Bölüm 3, Aşama 5 ilkesi korunur).

Net cümle: **AI sıfırdan kodlamaz; kütüphane ana yapıyı/sözlüğü verir, AI bunları markaya göre serbest HTML olarak birleştirir ve içerikle doldurur** (kilitlenmiş kalite kararı #5 + KESİN KURAL "AI her şeyi sıfırdan kodlamaz").

## 4.1 Component Library (atomik + bileşik blok kataloğu)

Tek kaynak: yeni dosya `lib/website/codegen/library/components.mjs` (`.mjs` çünkü mevcut shared modüller — `htmlGenerateShared.mjs`, `blockMap.mjs`, `verify-website-codegen.mjs` — bunu import edebilmeli; TS sarmalayıcı `lib/website/codegen/library/index.ts` tip + helper sağlar). Her bileşen kaydı:

```
ComponentDef = {
  key: string,            // 'navbar.centered'  → data-yoai-block değeri
  category: string,       // 'navigation' | 'hero' | 'commerce' | 'form' | ...
  blockTag: string,       // 'header' | 'section' | 'footer' | 'nav'
  contentSchema: ZodSchema,   // Bölüm 4.6 — bu bloğun düzenlenebilir içerik alanları
  promptHint: string,     // AI'ya verilen kompozisyon/anti-jenerik direktifi
  deterministicRender(content, ds): string,  // fallback HTML üreticisi
  requiresTier?: 'extra_credit' | 'pro',      // Bölüm 5.6 — özel/premium bileşen
}
```

Katalog (prompt'ta istenen tam liste, kategoriye bölünmüş):

- **Navigasyon/iskelet:** `navbar`, `footer`, `campaign-banner` (üst kampanya bandı), `whatsapp-cta` (sabit float buton).
- **İçerik:** `hero`, `cta`, `services` (hizmetler grid), `gallery`, `faq`, `testimonials` (referanslar), `pricing-table` (fiyat tablosu), `blog` (blog listesi + kart), `maps` (gömülü harita — yalnız `<iframe>` allowlist kuralı gereği statik görsel + link, script değil; CSP `frame-src` açılmaz).
- **Ticaret:** `product-card`, `product-list` (ürün listeleme), `ecommerce-grid` (e-ticaret grid), `cart-drawer` (sepet drawer), `checkout-form`, `order-summary` (sipariş özeti).
- **Form/etkileşim:** `contact-form`, `reservation-form` (rezervasyon).

**Güvenlik notu (KESİN KURAL ile uyum):** `cart-drawer`/`checkout-form`/`reservation-form`/`order-summary` **mock akışlardır** (Bölüm 4.8). Gerçek ödeme/kullanıcı-veri toplama serbest-HTML spec'inde phishing yüzeyi olarak yasaktı (spec Bölüm 1 "YAPMAZ"). Bu nedenle bu bileşenler **görsel + lokal state mock** olarak render edilir; form action yalnız `(sites)` CSP'sinin izin verdiği `form-action 'self'` → mevcut `/s/<subdomain>/lead` benzeri **lead toplama** endpoint'ine bağlanır, ödeme provider'ına değil. Bu, KESİN KURAL "Commerce/Booking mock flows" + güvenlik modelini birlikte sağlar.

Etkileşim (drawer aç/kapa, akordeon, slider, lightbox, sepet adet artır) **yalnız `public/yoai-site-runtime.js`** declarative attribute'ları ile (`data-yoai-toggle`, `data-yoai-reveal`, `data-yoai-cart-add`…) — AI keyfi `<script>` yazmaz (spec Bölüm 4 JS politikası).

## 4.2 Section Presets + variant'lar

Preset = bir bileşenin **isimlendirilmiş kompozisyon varyasyonu**. Kayıt: `lib/website/codegen/library/presets.mjs`.

- **Hero variant'ları:** `HeroMinimal`, `SplitImage`, `FullBackground`, `Slider`, `Ecommerce`, `Hotel`, `ServiceBusiness`, `Luxury`, `Corporate`.
- **Navbar variant'ları:** `centered-logo`, `left-logo-right-cta`, `transparent-overlay`, `mega-menu`, `minimal-burger`.
- **Kart variant'ları:** `ProductCard` (`compact`/`detailed`/`overlay`), `TicketCard` (feribot/etkinlik bileti), `HotelRoomCard`, `ServiceCard`, `PackageCard` (tur/abonelik paketi).

Her preset: `{ key, componentKey, archetype, promptHint, deterministicRender }`. `archetype` alanı, mevcut spec Aşama 2 "layout-arketip planı"na (asimetrik-split, tam-taşma-hero, mozaik-galeri) **birebir bağlanır** — preset seçimi arketip seçimini sürdürür, "ardışık bölüm aynı arketipi tekrar edemez" post-kontrolü preset düzeyinde de uygulanır.

## 4.3 Industry Templates (sektör şablonları)

Kayıt: yeni tablo `website_templates` (Bölüm 6) + tohum verisi `lib/website/codegen/library/industryTemplates.mjs`. Bir template = **sayfa planı iskeleti + preset seçim havuzu + token öneri seti** (sabit içerik DEĞİL — Bölüm 5 dinamik kombinasyonu bozulmaz).

Şablonlar: `otel`, `restoran`, `feribot-bilet`, `klinik`, `ajans`, `e-ticaret`, `kurumsal`, `hizmet-landing`, `rezervasyon`, `egitim`, `gayrimenkul`.

Her template kaydı:
```
IndustryTemplate = {
  key: 'otel',
  defaultPages: PageRole[],           // önerilen sayfa rolleri (home, rooms, gallery, contact...)
  componentPool: { [pageRole]: presetKey[] },  // her sayfa için SEÇİLEBİLİR preset havuzu (rastgele/AI seçer)
  tokenSuggestions: Partial<DesignSystem>,      // palet/font/spacing önerisi (zorunlu değil)
  bookingMode?: 'reservation' | 'ticket' | 'none',
  commerceMode?: 'ecommerce' | 'none',
}
```

`componentPool` **havuzdur, sabit liste değil** — aynı template'ten üretilen iki site farklı preset kombinasyonu alır (Bölüm 5 anti-clone). Sektör eşleşmesi `websites.category` + wizard'daki `siteType`/`instructions`'tan çıkarılır.

## 4.4 Theme / Typography / Spacing tokens

Mevcut `DesignSystem` (Aşama 1, `designSystem.ts`) + `ThemeTokens` (`lib/website/types.ts`) **genişletilir, değiştirilmez.** Token kümesi zaten orada: `primaryColor/secondaryColor/surfaceColor/accentSoftColor` (palet), `fontHeading/fontBody/fontHref` (tipografi), `compiledCssVersion`. Library bunları **kanonik token sözlüğü** olarak kullanır; preset/template `deterministicRender` fonksiyonları yalnız bu token'lardan türetilen Tailwind class'larını (`tailwindCompile.ts` allowlist) üretir — rastgele `indigo-500`/`shadow-md` makine-engellenir (spec Aşama 3). Spacing/radius/gölge ölçekleri `DesignSystem` JSON'ında tutulur (mevcut), library bunlara `var(--site-*)` üzerinden bağlanır (`designVars.ts` deseni). **Yeni migration gerekmez** (theme JSONB).

## 4.5 Content Schema

Her bileşen `contentSchema` (Zod) taşır — bu, hem visual edit (Bölüm 8 RightInspectorPanel) hem chat-patch için **bloğun düzenlenebilir alan sözleşmesidir**. Örnek: `hero.split-image` → `{ heading, subheading, ctaLabel, ctaHref, imageQuery }`. Görseller `{{IMG:query}}` placeholder kalır (AI URL uyduramaz — spec Aşama 3). contentSchema:
- Visual edit'te hangi alanların inline düzenlenebilir olduğunu belirler (`data-yoai-field="heading"`).
- Block snapshot'a `website_versions.snapshot.pages[].blockMap` içine `{ id, componentKey, content }` olarak yazılır (spec Bölüm 7 blockMap genişlemesi).
- renderGate, içerik sözleşmesini doğrular (zorunlu alan boş → repair).

## 4.6 Commerce / Booking mock flows

- **Commerce mock:** `product-list`/`ecommerce-grid` → `website_products` (Bölüm 6) okur; `cart-drawer` + `order-summary` **client-side mock state** (`yoai-site-runtime.js` `data-yoai-cart-*`), sepet localStorage'da, "Sipariş Ver" → `website_orders`'a **lead-benzeri** kayıt + site sahibine mail (mevcut `contactNotify.ts` deseni). Gerçek ödeme yok → CSP/phishing kuralı korunur.
- **Booking mock:** `reservation-form`/`TicketCard` → tarih/kişi seçimi mock, submit → `website_forms` submission + sahip bildirimi. Gerçek envanter/PMS entegrasyonu YAGNI (MVP dışı).

## 4.7 AI Blueprint Generator

`lib/website/codegen/blueprintGenerator.ts` — Aşama 1.5 olarak `designSystem` ile `multipagePlan` arasına girer. Görev: marka bağlamı + seçilen industry template + DesignSystem → **JSON blueprint** üret (Bölüm 5'te detay). Opus 4.8, `cache_control` ile library kataloğu prefix'lenir. Çıktı `multipagePlan.ts`'in zenginleştirilmiş hâlidir (sayfa listesi + her sayfaya preset/archetype atamaları). Mevcut `validatePagePlan` (multipagePlanShared.mjs) genişletilerek blueprint şeması doğrulanır.

## 4.8 Layout Composition Engine

`lib/website/codegen/compositionEngine.mjs` — blueprint'teki preset seçimlerini **anti-jenerik kompozisyon kurallarıyla** dizen deterministik katman: ardışık-arketip-tekrarı engelleme (mevcut spec Aşama 2 post-kontrolü buraya taşınır), bölümler-arası spacing ritmi, hero→sonraki-section kontrast kuralı. `htmlGenerate.ts` bu motorun ürettiği sıralı blok planını alır, her blok için ya AI'dan serbest HTML ister ya da (fallback) `deterministicRender` çağırır.

## 4.9 Anti-clone safeguards

Bölüm 5.4'te detaylandırılır; kısaca: composition engine **deterministik çeşitlilik** (template'ten preset havuzundan farklı kombinasyon seçimi + palet/font rotasyonu) + referans "design DNA" çıkarımının **kopyalama-engelleyici** filtresi. Library bu nedenle "tek doğru render" değil, "havuzdan seçim" modeli kullanır.

---

# BÖLÜM 5 — Dynamic Generation / Anti-clone Planı

## 5.1 JSON Blueprint → hazır component render

Blueprint, üretimin tek kararnamesidir. Şema (`lib/website/codegen/types.ts` içine `SiteBlueprint`):

```
SiteBlueprint = {
  industryTemplateKey: string | null,   // 4.3 (null = serbest)
  designSystem: DesignSystem,            // Aşama 1 çıktısı (palet/font/spacing/motion)
  pages: BlueprintPage[],
}
BlueprintPage = {
  locale, slug, pageRole, orderIndex,
  blocks: BlueprintBlock[],
}
BlueprintBlock = {
  id: string,                 // 'b1' → data-yoai-id
  componentKey: string,       // 'hero.split-image' → data-yoai-block
  presetKey: string,
  archetype: string,
  content: Record<string,unknown>,   // contentSchema'ya uygun, {{IMG:query}} placeholderlı
}
```

Render yolu: `blueprintGenerator` → `compositionEngine` → `htmlGenerate` (her blok serbest HTML, fallback deterministicRender) → `sanitizeHtml` → `renderGate` → `assembleDocument` → `website_pages.html` (`format='html'`) + `blockMap` snapshot. **Mevcut pipeline'a yeni aşama eklenir, sıra korunur.**

## 5.2 Tam dinamik kararlar

Blueprint generator'ın **dinamik** ürettiği (sabit olmayan) her şey:
- **Sayfa sayısı/sırası:** mevcut `multipagePlan` (3..6 sayfa) blueprint'e taşınır; home 1., contact zorunlu kuralı korunur.
- **Layout/section kombinasyonu:** her sayfanın blok dizisi `componentPool`'dan AI + composition engine seçimi.
- **Hero tipi:** 9 hero variant'ından (4.2) seçim.
- **CTA, renk, font, spacing:** DesignSystem'den; her sitede palet/font çifti yeniden türetilir.
- **Menü:** navbar variant + mobil menü davranışı (`mobileMenuAnim` — wizard'dan gelir, korunur).

## 5.3 Aynı sektörde farklı kombinasyon

İki "otel" sitesi, aynı `industryTemplateKey='otel'` ama: composition engine `componentPool`'dan **farklı preset alt-kümesi** seçer, DesignSystem **farklı palet/font** türetir, blok sırası rotasyon kuralıyla değişir. Anti-clone test: aynı template + aynı tohumla 2 üretim çalıştırılıp blueprint'lerin `componentKey+presetKey+palet` imzası karşılaştırılır (`scripts/verify-website-codegen.mjs`'e yeni assert).

## 5.4 Referans "design DNA" çıkarımı (Firecrawl ile, KOPYALAMADAN)

- Mevcut `lib/website/referenceScanner.ts` (SSRF-korumalı) **Firecrawl** (`firecrawl_scrape`/`firecrawl_extract`) ile zenginleştirilir. Çıkarılan: **soyut design DNA** — baskın renk ailesi (ham hex değil, ton kategorisi), tipografi tonu (serif/sans, ağır/hafif), spacing yoğunluğu, layout ritmi, sektör sinyali. **HTML/metin/görsel KOPYALANMAZ** — yalnız sayısal/kategorik özet `<untrusted_source>` kapsülünde Aşama 0'a verilir (mevcut prompt-injection karantinası).
- Bu DNA, DesignSystem'e **kısıt değil ilham** olarak girer (spec: "birebir kopya DEĞİL"). `dataSourcePriority='reference'` ise ağırlığı artar ama yine de composition engine kendi varyasyonunu üretir.

## 5.5 Anti-clone kontrolü

renderGate'e (Aşama 5) yeni alt-kapı: üretilen blueprint imzası, referans DNA imzasıyla **çok yüksek benzerlik** (eşik) gösterirse "kopya riski" → composition engine'e zorunlu varyasyon (preset/palet rotasyonu) ile yeniden üret. Ayrıca footer "YoAi ile üretildi" işareti korunur (spec Bölüm 4).

## 5.6 Özel-component → ekstra kredi / üst paket

`ComponentDef.requiresTier`:
- `'extra_credit'`: kütüphane dışı özel bileşen (örn. tam ekran slider + video arka plan). Üretim sırasında `lib/billing/featureAccessMap.ts`'e yeni `featureKey: 'website_custom_component'` eklenir → `chargeFeature` ek kredi düşer (Bölüm 7 credit charge). Tahmin **create-modal'da gösterilmez**; tüketim işlem sırasında adım-adım (Bölüm 7 credit event stream).
- `'pro'`: yalnız üst abonelik planı → `requireSubscription` guard + `AccessRequiredModal type="subscription"`.

Mevcut serbest-HTML motoruyla birleşim **net:** Library prompt sözlüğü + composition engine deterministik iskelet sağlar; AI serbest HTML'i bu iskelet/sözlük içinde yazar; çıktı `format='html'` kalır; dual-read, CSP, sanitize, renderGate, versiyonlama hepsi **olduğu gibi** çalışır.

---

# BÖLÜM 6 — DB Planı

**Genel ilke:** Mevcut `websites` / `website_pages` / `website_versions` **GENİŞLETİLİR, yeniden yaratılmaz**. Yeni tablolar additive + idempotent (`CREATE TABLE IF NOT EXISTS`), `user_id TEXT NOT NULL` izolasyonu + RLS aynı desenle (`USING (user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true)))`), FK çocuk tablolar `website_id … ON DELETE CASCADE` + nested RLS. `user_id` doğrudan taşımayan çocuk tablolarda RLS `EXISTS (SELECT 1 FROM websites w WHERE w.id = website_id AND w.user_id = …)` (mevcut `website_pages_own` deseni).

**Migration sıra/isim kuralı:** `YYYYMMDDHHMMSS_snake_case.sql`, 14 haneli zaman, ASCII-only ad. Paralel "Sosyal Medya" oturumuyla çakışmamak için saniye-bazlı artan. Önerilen sıra:

| Migration | İçerik |
|---|---|
| `20260618100000_website_pages_html_format.sql` | `website_pages` GENİŞLET: `html TEXT NULL`, `format TEXT NOT NULL DEFAULT 'sections' CHECK (format IN ('sections','html'))` (spec Bölüm 7). Mevcut satırlar `'sections'` kalır. |
| `20260618100100_website_library_templates.sql` | `website_templates`, `website_component_library` |
| `20260618100200_website_commerce.sql` | `website_products`, `website_orders`, `website_forms` |
| `20260618100300_website_assets_domains_deploy.sql` | `website_assets`, `website_domains`, `website_deployments`, `website_integrations` |
| `20260618100400_website_event_logs.sql` | `website_credit_events`, `website_publish_events`, `website_edit_events` |
| `20260618100500_website_error_repair.sql` | `website_error_reports`, `website_repair_attempts` |

## Mevcut (GENİŞLET)

**`websites`** — değişmez (id, user_id, label, subdomain UNIQUE, site_type, default_locale, locales[], category, status[`draft|published|unpublished`], theme JSONB, published_version_id, timestamps). Yeni alanlar `theme` JSONB'ye yazılır (migration yok): `compiledCssVersion`, `industryTemplateKey`, anti-clone imzası.

**`website_pages`** — GENİŞLET: `html TEXT NULL` + `format`. Index korunur (`idx_website_pages_unique` website_id+locale+slug). `sections` JSONB geriye dönük korunur.

**`website_versions`** — değişmez tablo; `snapshot` JSONB içine `pages[].html`, `pages[].format`, `designSystem`, `blueprint`, `blockMap` eklenir (migration gerekmez). `reason` enum `initial|revision|rollback` korunur.

## Yeni tablolar

**`website_templates`** — `id UUID PK`, `user_id TEXT NULL` (NULL = sistem şablonu), `key TEXT`, `industry TEXT`, `title TEXT`, `default_pages JSONB`, `component_pool JSONB`, `token_suggestions JSONB`, `booking_mode TEXT`, `commerce_mode TEXT`, `is_system BOOLEAN DEFAULT false`, `requires_tier TEXT NULL`, timestamps. Index: `(user_id)`, `(industry)`, UNIQUE `(COALESCE(user_id,'_sys'), key)`. RLS: sistem (`user_id IS NULL`) herkese SELECT; kullanıcı şablonu own.

**`website_component_library`** — `id UUID PK`, `user_id TEXT NULL`, `key TEXT`, `category TEXT`, `block_tag TEXT`, `content_schema JSONB`, `prompt_hint TEXT`, `requires_tier TEXT NULL` (`extra_credit|pro|null`), `is_system BOOLEAN`, `shared BOOLEAN DEFAULT false`, timestamps. UNIQUE `(COALESCE(user_id,'_sys'), key)`. (Sistem bileşenleri kod-içi `.mjs`'te canonical; tablo özel/kullanıcı bileşenleri ve override için.)

**`website_products`** — `id UUID PK`, `website_id UUID FK CASCADE`, `user_id TEXT`, `sku TEXT NULL`, `title TEXT`, `description TEXT`, `price NUMERIC`, `currency TEXT DEFAULT 'TRY'`, `image_url TEXT`, `inventory INTEGER NULL`, `status TEXT CHECK (status IN ('active','hidden','out_of_stock')) DEFAULT 'active'`, `order_index INT`, timestamps. Index `(website_id, order_index)`. RLS nested.

**`website_orders`** (mock) — `id UUID PK`, `website_id UUID FK CASCADE`, `user_id TEXT`, `customer_name`, `customer_email`, `customer_phone`, `items JSONB`, `total NUMERIC`, `currency TEXT`, `status TEXT CHECK (status IN ('received','contacted','fulfilled','cancelled')) DEFAULT 'received'`, `note TEXT`, `created_at`. Index `(website_id, created_at DESC)`. (Ödeme yok — lead benzeri kayıt.)

**`website_forms`** — `id UUID PK`, `website_id UUID FK CASCADE`, `user_id TEXT`, `form_key TEXT` (contact|reservation|custom), `field_definitions JSONB`, `submissions_count INT DEFAULT 0`, timestamps + ayrı **`website_form_submissions`** (`id`, `form_id FK CASCADE`, `website_id`, `data JSONB`, `submitter_ip TEXT`, `created_at`). Submission RLS nested via website.

**`website_assets`** — `id UUID PK`, `website_id UUID FK CASCADE`, `user_id TEXT`, `kind TEXT CHECK (kind IN ('image','video','font','logo'))`, `storage_path TEXT`, `public_url TEXT`, `width INT`, `height INT`, `source TEXT` (upload|stock|magnific), `query TEXT NULL` (stok arama izi), `created_at`. (Mevcut `social_post_media` deseni.) Index `(website_id)`.

**`website_domains`** — `id UUID PK`, `website_id UUID FK CASCADE`, `user_id TEXT`, `host TEXT UNIQUE` (firma.com), `kind TEXT CHECK (kind IN ('apex','subdomain'))`, `status TEXT CHECK (status IN ('pending_dns','verifying','verified','failed')) DEFAULT 'pending_dns'`, `dns_records JSONB` (Vercel'den dönen A/CNAME), `verified_at TIMESTAMPTZ NULL`, `last_error TEXT`, timestamps. Index `(website_id)`, UNIQUE `(host)`. (Mevcut `theme.customDomain` + `vercelDomain.ts`/`edgeConfig.ts` ile uyumlu — tek-domain bilgisi theme'de, çoklu/durum takibi burada.)

**`website_deployments`** — `id UUID PK`, `website_id UUID FK CASCADE`, `user_id TEXT`, `version_id UUID NULL` (website_versions FK), `status TEXT CHECK (status IN ('queued','building','live','failed','rolled_back')) DEFAULT 'queued'`, `published_at TIMESTAMPTZ NULL`, `rollback_to_version_id UUID NULL`, `meta JSONB`, `created_at`. Index `(website_id, created_at DESC)`, `(status, created_at)`. (DB-service modelde "deploy" = publish+CDN invalidation; kullanıcı Vercel görmez.)

**`website_integrations`** — `id UUID PK`, `website_id UUID FK CASCADE`, `user_id TEXT`, `kind TEXT` (analytics|email|crm|whatsapp|maps), `config_enc JSONB` (hassas alan AES-GCM, mevcut `sendingAccountStore` deseni), `status TEXT CHECK (status IN ('pending','active','failed')) DEFAULT 'pending'`, timestamps. Index `(website_id)`.

**`website_credit_events`** — `id UUID PK`, `website_id UUID FK CASCADE`, `user_id TEXT`, `version_id UUID NULL`, `phase TEXT` (designSystem|html_generate|images|translate|patch|publish|custom_component), `credit_delta INT`, `credit_transaction_id UUID NULL` (mevcut `credit_transactions` ledger'a FK — Bölüm: kredi gerçek defteri orada kalır), `status TEXT CHECK (status IN ('charged','refunded'))`, `detail JSONB`, `created_at`. Index `(website_id, created_at DESC)`, `(user_id, created_at DESC)`. **Amaç:** adım-adım tüketim stream'i (Bölüm 7/8 CreditUsageTimeline) — gerçek bakiye `credit_transactions`'ta atomik kalır; bu tablo website-özgü telemetri/UX katmanı.

**`website_publish_events`** — `id UUID PK`, `website_id UUID FK CASCADE`, `user_id TEXT`, `version_id UUID`, `action TEXT CHECK (action IN ('publish','unpublish','rollback'))`, `change_summary JSONB`, `created_at`. Index `(website_id, created_at DESC)`.

**`website_edit_events`** — `id UUID PK`, `website_id UUID FK CASCADE`, `user_id TEXT`, `version_id UUID NULL`, `edit_kind TEXT` (chat_patch|visual_edit|product|settings), `target_block_id TEXT NULL`, `delta JSONB`, `created_at`. Index `(website_id, created_at DESC)`. Audit + ManageDrawer geçmişi.

**`website_error_reports`** — `id UUID PK`, `website_id UUID FK CASCADE`, `user_id TEXT`, `version_id UUID NULL`, `report_kind TEXT CHECK (report_kind IN ('code_error','user_reported'))`, `description TEXT`, `screenshot_asset_id UUID NULL` (website_assets FK), `client_logs JSONB`, `metadata JSONB` (sayfa/locale/UA), `ai_attempt_history JSONB` (AI onarım denemeleri özeti), `status TEXT CHECK (status IN ('open','ai_repairing','ai_failed','escalated','admin_fixing','resolved')) DEFAULT 'open'`, `resolved_at TIMESTAMPTZ NULL`, `resolution_note TEXT`, timestamps. Index `(website_id, created_at DESC)`, `(status, created_at DESC)`. **Gözetim Merkezi** bu tabloyu okur (Bölüm 8 admin).

**`website_repair_attempts`** — `id UUID PK`, `error_report_id UUID FK CASCADE`, `website_id UUID`, `user_id TEXT`, `attempt_no INT` (1|2), `repair_type TEXT CHECK (repair_type IN ('ai_auto','admin_manual'))`, `status TEXT CHECK (status IN ('running','success','failed')) DEFAULT 'running'`, `result_summary JSONB`, `produced_version_id UUID NULL`, `credit_charged INT DEFAULT 0` (kod-hatası onarımı → **0**, KESİN KURAL), `created_at`. Index `(error_report_id, attempt_no)`.

---

# BÖLÜM 7 — API Route Planı

Mevcut konvansiyon: `app/api/website/route.ts`, `app/api/website/[id]/<eylem>/route.ts`, admin için `app/api/admin/<alan>/route.ts`. Mevcut route'lar **korunur**, yeni eylemler eklenir. KESİN KURAL: kullanıcı Vercel/GitHub görmez; `.vercel.app` gösterilmez; kredi tahmini create-modal'da gösterilmez (tüketim işlem sırasında stream).

| # | Kategori | Route (method) | Notlar / mevcut bağ |
|---|---|---|---|
| 1 | Site oluşturma | `POST /api/website` (var) | CreateSiteWizard'dan; taslak. **Korunur.** |
| 2 | Blueprint | `POST /api/website/[id]/blueprint` (yeni) | `blueprintGenerator` çağırır → blueprint JSON döner (henüz render yok). |
| 3 | Template | `GET /api/website/templates` (yeni) | Industry templates listesi (sistem + kullanıcı). `GET ?industry=otel`. |
| 4 | Component render | `POST /api/website/[id]/render-block` (yeni) | Tek blok deterministik/AI render (önizleme/insert). |
| 5 | Revize/patch (üretim) | `POST /api/website/[id]/generate` (var) | İlk üretim + tam revizyon. **Korunur**, codegen v2 + blueprint'e bağlanır. |
| 6 | Visual edit patch | `POST /api/website/[id]/patch` (yeni) | Chat-edit + visual edit ops (`{op,targetId,content}`) → patchPlanner → applyBlockPatch. **Her revizede tüm site yeniden üretilmez.** |
| 7 | Asset upload | `POST /api/website/[id]/assets` (yeni) | Görsel/font upload → `website_assets` + Supabase Storage. |
| 8 | Image gen | `POST /api/website/[id]/assets/generate` (yeni) | `{{IMG:query}}` → stock (Freepik→Pexels→…) veya Magnific (Inngest step, blocking yok). |
| 9 | Product CRUD | `GET/POST/PATCH/DELETE /api/website/[id]/products` (+`/products/[pid]`) (yeni) | `website_products`. |
| 10 | Form submit | `POST /s/[subdomain]/lead` (var) + `POST /api/website/[id]/contact` (var) | **Korunur.** Reservation/order submission de bu lead deseninden türetilir → `website_forms`/`website_orders`. |
| 11 | GitHub repo create | — (UYGULANMAZ, gizli) | DB-service modeli; kullanıcı GitHub görmez. Route **yok**. |
| 12 | GitHub commit/push | — (UYGULANMAZ) | Aynı. |
| 13 | Vercel project create | — (UYGULANMAZ, gizli) | DB-service; tek Vercel projesi. Route **yok**. |
| 14 | Vercel deploy status | `GET /api/website/[id]/deploy-status` (yeni) | İçeride publish+CDN durumu okunur; UI'da **markalı "Yayında/Yayınlanıyor"** gösterilir, Vercel adı/`.vercel.app` **asla** sızmaz → `website_deployments` döner. |
| 15 | Preview domain | `GET /api/website/[id]/preview-url` (yeni) | Markalı preview URL (yeni sekme), dashboard içi dar iframe değil. `<subdomain>.yoai.yodijital.com` taslak preview. |
| 16 | Custom domain add | `PUT /api/website/[id]/domain` (var) | **Korunur**, `website_domains` + `vercelDomain.attachDomain`. |
| 17 | DNS fetch | `GET /api/website/[id]/domain/dns` (yeni) | `vercelDomain` A/CNAME kayıtlarını döner (Türkiye manuel DNS ana akış). |
| 18 | Domain verify | `POST /api/website/[id]/domain/verify` (yeni) | `checkDomainConfig` → `website_domains.status`. |
| 19 | Publish status | `GET /api/website/[id]/publish` (publish var, GET ekle) | `POST` publish korunur; `GET` durum. |
| 20 | Credit charge | (generate/patch içinde `chargeFeature`) | Mevcut `lib/billing/featureGuard.ts`. `website_credit_events` yazılır. |
| 21 | Credit event stream | `GET /api/website/[id]/credit-events` (yeni, SSE/poll) | Adım-adım tüketim (CreditUsageTimeline). |
| 22 | Version history | `GET /api/website/[id]/versions` (var) | **Korunur.** |
| 23 | Rollback | `POST /api/website/[id]/versions/rollback` (yeni alt-route) | `rollbackToVersion` + `website_publish_events`. |
| 24 | Export/download | `GET /api/website/[id]/export` (yeni) | Assemble edilmiş HTML+CSS zip (üst paket gate olabilir). |
| 25 | Feature gate | `GET /api/billing/current` (var) + `featureAccessMap` | `website_generation`, `website_custom_component` keyleri. **Korunur.** |
| 26 | Kod-hatası repair | `POST /api/website/[id]/repair` (yeni) | "Kod Hatası" butonu → AI onarım (kredi **DÜŞMEZ**). `website_repair_attempts` (`ai_auto`, `credit_charged=0`). |
| 27 | AI repair attempt | (repair route içinde, attempt_no 1→2) | 2. deneme de başarısız → `status='ai_failed'` → UI kırmızı "Hata Bildir". |
| 28 | Hata-bildir submit | `POST /api/website/[id]/error-report` (yeni) | `website_error_reports` (`user_reported`) + screenshot + log + metadata + AI deneme geçmişi → Gözetim Merkezi. |
| 29 | Screenshot upload | `POST /api/website/[id]/error-report/screenshot` (yeni) | `website_assets` (kind=image) + report'a bağla. |
| 30 | Gözetim error list/detail | `GET /api/admin/gozetim-merkezi/website-errors` (+`/[reportId]`) (yeni) | Admin guard (`getIsCurrentUserSuperAdmin`). Mevcut `app/api/admin/gozetim-merkezi/` deseni. |
| 31 | Admin repair apply | `POST /api/admin/gozetim-merkezi/website-errors/[reportId]/apply-fix` (yeni) | Admin düzeltmeyi müşteri sitesine entegre eder (yeni version). |
| 32 | Admin repair deploy/verify | `POST /api/admin/gozetim-merkezi/website-errors/[reportId]/deploy` (yeni) | Redeploy + verify → `website_deployments`. |
| 33 | Müşteri bildirim mail | (deploy route içinde) `lib/website/contactNotify` deseni | Kayıtlı mail (`signups.email`) bilgilendirme + report `status='resolved'`. |

Tüm yeni route'lar: `getCurrentUser` + `getWebsite(user.id, id)` sahiplik kontrolü; admin route'ları `getIsCurrentUserSuperAdmin` + 404 fallback (mevcut desen). Meta/Google koduna dokunulmaz.

---

# BÖLÜM 8 — Frontend Component Planı

Mevcut: `components/website/{CreateSiteWizard,DesignPanel,DomainPanel,SiteList,WebsiteBuilderAnimation,DictateButton}`, `app/web-site-yoneticisi/[id]/page.tsx` (editor), `.../onizleme/page.tsx` (preview/publish), `components/Topbar.tsx`. Yeni bileşenler `components/website/builder/` altına; admin `components/gozetim/` genişler. Tümü i18n (`tr.json`+`en.json`), `animate-card-enter`, `max-w-7xl` (builder canvas hariç — `app/tasarim` benzeri split-pane istisnası), amber yasağı, WizardSelect.

| Bileşen | Amaç | Mevcut neyi genişletir/değiştirir |
|---|---|---|
| **BuilderWorkspace** | Editor kabuğu (topbar + canvas + chat + inspector split-pane). | `app/web-site-yoneticisi/[id]/page.tsx` içeriğini sarmalar; `app/tasarim` split-pane istisnası uygulanır. |
| **BuilderTopbar** | Site adı + Yayınla + cihaz + version. | Mevcut `Topbar` actionButton'ı kullanır (yeni dosya değil, konfig). |
| **DeviceSwitcher** | Desktop/tablet/mobil önizleme genişliği. | Mevcut device preview mantığını bileşene çıkarır. |
| **PreviewCanvas** | Markalı preview (taslak iframe srcdoc-sandbox). **Dashboard'a sıkışık dar iframe YOK** — "Yeni sekmede aç" markalı preview URL (`/preview-url`). | `app/website-preview/[id]` srcdoc-sandbox korunur; dar gömülü mod büyütülür + yeni-sekme CTA. |
| **AiChatPanel** | Chat-native düzenleme girişi (komut → patch). | Yeni; `/patch` çağırır, blok-bazlı. |
| **VisualEditLayer** | MVP visual editing: canvas üstü tıkla-seç katmanı (`data-yoai-id`/`data-yoai-field`). | Yeni; PreviewCanvas üstünde. |
| **SelectedElementToolbar** | Seçili blok için hızlı eylem (düzenle/sil/taşı/AI revize). | Yeni; VisualEditLayer ile. |
| **RightInspectorPanel** | Seçili bloğun contentSchema alanları + token override. | Yeni; `DesignPanel` token mantığını seçili-blok bağlamına genişletir. |
| **PublishPopup** | Yayın onay modalı (markalı URL, Vercel adı yok). | `.../onizleme/page.tsx` inline butonu **modal'a** taşır. |
| **DomainConnectForm** | Özel domain ekleme (manuel DNS ana akış). | `DomainPanel.tsx` genişler. |
| **DNSRecordsTable** | A/CNAME kayıtları kopyala (Türkiye manuel). | Yeni; `DomainPanel` içinde, `/domain/dns`. |
| **DomainStatusBadge** | pending_dns/verifying/verified/failed. | Yeni; amber yasak → gri/yeşil/kırmızı. |
| **DeployStatusBadge** | "Yayında/Yayınlanıyor" — **`.vercel.app` asla**. | Yeni; `/deploy-status`. |
| **CreditBalanceIndicator** | Anlık bakiye (topbar). | Mevcut `useCredits` kancası. |
| **CreditUsageTimeline** | Adım-adım tüketim (designSystem→html→images…). **Create-modal'da tahmin yok.** | Yeni; `/credit-events` stream. |
| **VersionHistoryPanel** | Sürüm listesi + Geri Al. | Mevcut `/versions` + yeni rollback. |
| **ManageDrawer** | Site ayarları/ürün/ödeme/entegrasyon sekme drawer'ı. | Yeni; alt panelleri toplar. |
| **ProductEditorPanel** | `website_products` CRUD. | Yeni; `/products`. |
| **PaymentSettingsPanel** | (mock) sipariş bildirim ayarı — gerçek ödeme yok. | Yeni; lead/mail deseni. |
| **SiteSettingsPanel** | Dil/menü/logo/SEO meta. | `CreateSiteWizard` alanlarının düzenleme karşılığı. |
| **IntegrationUpsellCards** | Analytics/Email/CRM/WhatsApp upsell. | Yeni; `website_integrations` + ekosistem route'ları (CRM/Email Marketing). |
| **TemplateSelector** | Industry template seçimi (create + sonradan). | `CreateSiteWizard`'a eklenir (mevcut modal **korunur**, alanlar generation'a bağlanır). |
| **PageNavigator** | Sayfa listesi + sıra + ekle/sil. | Yeni; `multipagePlan`/blueprint sayfaları. |
| **CodeErrorButton** | "Kod Hatası" → AI onarım (kredi **DÜŞMEZ**). | Yeni; `/repair`. |
| **ErrorReportButton** | 2. AI denemesi de başarısız → kırmızı "Hata Bildir". | Yeni; `ai_failed` durumunda görünür. |
| **ErrorReportModal** | Ekran görüntüsü + açıklama → Gözetim Merkezi. | Yeni; `/error-report` + screenshot. |
| **RepairSuccessPopup** | AYNEN: "Harika sorun düzeltilmiştir. Ustelik bu duzenleme icin sizden ekstra kredi bakiyesi dusulmemistir." | Yeni; repair success. (i18n tr/en — TR metni birebir.) |
| **ErrorEscalationPopup** | AYNEN: "Sorunu teknik ekibimize ilettik en kisa surede gerekli duzenlemeleri yapip, kayit oldugunuz mail adresi uzerinden size geri bildirimde bulunulacaktir." | Yeni; error-report submit sonrası. |
| **AdminWebsiteErrorReports** | Gözetim Merkezi'nde site hata listesi (screenshot+log+metadata+AI deneme geçmişi). | `components/gozetim/GozetimMerkeziClient.tsx`'e yeni sekme. |
| **AdminWebsiteErrorReportDetail** | Tek rapor detayı. | Aynı; `/website-errors/[reportId]`. |
| **AdminRepairActionPanel** | Admin düzeltme → müşteri paneline entegre + redeploy/verify + kayıtlı mail bilgilendirme. | Yeni; `/apply-fix` + `/deploy`. |

**Korunan akış:** `CreateSiteWizard` (tüm alanlar) → `POST /api/website` → editor (`BuilderWorkspace`). Wizard alanları (siteType/fontPairing/siteStyle/mobileMenuAnim/locales/instructions/logo/referenceUrls/dataSourcePriority) **generation'a aktif bağlanır** (blueprint generator girdisi). Mobil header (hamburger): şeffaf değil + okunabilir + aç/kapa + kapat-ikonu + açık-kalma-bug'i yok — `yoai-site-runtime.js` `data-yoai-toggle` + library `navbar` preset'lerinde zorunlu. Header/footer başlıkları PC/tablet/mobilde alt satıra kaymaz (preset CSS `white-space`/flex kuralı + renderGate kontrolü). Footer yılı `current/2026` dinamik. Header/footer/builder UI Meta/Google koduna dokunmaz.

---

İlgili dosyalar (mutlak yol):
- Plan dökümanı: `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/docs/superpowers/specs/2026-06-17-web-site-yoneticisi-codegen-design.md`
- Tipler: `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/lib/website/types.ts`
- Mevcut migration: `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/supabase/migrations/20260614120000_create_website_tables.sql`
- Codegen pipeline dizini: `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/lib/website/codegen/`
- Mevcut API route'ları: `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/app/api/website/`
- Mevcut builder bileşenleri: `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/components/website/`
- Admin (Gözetim) API deseni: `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/app/api/admin/gozetim-merkezi/`

---

# C) STATE MACHINE · KREDI · DOMAIN/PUBLISH · VISUAL EDIT · HATA-TELAFI · RESPONSIVE · GUVENLIK (Bolum 9-15)
Bölüm 9-15 yazıldı: `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/docs/superpowers/specs/2026-06-18-web-site-yoneticisi-codegen-bolum-9-15.md`

İçerik özeti (tam metin yukarıdaki dosyada):

**BÖLÜM 9 — State Machine (8 makine):** Her biri `lib/website/state/*.ts` altında TS union + geçiş tablosu, tek noktadan `transition()` invariant koruması. (1) Domain status 9 state, (2) Deploy status 6 state (zero-downtime redeploy/pointer swap), (3) Publish popup 8 state (client-only), (4) Credit charging 7 state — `no_credit_platform_repair` = platform hatası → KREDİ DÜŞMEZ + tam iade, (5) Site generation 13 state pipeline'a 1:1 map (`committing_to_github`/`deploying_to_vercel` kullanıcıya GitHub/Vercel ismiyle GÖSTERİLMEZ), (6) Visual edit 9 state (seçili-blok patch, gate fail→snapshot atılmaz), (7) Code repair 13 state (2 deneme, her ikisinde de site-açılır+menü+sayfa-geçiş+mobil-hamburger+buton+form+sepet doğrulama; başarı/başarısızlık AYNEN metinler), (8) Admin error report 9 state.

**BÖLÜM 10 — Kredi:** Mevcut `WEBSITE_CREDITS` (base 40/perExtraPage 15) ve `FREE_CREDITS` tabanına kalibre değerler tablosu (Free 250, metin 20-40, tasarım 60, bölüm 120, sayfa 180, görsel 80-140, component 320, tam site ~600, özel 1000+). Adım-adım düşüm UI dökümü (create-modal'da tahmin GÖSTERİLMEZ). `website_credit_events` log tablosu tüm istenen alanlarla (operation_type/model_used/tokens/page_count/image_count/revision_scope/estimated_cost_usd/charged_credits/balance_before-after/created_at). reserve→consume→refund + PLATFORM-HATASI-KREDİ-DÜŞMEZ. Free/Starter/Premium/Pro-Ajans → free/starter/premium/enterprise tier map (yeni plan yaratılmaz, tek kredi havuzu).

**BÖLÜM 11 — Domain/publish:** Yayınla popup 4 seçenek (önerilen/ara=Yakında-disabled, kendi domainini getir=ana MVP, ücretsiz geçici). Türkiye manuel DNS (Vercel attachDomain + www CNAME prod + apex A 308 redirect + checkDomainConfig verify + "Kayıtları Kontrol Et"). 9 sağlayıcı rehberi (Natro/Turhost/İsimtescil/İHS/Güzel Hosting/Veridyen/Cloudflare/GoDaddy/Diğer). DNS ekran alanları (Type/Host/Value/Copy/Status/Last checked, per-record Türkçe). Markalı `*.preview.yoai-domain.com` wildcard + middleware rewrite, `.vercel.app` gizleme, gömülü dar iframe yerine yeni-sekme markalı URL. Entri Faz 2 opsiyonel.

**BÖLÜM 12 — Visual editing:** Mevcut `data-yoai-block`/`patchPlanner`/`blockMap`/`applyBlockPatch` üstüne; canvas hover+seç (metin/başlık/görsel/buton/ürün kartı/menü/form/bölüm/footer/hero), inline action menu + sağ inspector, 14 aksiyon, görünmez `data-block-id/component/editable/field/page/section` metadata (sanitize allowlist'e eklenir), SEÇİLİ-BLOK PATCH (full regen yok, başarısız→blok-fallback), versiyon geçmişi + `website_edit_events`.

**BÖLÜM 13 — Kod Hatası/Hata Bildir/Gözetim:** "Kod Hatası" butonu Reddet/Düzenle/Yayınla yanında, KREDİ DÜŞMEZ; AI onarım (log topla→analiz→düzelt→redeploy→doğrula, 2 deneme); başarı popup AYNEN "Harika sorun düzeltilmiştir…"; 2 deneme başarısız→kırmızı "Hata Bildir"; hata-bildir popup AYNEN "Sorunu teknik ekibimize ilettik…"; Gözetim Merkezi web-hata sekmesi (`website_error_reports` ekran görüntüsü+log+metadata+AI deneme geçmişi); admin çözüm akışı (AI sorgu→fix→müşteri paneline entegre→redeploy/verify→kayıtlı maile "Sitenizde bildirilen teknik sorun giderildi…").

**BÖLÜM 14 — Responsive header/footer:** Mobil header solid/semi-opaque (rgba≥0.85 + blur, şeffaf YASAK); hamburger opak kart + transform/opacity anim + dış-tık kapanır (açık-kalma bug'ı yok) + X ikonu + ESC; başlık taşması yok (clamp() + breakpoint hamburger eşiği + footer flex-wrap); footer yılı render-time dinamik; renderGate kalite kapıları. Mevcut `data-yoai-mobile-nav` runtime üstüne.

**BÖLÜM 15 — Güvenlik:** Token/env sunucu-only + GitHub/Vercel ismi UI'da yok, tenant RLS (tüm yeni `website_*` tabloları), preview URL tahmin-edilemez+auth-gated, domain ownership verify, payment key saklama, AI output sanitization (deny-by-default + CSP + yeni data-attr allowlist + keyfi script yok), upload MIME/boyut/signed-path, rate-limit + concurrency, credit/free-trial abuse (atomik spend), `.vercel.app` gizleme + build-log secret maskeleme, hata-raporu PII maskeleme, admin repair super-admin guard. Tam ENV listesi (GitHub App/Vercel/preview-domain/payment/AI/storage/webhook/email/admin-notify/flags).

Ek olarak yeni DB tabloları özeti (`website_domains/deployments/credit_events/edit_events/error_reports/repair_attempts`) mevcut RLS+CASCADE pattern'ine ve additive migration kuralına uygun; `credit_transactions.reason` enum additive genişletme. Meta/Google (`lib/meta/*`, `lib/google/*`) entegrasyonuna dokunulmadı.

---

# EK) MEVCUT PROJE ANALIZ HAM CIKTISI
### ANALIZ: website-engine
Perfect. Now let me create a comprehensive analysis report by gathering all findings:

## ANALIZ RAPORU: Web Site Yoneticisi Modulu (YoAi_Project)

**Tarih:** 2026-06-18  
**Çalışma Dizini:** `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/.claude/worktrees/web-site-yoneticisi-codegen`

---

### 1. URETIM PIPELINE (lib/website/codegen/*)

**Mimari:** Serbest-HTML (format='html') üretimine geçiş kapıda. 4-aşamalı Opus 4.8 + Sonnet motoru.

| AŞAMA | DOSYA | SATıR | GÖREV | DURUM |
|-------|-------|-------|-------|-------|
| 0 | buildCodegenContext.ts | 1-145+ | Markaişletme profili + referans URL'leri toplayıp AI'ya güvenli gönderme (untrustedBlocks kapsülü); cross-business sızıntı önleme (site-scoped kaynaklar 1. önce) | ✅ AKTIF |
| 1 | designSystem.ts | 1-200+ | Opus 4.8 + adaptive thinking: site için sayısal CSS tasarım sistemi (palet/yazı/aralık/gölge/gradyan/hareket); safeDefault soft-fail fallback | ✅ AKTIF |
| 1.5 | designSystemValidate.mjs | — | designSystem çıktısını CSS güvenliğine karşı doğrulama (no calc/var/injection) |  ✅ SHARED |
| 2 | multipagePlan.ts | 1-100+ | Opus: çok-sayfalı siteler için site haritası (3..6 sayfa, home 1., contact zorunlu); deterministic validatePagePlan fallback | ✅ AKTIF |
| 2.5 | multipagePlanShared.mjs | — | Sayfa planı doğrulama / sistem istemi kurucu | ✅ SHARED |
| 3 | htmlGenerate.ts | 1-50+ | Opus: Her sayfa → raw HTML + görseller (stock image bağlama) | ✅ AKTIF |
| 3.5 | htmlGenerateShared.mjs | 48,500+ satır | HTML blok üreticiler (hero/services/features/testimonial/cta/footer); görsel placeholder çözme | ✅ SHARED |
| 4 | blockMap.mjs | 14,489 | Sayfa HTML'ini 'id' bazlı blok haritasına çöz (patch planlama için); edit/insert/delete/move op'ları uygulamak için offset takibi | ✅ SHARED |
| 5-Chat | patchPlanner.ts | 1-100+ | Sonnet: edit talimatı → patch ops (planPatchOps) + blok regens (regenerateBlock) | ✅ AKTIF |
| 5.5 | patchPlannerShared.mjs | 9,792+ | Patch op'ları doğrulama (validateOps — güvenlik kapısı) | ✅ SHARED |
| 6 | applyBlockPatch.ts | 11,276 | Validated ops'ları sayfaya uygula (edit/insert/delete/move); başarısızlık → full regen fallback | ✅ AKTIF |
| 7 | sanitizeHtml.ts | 2,063 | AI HTML'i deny-by-default filtre ile temizle (sanitize-html + kuralları) | ✅ AKTIF |
| 7.5 | sanitizeAllowlist.mjs | 17,565 | SAFE_TAGS + SAFE_ATTRS + transformTags (sanitize-html config) — tek kaynak | ✅ SHARED |
| 8 | renderGate.mjs | 9,815 | Yayın kapısı: sanitize + SEO başlıkları + Meta/OG etiketleri + CSP + print stil | ✅ AKTIF |
| 9 | assembleDocument.ts | 3,477 | Taslak/yayın: raw HTML → tam belge (:root CSS vars + fonts + CSP başlık + bundle) | ✅ AKTIF |
| 9.5 | assembleDocument.mjs | 19,291 | assembleDocument runtime (fs ile HTML+CSS injectionları) | ✅ SHARED |
| 10 | translateHtml.ts | 4,252 | Sonnet: HTML → dil-çevirisi (multi-locale support) | ✅ AKTIF |
| 10.5 | translateHtml.mjs | 13,890 | Çeviri parser + HTML yeniden üreticisi | ✅ SHARED |
| 11 | tailwindCompile.ts | 1,560 | Per-site Tailwind CSS derleme (design vars ile) | ✅ AKTIF |
| 11.5 | tailwindCompile.mjs | 2,259 | Derleme runtime | ✅ SHARED |
| 12 | sourcePriority.mjs | 6,552 | dataSourcePriority (reference|manual|auto) → AI prompt'unda hangi veri kaynaklarının yönetici sayılacağını belirtme | ✅ SHARED |
| 13 | types.ts | — | CodegenContext, DesignSystem, Page Plan ve diğer type'lar | ✅ TYPE |

**Entegrasyon Noktası:** `/api/website/[id]/generate` → `generateWithCodegenV2()` (v2 bayrak açıksa) veya legacy yol (sections).

---

### 2. CREATE WIZARD ALANLARI (components/website/CreateSiteWizard.tsx, satır 1–384)

**Konumu:** CreateSiteWizard.tsx:43–148 (submit), modal gövde 150–382

| ALAN | SATIR | TYPESCRİPT TİPİ | VARSA DAVRANIŞI | ZORUNLU MU |
|------|-------|-----------------|-----------------|-----------|
| Site Adı (label) | 48, 184–190 | string | Boşsa t('defaultName') | ✅ |
| Site Türü (siteType) | 49, 217–227 | 'multipage' \| 'landing' | Dropdown: 2 seçenek | ✅ |
| Yazı Stili (fontPairing) | 51, 229–237 | FONT_PAIRING key | Searchable dropdown (FONT_PAIRING_LIST) | ✅ |
| Tasarım Tarzı (siteStyle) | 52, 193–213 | SITE_STYLE_PRESETS id | 6 tarz: modern/corporate/playful/luxury/minimal/vibrant | ✅ |
| Mobil Menü Açılışı (mobileMenuAnim) | 53, 240–253 | 'left' \| 'right' \| 'top' | Dropdown: üç perde yönü | ✅ |
| Diller (locales) | 50, 255–275 | string[] | Multi-select 33 dil; tr zorunlu (removable değil) | ✅ |
| Marka Açıklaması (instructions) | 59, 279–298 | string | Textarea + DictateButton (sesle yaz) | ❌ |
| Logo (logoFile + logoPreview) | 60–61, 300–326 | File \| null | PNG/JPEG/WebP; taşıma/silme (opsiyonel) | ❌ |
| 3 Referans URL | 54, 328–341 | string[] (3-item) | 3 input alan; "En az 1 tarafından veri kaynağı seçilirse auto 'reference'" | ❌ |
| Veri Kaynağı Önceliği | 57, 343–357 | 'reference' \| 'manual' | Dropdown; otomatik auto-derive (referans varsa reference, yoksa manual) | ✅ |

**Talimat Akışı:** Wizard `label`/`siteType`/`locales`/`fontPairing`/`siteStyle`/`mobileMenuAnim`/`referenceUrls`/`dataSourcePriority`/`instructions` + logo dosyası → POST `/api/website` (taslak) → logo PUT `/api/website/{id}/logo` → router navigate `/web-site-yoneticisi/{id}?create={ai|quick}`

**Lokalizasyon Kaynağı:** `locales/tr.json` + `locales/en.json` başlığından (dashboard.webSiteYoneticisi.*) okunur.

---

### 3. SERVIS KATMANI (app/(sites)/s/*)

**Dual-format sunucu:** format='html' (codegen) | format='sections' (legacy)

| YOLU | DOSYA | GÖREV | CSP | İZOLASYON |
|------|-------|-------|-----|-----------|
| `GET /s/<subdomain>` | [subdomain]/route.ts (satır 23–73) | PUBLIC anasayfa; dual-read; locale negotiation; 404 davranışı korunur | ✅ SITE_CSP | Provider yok; çıplak HTML |
| `GET /website-preview/<id>` | /website-preview/[id]/page.tsx (satır 16–86) | **OWNER-ONLY** taslak önizlemesi iframe'de; format='html' → assembleDocument.mjs (inlined runtime), format='sections' → SiteRenderer | ✅ SITE_CSP (iframe sandbox: allow-scripts allow-forms) | force-dynamic; auth kontrol |
| `POST /s/<subdomain>/lead` | [subdomain]/lead/route.ts | Contact form → notifySiteOwnerOfContact; honeypot, email regex, rate-limit (5/60s/IP) | ✅ (form-action 'self') | IP rate-limit; authentication yok |

**Proxy/Rewrite:** — Faz 3 (custom domain) için hazır ama şu anda /s/<subdomain> yol temel.

---

### 4. REVIZE AKIŞI (app/api/website/[id]/generate, satır 27–142)

**Endpoint:** POST `/api/website/{id}/generate`

| ADIM | SATIR | SORUMLU | GÜVENLİK |
|------|-------|---------|----------|
| 1. Kullanıcı kontrolü | 32–33 | getCurrentUser() | ✅ |
| 2. Site sahiplik | 48 | getWebsite(user.id, id) | ✅ |
| 3. İlk mi revizyon mu | 53–54 | existing.length > 0 | ✅ |
| 4. Kredi düşme (legacy yol) | 81 | chargeFeature('website_generation', cost) | ✅ Owner bypass + 402 featureGuard |
| 5. Profil + zeka yükleme | 85–87 | getProfileByUserId + getIntelligenceByUserId | ✅ Cross-business önleme buildCodegenContext'te |
| 6. generateSitePages (çok-dil) | 97–117 | Locale döngüsü (max 4 dil) | ✅ Paralel + 60s maxDuration |
| 7. Sayfa yazma | 121 | replacePages(user.id, site.id, pageInputs) | ✅ |
| 8. Version snapshot | 122–133 | createVersion(snapshot, 'initial'\|'revision', cost) | ✅ |
| 9. Kredi iade (hata) | 137 | access.refund() | ✅ |

**Codegen v2 Bayrağı:** `WEBSITE_CODEGEN_V2='1'` → `generateWithCodegenV2()` (satır 61–65); kapalıysa mevcut sections motoru.

**Revizyon Fiyatlandırması:**
- İlk 3 revizyon: **ÜCRETSIZ** (WEBSITE_FREE_REVISIONS = 3)
- 4+ revizyon: **10 kredi** (WEBSITE_REVISION_COST = 10)
- İlk üretim: computeGenerationCost({ siteType, pageCount, localeCount }) = (40 + 15×(pageCount−1)) × localeCount

---

### 5. İLETİŞİM FORMU (app/api/website/[id]/contact/route.ts, satır 43–80+)

**PUBLIC endpoint:** POST `/s/<subdomain>/lead`

| KÖNTROLİM | DETAY |
|-----------|-------|
| **Honeypot (bot)** | Input name="website" (gizli) — dolduysa sessiz başarı (200 ok:true) |
| **Email regex** | `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` |
| **Rate-limit** | Map-based: 60s penceresinde IP başına 5 istek (best-effort; serverless warm instance) |
| **IP çıkarımı** | x-real-ip > x-forwarded-for (son) — Vercel doğrulaması |
| **Boyut limiti** | 20KB (content-length) |
| **Bildirimi** | notifySiteOwnerOfContact(site.label, name, email, phone, message) → signups.email |

**Bildirim Sorumlusu:** `lib/website/contactNotify` (MailerLite/SendGrid entegrasyonu)

---

### 6. KREDI/ABONELIK SİSTEMİ (lib/website/credits.ts)

**Sabitler:**
```
WEBSITE_CREDITS = {
  base: 40,          // Landing (1 sayfa), 1 dil
  perExtraPage: 15,  // Sayfa başına ek maliyet
}
WEBSITE_REVISION_COST = 10       // Sabit revizyon ücreti (4+ revizyon)
WEBSITE_FREE_REVISIONS = 3       // İlk 3 revizyon ücretsiz
```

**Maliyet Hesabı:**
```
computeGenerationCost({ siteType, pageCount, localeCount })
  = (base + (pageCount−1) × perExtraPage) × localeCount
```

**Örnek:** 4 sayfalı multipage, 2 dil = (40 + 3×15) × 2 = 190 kredi

---

### 7. DATABASE KULLANIMI (lib/website/store.ts + types.ts)

| TABLO | ALAN | TIP | KÖKLEVİ |
|-------|------|-----|---------|
| `websites` | id, user_id, label, subdomain, site_type, default_locale, locales, category, status, theme (jsonb), published_version_id | id+user_id | Ana site kaydı |
| `websites.theme` | primaryColor, fontHref, logoUrl, referenceUrls[], **dataSourcePriority**, initialInstructions, style, mobileMenuAnim, **designVars** (CSS vars map), **compiledCssVersion** | jsonb | Tasarım + AI metadata |
| `website_pages` | id, website_id, locale, slug, page_role, sections[], html, format, seo, order_index | website_id+locale+slug | Sayfa içeriği |
| `website_versions` | id, website_id, snapshot (full WebsiteSnapshot), reason (initial\|revision\|rollback), credit_charged, created_at | website_id | Sürüm geçmişi |

**Status Değerleri:** 'draft' (taslak) | 'published' (yayınlanmış) | 'unpublished' (yayından kaldırılmış)

**Format:** 'html' (codegen) | 'sections' (legacy)

**PageRole:** 'home' | 'about' | 'services' | 'products' | 'contact' | 'blog' | 'faq' | 'gallery' | 'custom'

---

### 8. NEVCERİ YAPISI

Şu anda aktif olan pipeline dosyaları **3 kategoriye** ayrılır:

**A) TypeScript Kapsülü (TS → JS → Runtime):**
- `buildCodegenContext.ts` — untrusted.mjs + sourcePriority.mjs çağırır
- `designSystem.ts` — designSystemValidate.mjs çağırır
- `multipagePlan.ts` — multipagePlanShared.mjs çağırır
- `htmlGenerate.ts` — htmlGenerateShared.mjs çağırır
- `patchPlanner.ts` — patchPlannerShared.mjs + htmlGenerateShared.mjs çağırır
- `applyBlockPatch.ts` — blockMap.mjs çağırır
- `sanitizeHtml.ts` — sanitizeAllowlist.mjs çağırır
- `translateHtml.ts` — translateHtml.mjs çağırır
- `assembleDocument.ts` — assembleDocument.mjs + renderGate.mjs çağırır

**B) Saf ESM Modülleri (.mjs — Verify script tarafından da okunur):**
- `untrusted.mjs` — prompt injection koruması
- `sourcePriority.mjs` — veri kaynağı yönergesi
- `designSystemValidate.mjs` — CSS güvenliği doğrulama
- `multipagePlanShared.mjs` — Sayfa planı doğrulama
- `htmlGenerateShared.mjs` — Block üreticileri (48KB+)
- `blockMap.mjs` — HTML → block map
- `patchPlannerShared.mjs` — Patch ops doğrulama
- `sanitizeAllowlist.mjs` — Sanitize kuralları
- `translateHtml.mjs` — Çeviri motoru
- `tailwindCompile.mjs` — CSS derleme
- `assembleDocument.mjs` — Belge montajı + runtime
- `renderGate.mjs` — Yayın kapısı (SEO/CSP/Meta)

**C) Verify Script (scripts/verify-website-codegen.mjs):**
- `.mjs` modüllerini doğrudan require/import eder
- HTML → block map → patch ops → final HTML bilhassa test eder

---

### 9. ÖZELLIK MATRİSİ (Mevcut vs Planlanmış)

| ÖZELLİK | ✅ | İMP DOSYA | DURUMU |
|---------|----|---------|----|
| Tek-ekran site üreticisi (Wizard) | ✅ | CreateSiteWizard.tsx | Serbest HTML (v2) + Legacy sections (eski) |
| Çok sayfalı site planlama | ✅ | multipagePlan.ts | 3–6 sayfa otomatik planlama |
| Yazı pairing (heading+body) | ✅ | designSystem.ts | Google Fonts URL'li |
| Renkişitemi tasarımı | ✅ | designSystem.ts | Tam renk özgürlüğü (amber yasağı YALNIZ dashboard'da) |
| Mobil menü animasyonu | ✅ | types.ts (mobileMenuAnim) | 3 yön: left/right/top |
| Çoklu dil üretimi | ✅ | htmlGenerate.ts (forEach locale) | Paralel max 4 dil |
| Referans URL tarama | ✅ | buildCodegenContext.ts | scanReferences() | 3 URL |
| Veri kaynağı önceliği | ✅ | types.ts (dataSourcePriority) | reference|manual|auto |
| Chat-edit (blok patch) | ✅ | patchPlanner.ts + applyBlockPatch.ts | Sonnet: edit → ops → splice |
| Ön izleme (iframe) | ✅ | website-preview/[id]/page.tsx | format='html' → srcDoc inlined; sandbox allow-scripts |
| Yayın ve versiyon | ✅ | store.ts (createVersion) | initial|revision|rollback + credit snapshot |
| İletişim formu | ✅ | [subdomain]/lead/route.ts | Ziyaretçi mesajı → site sahibi e-postası |
| Özel alan tasarımı | ❌ | — | Faz C (planlı) |
| SEO + sitemap | ✅ | renderGate.mjs | Meta/OG + title/desc |
| Güvenlikişleştirilmiş HTML | ✅ | sanitizeHtml.ts | deny-by-default; SAFE_TAGS/SAFE_ATTRS |
| Tailwind derleme | ✅ | tailwindCompile.ts | Per-site CSS; designVars ile özelleşti |
| CSP (Content-Security-Policy) | ✅ | renderGate.mjs + serveCommon.ts | SITE_CSP sabitişi |
| Custom domain (Faz 3) | ❌ | store.ts (findWebsiteByCustomDomain) | Hazır ama aktif yol /s/<subdomain> |

---

### 10. İMARARİ ÖZET

```
Wizard
  ├─ UI: CreateSiteWizard.tsx (1 ekran, tüm alanlar)
  │
  └─ POST /api/website
      ├─ createWebsite(taslak)
      └─ POST /api/website/{id}/logo (opsiyonel)
        
Detail Page + Preview
  ├─ /web-site-yoneticisi/{id}
  │   ├─ GET /api/website/{id} (site meta)
  │   ├─ GET /api/website/{id}/pages (sayfa listesi)
  │   ├─ GET /api/website/{id}/versions (sürüm geçmişi)
  │   │
  │   └─ POST /api/website/{id}/generate
  │       │
  │       ├─ [V2 enabled] generateWithCodegenV2()
  │       │    ├─ Stage 0: buildCodegenContext (profile+refs)
  │       │    ├─ Stage 1: designSystem (Opus)
  │       │    ├─ Stage 2: multipagePlan (Opus)
  │       │    ├─ Stage 3: htmlGenerate (Opus)
  │       │    ├─ Stage 4: blockMap + patchPlanner (Sonnet; edit modunda)
  │       │    ├─ Stage 5: applyBlockPatch (surgical)
  │       │    ├─ Stage 6: sanitizeHtml (deny-by-default)
  │       │    ├─ Stage 7: renderGate (SEO/CSP)
  │       │    ├─ Stage 8: assembleDocument (belge)
  │       │    ├─ Stage 9: translateHtml (dil dönüşümü)
  │       │    ├─ Stage 10: tailwindCompile (CSS)
  │       │    └─ → designVars + compiledCssVersion theme'e yazılır
  │       │
  │       └─ [Legacy (V2 disabled)] generateSitePages() → replacePages
  │
  └─ GET /website-preview/{id}
      ├─ [format='html'] assembleDocument(sandbox)
      └─ [format='sections'] SiteRenderer
      
Public Site Serving
  ├─ GET /s/{subdomain}
  │   ├─ Dual-read: format='html' → assembleDocument
  │   │                          format='sections' → renderSectionsDocument
  │   └─ locale negotiation + home page lookup
  │
  ├─ POST /s/{subdomain}/lead
  │   ├─ Honeypot + rate-limit + validation
  │   └─ → notifySiteOwnerOfContact
  │
  └─ GET /s/{subdomain}/{slug}
      ├─ Multipage nav (data-yoai-href rewrite)
      └─ 404 ↔ home fallback (knownSlugs)
```

---

### 11. ÖNEMLİ DOSYA REFERANSLARI

```
/lib/website/
  ├─ types.ts                          — Website, Page, VersionMeta tipleri
  ├─ store.ts                          — Supabase RUD operations
  ├─ credits.ts                        — Kredi sabitleri + computeGenerationCost()
  │
  ├─ codegen/
  │   ├─ types.ts                      — CodegenContext, DesignSystem
  │   ├─ buildCodegenContext.ts        — Stage 0 (profile+refs+untrusted)
  │   ├─ designSystem.ts               — Stage 1 (Opus 4.8 tasarım)
  │   ├─ multipagePlan.ts              — Stage 2 (Opus sitemap)
  │   ├─ htmlGenerate.ts               — Stage 3 (Opus sayfa HTML'i)
  │   ├─ patchPlanner.ts               — Stage 5 (Sonnet patch planlama)
  │   ├─ applyBlockPatch.ts            — Stage 6 (cerrahi patch)
  │   ├─ sanitizeHtml.ts               — Stage 7 (deny-by-default)
  │   ├─ renderGate.mjs                — Stage 8 (yayın kapısı)
  │   ├─ assembleDocument.ts/mjs       — Stage 9 (belge montajı)
  │   ├─ translateHtml.ts/mjs          — Stage 10 (çeviri)
  │   ├─ tailwindCompile.ts/mjs        — Stage 11 (CSS derleme)
  │   │
  │   ├─ *.mjs (shared ESM)
  │   │   ├─ untrusted.mjs             — wrapUntrusted()
  │   │   ├─ sourcePriority.mjs        — buildReferenceDirective()
  │   │   ├─ designSystemValidate.mjs  — validateDesignSystem()
  │   │   ├─ multipagePlanShared.mjs   — validatePagePlan()
  │   │   ├─ htmlGenerateShared.mjs    — Block üreticileri (48KB)
  │   │   ├─ blockMap.mjs              — parseHtmlToBlockMap()
  │   │   ├─ patchPlannerShared.mjs    — validateOps()
  │   │   ├─ sanitizeAllowlist.mjs     — SAFE_TAGS, SAFE_ATTRS
  │   │   └─ ...
  │
  ├─ render/
  │   ├─ SiteRenderer.tsx              — Legacy sections → React
  │   ├─ designVars.ts                 — theme → CSS custom properties
  │   ├─ serveSectionsDocument.tsx     — HTML wrapper (legacy)
  │   ├─ serveCommon.ts                — pickLocale(), findHomePage(), SITE_CSP
  │
  ├─ ai/
  │   └─ generate.ts                   — generateSitePages() (legacy yol)
  │
  └─ contactNotify.ts                   — Email bildirimi
  
/app/
  ├─ (sites)/
  │   ├─ layout.tsx                    — Provider yok (provider'siz)
  │   └─ s/
  │       └─ [subdomain]/
  │           ├─ route.ts              — GET /s/<sub> (anasayfa)
  │           ├─ [slug]/route.ts       — GET /s/<sub>/<slug> (sayfa)
  │           └─ lead/route.ts         — POST /s/<sub>/lead (contact)
  │
  ├─ website-preview/[id]/page.tsx     — Owner-only iframe önizlemesi
  ├─ web-site-yoneticisi/
  │   ├─ page.tsx                      — Listesi
  │   └─ [id]/
  │       ├─ page.tsx                  — Detail (edit UI)
  │       └─ onizleme/page.tsx         — (Legacy ön izleme)
  │
  └─ api/website/[id]/
      ├─ route.ts                      — GET/PATCH/DELETE site meta
      ├─ generate/route.ts             — POST (AI üretim; codegen v2 yol)
      ├─ build/route.ts                — POST (hızlı üretim)
      ├─ pages/route.ts                — GET/PUT sayfalar
      ├─ versions/route.ts             — GET sürüm geçmişi
      ├─ publish/route.ts              — POST (yayınla)
      ├─ logo/route.ts                 — POST/DELETE logo
      ├─ domain/route.ts               — PUT custom domain (Faz 3)
      └─ contact/route.ts              — POST (contact form; PUBLIC)
  
/components/website/
  ├─ CreateSiteWizard.tsx              — 1-ekran sihirbazı
  ├─ DomainPanel.tsx                   — Özel domain UI (Faz 3)
  ├─ DesignPanel.tsx                   — Alan tasarımı UI (Faz C)
  └─ WizardBuildingAnimation.tsx       — Yükleme görünümü
```

---

### 12. HAZIRLANAN KAYNAKLAR (i18n)

Tüm kullanıcı metinleri **locales/{tr,en}.json** dosyalarından okunur:
- Wizard başlığı/alanlı/hata/CTA
- Detail sayfası sekmeler/butonlar/toast'lar
- Public site CSP başlığı / 404 mesajı

---

**SONUÇ:** Web Site Yoneticisi modulu **serbest-HTML mimarisi ile tam işlevsel**, 4-aşamalı Opus + Sonnet motoru, çok-dil/chat-edit/ön izleme, güvenli yayın kapısı ve cross-business sızıntı koruması ile hazırdır. Faz 3 (custom domain) ve Faz C (alan tasarımı) planlı ama şu anda /s/<subdomain> yol temel olarak aktiftir.

### ANALIZ: auth-credit-payment
Perfect! Now I have enough information to provide a comprehensive analysis. Let me compile the findings:

---

## KREDI + ABONELIK + ÖDEME SİSTEMİ ANALIZI

### 1. AUTH SISTEMI (Kullanıcı Kimliği & Onay)

**Dosyalar:**
- `/lib/auth/accountApproval.ts` — Manual onay akışı
- `/lib/auth/userCookie.ts` — Signed user_id çerezi (HMAC-SHA256)
- `signups` tablosu — email doğrulanması + onay durumu

**Mekanizması:**
1. **User Cookie (Güvenli):** `user_id` çerezi `${id}.${hmac(id)}` formatında imzalanır. `readUserId()` doğrulama yapar; geçersiz/taklit değerler reddedilir.
2. **Manual Approval Akışı:** 
   - Kayıt sonrası: `approval_status='pending'`
   - Email doğrulanmış olsa (`status='active'`) bile, iç panellere erişim için `approval_status='approved'` zorunlu
   - Owner allowlist (`SUPER_ADMIN_EMAILS`) → `onursuay@hotmail.com` otomatik onaylı
3. **Approval Statuses:** `pending | approved | rejected | call_scheduled | call_declined | needs_call | blocked | manual_review`
4. **Guardian Rules:** `isAccountApprovedForPanel()` → owner=true, blocked/manual_review=false, approved=true

---

### 2. KREDİ SİSTEMİ (Gerçek Zaman, Atomik)

**Tablolar:**
- `credit_balances` — `user_id | balance | total_earned | total_spent`
- `credit_transactions` — Defteri (ledger): `user_id | delta | reason | balance_after`

**Maliyet Sabitleri** (`lib/subscription/types.ts`):
- `COST_PER_GENERATION = 20` — AI tasarım/üretim
- `COST_PER_STRATEGY = 10` — Strateji oluşturma
- `COST_PER_AI_SCAN = 5` — Günlük limit sonrası AI tarama
- `FREE_CREDITS = 100` — Yeni kullanıcı hoş geldin kredisi

**Web Sitesi Kredileri** (`lib/website/credits.ts`):
- Landing (1 sayfa): base=40 + dilSayısı×40
- Multipage: (40 + (pageCount-1)×15) × localeCount
- Revizyon: ilk 3 revizyon ÜCRETSIZ, 4.+ revizyon = 10 kredi

**Atomik Mutasyonlar** (RPC tabanlı, `20260521000000_billing_atomic_credits_and_ledger.sql`):
```sql
add_credits(user_id, amount, reason)    → balance ↑ + ledger yaz
spend_credits(user_id, amount, reason)  → balance ↓ EĞER balance >= amount (atomik WHERE)
refund_credits(user_id, amount, reason) → balance ↑, total_spent ↓ (0'ın altında olmaz)
```

**Süreç:**
1. `chargeFeature()` → `spendCreditsServer()` çağrır (yetersizse null döner → 402 Insufficient Credits)
2. Hata olursa → `access.refund()` (async)
3. Owner bypass → kredi düşülmez, spent=0

---

### 3. ABONELIK SİSTEMİ (Tier + Limit)

**Tablolar:**
- `subscriptions` — `user_id | plan_id | status | billing_cycle | ad_accounts | trial_end_date | current_period_end`

**Planlar** (`lib/subscription/plans.ts`):

| Plan | Aylık USD | Yıllık USD | Ad Accounts | AI Scan Günlük | Strateji Aylık | Trial | Krediler |
|------|-----------|-----------|------------|---|---|---|---|
| **Basic** | $39–$84 (reklam/sayı) | $327.60–$705.60 | 2–6 | 3 | 1 | 0 | 50/ay |
| **Starter** | $79–$169 | $663.60–$1,417.80 | 2–6 | 3 | 3 | 0 | 150/ay |
| **Premium** | $159–$369 | $1,335.60–$3,100.80 | 2–6 | 10 | 10 | 14 gün | 500/ay |
| **Enterprise** | Satış iletişimi | Satış iletişimi | 7–50 | Sınırsız | Sınırsız | 14 gün | Uyarlamıştır |
| **Free** | Ücretsiz | Ücretsiz | 0 (deneme) | 0 | 0 | N/A | 100 (hoşgeldin) |

**Fiyatlandırma Mantığı:**
- Reklam hesap sayısına göre skallanır: `getMonthlyPrice(planId, adAccounts)`
- Yıllık indirim: 30% (`YEARLY_DISCOUNT = 0.70`)
- USD gösterim → TRY tahsilat: `toChargeTRY(usd) = usd × USD_TRY_RATE` (USD_TRY_RATE = 47)

**Status Geçişleri:**
- `trial` → `active` (ödeme alındı)
- `active` → `expired` (current_period_end geçti, otomatik lazy-check `getSubscription()`)
- `active` → `cancelled` (`cancel_at_period_end=true`, süresi sonunda expire)
- Deneme bitişinde otomatik ödeme yok; kullanıcı yeniden ödemeye yönlendirilir

**Lazy Expiry:** `getSubscription()` her çağrıda period/trial süresi kontrol eder, geçmişse `status='expired'` yapar.

---

### 4. ÖDEME AKIŞI (İyzico → Kredi/Abonelik Grant)

**Dosyalar:**
- `app/api/billing/iyzico/start/route.ts` — Checkout oluşturma
- `app/api/billing/iyzico/callback/route.ts` — Ödeme doğrulama + grant
- `lib/billing/iyzico.ts` — İyzico SDK wrapper

**Tablolar:**
- `payment_transactions` — `id | user_id | conversation_id | iyzico_token | iyzico_payment_id | item_type | plan_id | package_id | amount | currency | status | grant_status | raw_init | raw_callback | processed_at`

**Akış Adımları:**

1. **Start** (`POST /api/billing/iyzico/start`):
   - User'dan type (subscription|credit_pack) + planId/packageId alır
   - Server-side fiyatlandırma: `priceSubscription()` veya `priceCreditPack()`
   - `createPendingTransaction()` DB'ye yazıyor (status='pending')
   - İyzico checkout form: `initCheckoutForm()` → token + paymentPageUrl
   - Token'ı `attachIyzicoToken()` ile tx'e bağlıyor

2. **Callback** (`POST/GET /api/billing/iyzico/callback`):
   - İyzico token POST/GET ile geri gönderir
   - `findTransactionByToken()` tx bulur
   - `retrieveCheckoutForm(token)` ile İyzico'dan durum sorgulanır
   - **Atomik Check:** `markTransactionSucceeded()` → `pending→succeeded` SADECE bu çağrı geçerken (eşzamanlı retry'de ikinci çağrı kazanmaz)
   - **Grant Non-Atomik (Ayrı try/catch):**
     ```
     if (won) {  // bu callback ödemeyi kazandıysa
       try {
         if (item=subscription) applySubscriptionPurchase()
         if (item=credit_pack)  addCreditsServer()
         setGrantStatus='granted'
       } catch {
         setGrantStatus='failed'  // ödeme alındı, grant başarısız → reconcile
       }
     }
     ```
   - Sonuç: `/abonelik?payment=success` (grant başarılı) veya `?payment=success&reason=activation_pending` (ödeme alındı, grant başarısız → manuel reconcile)

**Kritik:** 
- `markTransactionSucceeded()` atomik (WHERE status='pending') → eşzamanlı callback'te tek çağrı kazanır
- Grant başarısızlığında müşteriye 'failed' gösterilmez (çift ödeme riski) → 'activation_pending' (para alındı, kurulumu bekleniyor)
- `grant_status` kolon: `pending | granted | failed` (reconcile için)

---

### 5. KREDI/ABONELIK ERİŞİM KAP1SI

**Dosyalar:**
- `lib/billing/featureGuard.ts` — Sunucu-tarafı koruma
- `lib/billing/featureAccessMap.ts` — Feature registry
- `components/billing/AccessRequiredModal.tsx` — UI kapısı (kapatılamaz)

**Feature Access Rules:**

```typescript
export const FEATURE_ACCESS = {
  // Abonelik gerektiren
  optimization: { tier: 'subscription_required' },
  strategy: { tier: 'subscription_required' },
  yoalgoritma: { tier: 'subscription_required' },
  seo: { tier: 'subscription_required' },
  
  // Kredi gerektiren
  optimization_ai_scan_pro: { tier: 'credit_required', creditCost: 5 },
  design_generation: { tier: 'credit_required', creditCost: 20 },
  website_generation: { tier: 'credit_required', creditCost: 40–200 },
  yoalgoritma_chat: { tier: 'credit_required', creditCost: per-message },
  strategy_overage: { tier: 'credit_required', creditCost: 10 },
}
```

**Server-side Guard** (`chargeFeature()`):
```typescript
chargeFeature({ 
  featureKey: 'design_generation', 
  creditCost: 20,
  requireSubscription?: true
})
→ {
  ok: boolean
  user: AuthenticatedUser
  isOwner: boolean
  spent: number (charged credits)
  refund: () => Promise<void>
}
```

- Owner bypass: `isSuperAdminEmail()` → spent=0, refund=no-op
- `requireSubscription=true` → `hasActiveSubscription()` kontrol
- `creditCost > 0` → `spendCreditsServer()` (atomik, yetersizse null→402)
- Hata → `access.refund()` çağrısı

**Modal Davranışı:**
- Blur backdrop (`backdrop-blur-md` + `bg-black/50`)
- Kapatma X yok, ESC kapatmaz, dış tıklama kapatmaz
- Body scroll lock
- CTA: kredi → `/abonelik#krediler`, abonelik → `/abonelik`
- Owner'lar modal görmez (redirect kütüphanesi owner check'inde modal koşulsuz return)

---

### 6. WEB SİTESİ KURUCU ENTEGRASYONU (Kredi Sistemi)

**Dosya:** `app/api/website/[id]/generate/route.ts`

**Akış:**

1. **İlk Üretim:**
   - `computeGenerationCost()`: landing=40 kredi, multipage=(40+15×extra)×dil
   - `chargeFeature('website_generation', cost)` → kredi düş

2. **Revizyon:**
   - `listVersions()` → revision sayısı say
   - İlk 3 revizyon: ÜCRETSIZ
   - 4.+ revizyon: 10 kredi/revision
   - `chargeFeature('website_generation', revisionCost)`

3. **Hata Handling:**
   ```typescript
   const access = await chargeFeature(...)
   if (!access.ok) return { status: access.status, body: access.body }
   
   try {
     generateSitePages()  // AI üretim
     replacePages()       // DB yaz
     createVersion()      // Snapshot
   } catch {
     await access.refund()  // Hata → kredi iade
     throw
   }
   ```

4. **Codegen v2 (Yeni HTML Motor):**
   - `applyBlockPatch()`: Chat-edit → cerrahi blok-patch (fallback: tam üretim)
   - Başarılı patch → 1 sayfa revize, version kaydedilir (tam maliyetle)
   - Gate fail (bozuk site) → iade + 422 (canlıya çıkmaz)

**Veri Bağlamı:**
- Site brief: `getProfileByUserId()` + `getIntelligenceByUserId()` (işletme profili)
- **Kritik:** Hiçbir zaman global profil fallback'e düşülmez → farklı firma profili riski

---

### 7. KREDİ PAKETI KATALOGU

**`lib/billing/catalog.ts`:**

```typescript
CREDIT_PACKAGES = {
  'pkg-100':  { credits: 100,  amountUsd: 9,  → TRY: 423 },
  'pkg-500':  { credits: 500,  amountUsd: 39, → TRY: 1833 },
  'pkg-1000': { credits: 1000, amountUsd: 69, → TRY: 3243 },
}

priceCreditPack(packageId) → PricedCreditPack {
  credits, amount (TRY), amountUsd, currency='TRY'
}
```

---

### 8. TEMEL ROUTING & API'LER

| Endpoint | Method | İş |
|----------|--------|-----|
| `GET /api/billing/current` | GET | User + subscription + credits (`isOwner: true` → enterprise stub) |
| `POST /api/billing/iyzico/start` | POST | Checkout oluştur (İyzico token) |
| `POST/GET /api/billing/iyzico/callback` | POST/GET | Ödeme callback (grant) |
| `POST /api/billing/cancel` | POST | Aboneliği iptal et (cancel_at_period_end) |
| `POST /api/website/[id]/generate` | POST | Web sitesi üret/revize (kredi düş) |

---

### 9. WEB BUILDER'IN KREDİ SİSTEMİ BAĞLANTISI

**Net API'ler Web Builder Tarafından Kullanılan:**

1. **Kredi Durumu Okuma:**
   ```typescript
   GET /api/billing/current → {
     credits: { balance, totalEarned, totalSpent },
     isOwner: boolean
   }
   ```

2. **Üretim Tetikleme (Kredi Çekici):**
   ```typescript
   POST /api/website/[id]/generate → {
     ok: boolean,
     creditCharged: number,
     pages: WebsitePageInput[]
   }
   ```

3. **Hata Handling:**
   - 402 Insufficient Credits → `AccessRequiredModal type="credit"`
   - 403 Subscription Required → `AccessRequiredModal type="subscription"`
   - 422 Generation Failed (gate) → Retry veya hata mesajı

4. **Event/Telemetry:**
   - `chargeFeature(featureKey: 'website_generation')` → `credit_transactions` ledger kaydı
   - Reason: 'website_generation' (belirtilirse) veya 'spend'

---

### 10. KREDİ EVENT LOGLAMA ŞEMASI

**Tablo:** `credit_transactions` (değişmez ledger)

```
id (uuid) | user_id | delta | reason | balance_after | created_at
────────────────────────────────────────────────────────────────
...       | user-1  | -20  | design_generation | 80 | 2026-06-17...
...       | user-1  | -10  | strategy_overage  | 70 | 2026-06-17...
...       | user-1  | +500 | purchase (pkg-500)| 570 | 2026-06-17...
...       | user-1  | +100 | bundled (premium) | 670 | 2026-06-18...
...       | user-1  | +20  | refund (website_generation_refund) | 690 | 2026-06-18...
```

**Reason Kategorileri:**
- `spend` — Genel harcama (legacy)
- `design_generation`, `website_generation`, `yoalgoritma_chat` vb. — Feature-specific
- `refund`, `{feature}_refund` — İade
- `purchase` — Kredi paketi satın alma
- `bundled` — Abonelikle dahil kredi
- `grant` — Admin hibelik

**Event Semantiği:**
- Her mutasyon 1 ledger satırı
- `balance_after` immutable (denetim)
- `reason` telemetri/support için

---

### 11. PROMPT'UN KREDİ SİSTEMİNE UYUMU

**Web Builder Prompt Mühendisliği İçin Bağlam:**

1. **Adım-adım Düşünme:**
   - Kullanıcı web sitesi talep eder → `/api/website/[id]/generate` POST
   - Backend: kredi kontrol + düş (atomik, ASLA tam harcamazsanız iade)
   - LLM: prompt ejecuta (Claude AI) → generateHtmlSite()
   - Hata → refund(), kullancı para iade görür

2. **Credit Events Log (Telemetri):**
   - Hangi prompt → hangi kredi maliyeti (20 = tasarım, 40–200 = web sitesi)
   - Başarı/başarısızlık → ledger'da görünür (reason='refund' varsa başarısız)
   - Support audit: "user-X neden 2026-06-17 200 kredi düştü?" → `reason='website_generation'` döner

3. **Platform-Hatası Kredisi Düşmez:**
   - İyzico callback başarısız → `grant_status='failed'` → manual reconcile (çift ödeme risk)
   - Website generate gate fail → auto-refund + 422
   - Owner (super-admin) → kredi düşülmez (spent=0)

4. **Maliyet Kalibrasyonu:**
   - Gerçek üretim maliyeti (Claude API tokens × rate) temel
   - Web sitesi: landing=40, multipage=(40+15×extra)×dil → 3 dil = 3× maliyet

---

### ÖZET: NET ÇIKTI

**Web Builder'in Bağlanacağı API'ler:**

| İşlem | Endpoint | Kredi Maliyeti | Hata Kodu |
|-------|----------|---|---|
| Durumu oku | `GET /api/billing/current` | 0 | 401 (auth) |
| Sitesi üret (ilk) | `POST /api/website/[id]/generate` | computeGenerationCost() | 402 (yetersiz), 403 (sub) |
| Sitesi revize | `POST /api/website/[id]/generate` (rev mode) | 0 (ilk 3) / 10 (4.+) | 402, 403 |
| Kredi paketi satın al | `POST /api/billing/iyzico/start` | (kendi çizimleriyle) | 400 (invalid) |
| Ödeme callback | `POST /api/billing/iyzico/callback` | (grant) | 303 redirect |

**Kredi/Event Log Mekanizması:**
- ✅ **Atomik:** `spendCreditsServer()` RPC → 0 satır = yetersiz
- ✅ **Auditable:** `credit_transactions` ledger → her işlem kaydı
- ✅ **Recoverable:** Hata → `refund()` (RPC, atomik)
- ✅ **Owner-bypass:** `isSuperAdminEmail()` → spent=0
- ✅ **Entitlement-tracking:** `grant_status` kolon → failed=reconcile gerek

**Prompt-Ready Kredi Sistemi:**
- Adım-adım düşünme: kredi düş → üret → hata/başarı
- Credit events: `reason` field ile telemetri
- Platform hatası: owner bypass + refund mekanizması

---

Komplet sistem analizi tamamlandı. Web builder bu API'lere bağlanacak ve mevcut kredi/abonelik infrastrüktürü tam kapsamlı denetim + recovery sağlamaktadır.

### ANALIZ: dashboard-ui-gozetim
Excellent! Now let me create a comprehensive summary document by gathering all the key information:

## PROJE ANALİZİ: YoAi Dashboard & Admin Panel Mimarisi

### **1. DASHBOARD SHELL & LAYOUT**

**Klasik 2-kolon Dashboard Yapısı:**
- **Root Layout:** `/app/layout.tsx` — Global providers (NextIntlClientProvider, CreditProvider, SubscriptionProvider)
- **Dashboard Layout:** `/app/dashboard/layout.tsx` — SidebarNav + MainContent wrapper
  - SidebarNav: Sidebar navigasyonu (260px normal, 72px collapsed)
  - MainContent: Esnek kolon (`flex-1 flex flex-col overflow-y-auto`)
  - AccountApprovalGuard: Oturum kontrolü

**İçerik Yüzeyi (app-content-surface):**
- **CSS Tanımı** (`/app/globals.css` satır 18-20):
  ```css
  .app-content-surface {
    @apply bg-gradient-to-b from-emerald-50/40 via-white to-emerald-50/20;
  }
  ```
- **Kullanım:** Tüm modül sayfalarında StandardHTML yapısı:
  ```html
  <div className="flex-1 overflow-y-auto app-content-surface p-6">
    <div className="max-w-7xl mx-auto ...">…</div>
  </div>
  ```
- **Yerleri:** `/app/strateji/`, `/app/optimizasyon/`, `/app/raporlar/`, `/app/donusum-sihirbazi/` vb.

---

### **2. SIDEBAR & NAVİGASYON**

**Navigasyon Yapısı:** `/lib/nav.ts`

**Mevcut Modüller (navItems):**
1. **Reklam** (Grup):
   - Meta `/meta-ads`
   - Google `/google-ads`
   - TikTok `/tiktok-ads` (disabled)
2. **Strateji** `/strateji`
3. **Optimizasyon** `/optimizasyon`
4. **YoAi** `/yoalgoritma` (YoAlgoritma)
5. **Hedef Kitle** `/hedef-kitle`
6. **Tasarım** `/tasarim`
7. **Sosyal Medya Yönetimi** `/sosyal-medya`
8. **Raporlar** `/raporlar`
9. **SEO Plus** `/seo-plus`
10. **Web Site Yöneticisi** `/web-site-yoneticisi`
11. **CRM** `/crm-sistemi`
12. **Email Marketing** `/email-marketing`
13. **Entegrasyon** `/entegrasyon`

**Dinamik Menü Öğeleri (SidebarNav.tsx satır 14-48):**
- **Gözetim Merkezi** (`gozetimMerkeziNavItem`): Yalnızca admin yetkisine sahip oturumlar görür
  - `/api/admin/me` isteğiyle dinamik kontrol
  - Normal kullanıcı için hiç sızıntı yok (404 ile gizlenir)
- **Dönüşüm Sihirbazı** (`marketingSetupNavItem`): Owner veya MARKETING_SETUP_ENABLED flag açıkken
  - `/api/marketing-setup/visibility` isteğiyle dinamik kontrol

**Sidebar Özellikler:**
- Collapse/expand toggle (localStorage: `sidebar_collapsed`)
- CSS dynamic width: `--sidebar-width` (260px → 72px)
- Gruppe tıklanabilir (dropdown açılır/kapanır)
- İngilizce/Türkçe i18n desteği (NEXT_LOCALE cookie)
- Collapsed hint animation (5s logo → 1s expand button → loop)

---

### **3. TOPBAR (Header)**

**Bileşen:** `/components/Topbar.tsx`

**Yapı:**
```
[Başlık + Açıklama] [Bildirim Ticker] [Platform Accountları] [İşlem Butonu]
```

**Elemanlar:**
1. **Sol:** `title` + `description` (h1 + p)
2. **Orta:** Bildirim Ticker (eğer `showTicker=true`)
   - Real data from `/api/notifications?context={pageContext}`
   - Animasyonlu: 6s/notif (4.5s visible + 1.5s exit)
   - SVG beam border (yeşil glow)
3. **Sağ Küme:**
   - `accountSwitcherSlot` (sayfa-spesifik dropdown, örn. Google Ads)
   - Meta Ads hesap dropdown (multiAccount desteği)
   - `actionButton` (CTA, örn. "Kampanya Oluştur")

---

### **4. WEB SITE YÖNETİCİSİ (Builder Workspace)**

**Route Yapısı:**
- **Anasayfa:** `/web-site-yoneticisi` (`page.tsx`)
  - Site listesi (scroll-snap tam-ekran galeri)
  - "Yeni Site" butonu → CreateSiteWizard
- **Düzenleme:** `/web-site-yoneticisi/[id]` (`page.tsx`)
  - Site builder (çoklu dil + sayfa desteği)
  - Device preview (desktop/tablet/mobile)
  - AI üretimi + Quick build
- **Önizleme/Yayın:** `/web-site-yoneticisi/[id]/onizleme` (`page.tsx`)
  - Revize modu (edit/reject feedback)
  - Yayın onayı butonu

**Layout:** `/app/web-site-yoneticisi/layout.tsx`
- BusinessProfileGuard wrapper
- SidebarNav + flex-1 div (builder sayfası buraya gelir)

**Builder Topbar (Düzenlemede):**
```tsx
<Topbar
  title={site.label}
  description={t('subtitle')}
  actionButton={{ label: 'Yayınla', onClick: handlePublish }}
/>
```

**Publish Popup (Yayın Modalı):**
- `/app/web-site-yoneticisi/[id]/onizleme/page.tsx` satır 127-141
  - `approve()` fonksiyonu → `POST /api/website/{id}/publish`
  - Başarılı olunca: site durum güncellenir, toast gösterilir
  - İşlemi yapan: approve butonu (Approve and Publish)

**Builder Animasyonları:**
- `animate-card-enter` (sayfa kartları, site listesi)
- `wsy-assemble` / `wsy-shimmer` (AI yükleme animasyonu)
- `wsy-revising` (revize göstergesi, overlay pulse)

---

### **5. GOZETIM MERKEZI (Admin Panel)**

**Route:** `/app/gozetim-merkezi/`
- **Sayfa:** `/gozetim-merkezi/page.tsx` (server component)
  - Permission guard: `getIsCurrentUserSuperAdmin()` → 404 redirect
- **Client Component:** `/gozetim-merkezi/GozetimMerkeziClient.tsx` (32KB)

**Yetki Sistemi:** `/lib/admin/superAdmin.ts`
- **Default:** `onursuay@hotmail.com`
- **Env Override:** `SUPER_ADMIN_EMAILS` (virgülle ayrılmış liste)
- **Doğrulama:** `user_id` cookie (httpOnly) → signups tablosundan email okuması
- **Güvenlik:** Server-side doğrulama; normal kullanıcıya "admin alanının varlığını" ipucu vermez

**Admin Keşif Endpoint:** `/api/admin/me`
- Response: `{ ok: true, hasAccess: boolean }`
- Tüm oturumlar 200 alır (yetkisiz için `hasAccess: false`)
- SidebarNav dinamik Gözetim Merkezi menüsü bu flag'e göre render eder

**Admin Data Endpoint:** `/api/admin/gozetim-merkezi/route.ts`
- GET konsolideli dashboard datası:
  - **KPI'lar:** Toplam kullanıcı, onboarding durumu, scan status dağılımı
  - **Kullanıcılar + Profiller:** Detaylı iş profili (site kaynaklarını, tarama durumunu, marka zekası)
  - **Hata Raporları:** Failed scan'lerin tipi dağılımı + recent failures
  - **YoAlgoritma Sağlığı:** Hiyerarşik kart üretimi koşuları (14 günlük pencere)
- Response yapısı: `{ ok: true, kpis, profiles, recentSignups, errorTypeCounts, recentFailedScans, yoalgoritmaHealth, diagnostics }`

**Admin Paneli Sekmesi Yapısı:**
1. **Başvurular** (`SignupApprovalsPanel.tsx`) — Kullanıcı onayı yönetimi
   - Durumlar: pending, call_scheduled, call_declined, manual_review, approved, rejected, blocked
   - Sesli uyarı + polling
2. **KPI Kartları:** Toplam/tamamlanan/hata sayıları
3. **Profil Listesi:** Tarama durumu, marka zekası
4. **Hata Raporları:** Failed scans + tipleri

---

### **6. UI STANDARTLARI (CLAUDE.md)**

**Content Width:**
```css
max-w-7xl mx-auto
```

**Typography:**
- **Başlıklar:** `text-base font-semibold text-gray-900` (14-16px)
- **Modül başlığı:** `text-xl font-bold` veya `text-2xl font-bold`
- **Caption:** `text-caption` (12px, yalnız meta/zaman/yardımcı etiket)
- Boy Scout Kuralı: Hatalı text-sm → text-base yükselt

**Animasyonlar:**
- `animate-card-enter` (staggered 80ms, `--card-index`)
- `hover:shadow-md transition-all duration-300` (kartlar)
- `hover:bg-gray-50/60 transition-colors` (liste satırları)
- Print/PDF: `opacity: 1 !important; animation: none !important;`

**Renkler:**
- **YASAK:** amber/yellow (`bg-amber-*`, `text-yellow-*`)
- **Uyarı:** `text-primary` + `bg-primary/5` (#059669)
- **Başarı:** `bg-emerald-50` + `text-emerald-700`
- **Hata:** `bg-red-50` + `text-red-700`

**WizardSelect:**
- Kanonik dropdown: `/components/meta/wizard/WizardSelect.tsx`
- Meta tarzı: `rounded-xl` + `shadow-[0_1px_3px_rgba(...)]`
- Açık: `border-primary ring-2 ring-primary/20`
- Ok: `ChevronDown` (180° döner)

**Audience Chip Rengi:**
- Tüm kitle segmentleri: `bg-emerald-50` + `text-emerald-700` (kategori farkı yok)

**i18n (next-intl):**
- Locale: NEXT_LOCALE cookie (default `tr`)
- Client: `useTranslations('namespace.path')` → `t('key')`
- Server: `getTranslations('namespace.path')`
- Dosyalar: `locales/tr.json` + `locales/en.json`

---

### **7. ACCESS CONTROL & MODALS**

**AccessRequiredModal:** `/components/billing/AccessRequiredModal.tsx`
- `type="credit"` → Kredi yükleme (Sparkles + Zap ikon)
- `type="subscription"` → Abonelik (ShieldCheck + Lock ikon)
- Özellikleri: Blur backdrop, kapatma X yok, body scroll lock

**BusinessProfileGuard:** `/components/yoai/BusinessProfileGuard.tsx`
- Web Site Yöneticisi'nde kullanılır
- İşletme profili eksikse modal gösterir

---

### **8. DOSYA HARITASI (NET ÖZET)**

| Dosya/Klasör | Amaç |
|---|---|
| `/app/layout.tsx` | Global providers |
| `/app/dashboard/layout.tsx` | Dashboard shell (sidebar + main) |
| `/app/dashboard/HomePage.tsx` | Dashboard KPI'ları |
| `/lib/nav.ts` | Navigation items (sabit + dinamik) |
| `/lib/routes.ts` | Route tanımları + i18n mapping |
| `/components/SidebarNav.tsx` | Sidebar bileşeni |
| `/components/Topbar.tsx` | Header/topbar |
| `/components/MainContent.tsx` | Content wrapper |
| `/app/globals.css` | `.app-content-surface` tanımı |
| `/app/web-site-yoneticisi/page.tsx` | Builder anasayfa (site listesi) |
| `/app/web-site-yoneticisi/[id]/page.tsx` | Site editor |
| `/app/web-site-yoneticisi/[id]/onizleme/page.tsx` | Yayın preview/onay |
| `/components/website/SiteList.tsx` | Site gallery (snap-scroll) |
| `/app/gozetim-merkezi/page.tsx` | Admin dashboard |
| `/components/gozetim/GozetimMerkeziClient.tsx` | Admin client UI |
| `/lib/admin/superAdmin.ts` | Admin yetki kontrolü |
| `/app/api/admin/me` | Admin discovery endpoint |
| `/app/api/admin/gozetim-merkezi/route.ts` | Admin konsolideli data |

---

### **9. TASARIMI UYGULANACAK YENI BÖLÜMLERİN KONUMU**

**Builder Workspace Öğeleri:**
1. **Builder Topbar:** `/app/web-site-yoneticisi/[id]/page.tsx` satır 200+
   - Tailwind sınıfları + i18n çeviriler
2. **Publish Popup:** `/app/web-site-yoneticisi/[id]/onizleme/page.tsx` satır 200+
   - Modal/drawer yapısı (şu anda inline buton)
3. **Builder Workspace Görünümü:** `/app/web-site-yoneticisi/[id]/page.tsx`
   - iframe preview + kontrol panelleri

**Admin Panel Öğeleri:**
1. **KPI Kartları:** `/components/gozetim/GozetimMerkeziClient.tsx`
   - `animate-card-enter` + `max-w-7xl`
2. **Hata Rapor Tablosu:** Aynı bileşen
   - `text-base font-semibold` başlık + WizardSelect filtreleri
3. **Tarama Durumu Göstergesi:** Profil satırlarında
   - `scan_status: 'completed' | 'running' | 'failed' | 'pending'`

---

**ÖZETİ:** Dashboard 2-kolon shell (sidebar + content) kullanır, tüm modüller `app-content-surface` (emerald gradient) + `max-w-7xl` layout izler. Admin Gözetim Merkezi `/gozetim-merkezi/` altında, yetki-tabanlı gizlidir (server-side guard + 404 fallback). Builder Web Site Yöneticisi'nde `/web-site-yoneticisi/` altında, multi-step (editor → preview → publish). Tüm UI `animate-card-enter`, `text-base font-semibold`, primary yeşil rengini takip eder; amber/sarı **YASAK**.

### ANALIZ: db-schema
Perfect. Now I have enough information. Let me compile the comprehensive analysis:

## DB ŞEMA ANALİZİ — Web Site Yöneticisi Worktree

### MEVCUT DURUM

#### 1. Website Tables (20260614120000 + 20260617120000)

**websites**
- `id` UUID PK, `user_id` TEXT (user isolation), `label` TEXT (site adı)
- `subdomain` TEXT UNIQUE (sitenin DNS adresi)
- `site_type` ENUM: 'landing' | 'multipage' (default 'multipage')
- `default_locale` TEXT (default 'tr'), `locales` TEXT[] (multi-dil)
- `category` TEXT (opsiyonel)
- `status` ENUM: 'draft' | 'published' | 'unpublished' (default 'draft')
- `theme` JSONB (tema ayarları - flex yapı)
- `published_version_id` UUID (mevcut canlı sürüm işaretçisi)
- `created_at`, `updated_at` TIMESTAMPTZ
- **Index:** `idx_websites_subdomain` (UNIQUE), `idx_websites_user_created`
- **RLS:** `websites_own` policy (user_id match)

**website_pages**
- `id` UUID PK, `website_id` UUID FK→websites(CASCADE)
- `locale` TEXT (dil), `slug` TEXT (URL yolu)
- `page_role` TEXT (landing/contact/product vb.)
- `sections` JSONB (sayfa bölümleri - varsayılan `[]`)
- `seo` JSONB (SEO meta - başlık/açıklama)
- `order_index` INTEGER (sayfa sırası)
- `html` TEXT (kod-üretim çıktısı - 20260617 migration)
- `format` ENUM: 'sections' | 'html' (varsayılan 'sections')
- `created_at`, `updated_at` TIMESTAMPTZ
- **Index:** `idx_website_pages_unique` (website_id, locale, slug UNIQUE), `idx_website_pages_website`
- **RLS:** `website_pages_own` policy (FK üzerinden websites kontrolü)

**website_versions**
- `id` UUID PK, `website_id` UUID FK→websites(CASCADE)
- `snapshot` JSONB (tüm sayfa/tema snapshot'ı - yedekleme)
- `reason` ENUM: 'initial' | 'revision' | 'rollback' (geçmiş takibi)
- `credit_charged` INTEGER (AI üretim maliyeti)
- `created_at` TIMESTAMPTZ
- **Index:** `idx_website_versions_website` (website_id, created_at DESC)
- **RLS:** `website_versions_own` policy (FK üzerinden)

**Migration Adlandırması Kuralı:** `YYYYMMDDHHMMSS_snake_case_description.sql`
- Zaman bölümü 14 haneli (saat:dakika:saniye precision)
- İlk 8 hane: tarih; devamı 6 hane: saat-dakika-saniye
- NFC/NFD uyarısı: Türkçe path'lerde NFD normalize sorunları (dosya ismi ASCII → güvenli)

---

#### 2. Mevcut Billing & Credit Sistemi

**subscriptions** (20260420000000)
- `user_id` UUID PK FK→signups(CASCADE)
- `plan_id` ENUM: 'free'|'basic'|'starter'|'premium'|'enterprise'
- `status` ENUM: 'trial'|'active'|'cancelled'|'expired'
- `billing_cycle` ENUM: 'monthly'|'yearly'
- `ad_accounts` INT (plan limit)
- `trial_end_date`, `current_period_end`, `started_at`, `updated_at` TIMESTAMPTZ

**credit_balances** (20260420000000)
- `user_id` UUID PK FK→signups(CASCADE)
- `balance` INT (aktif bakiye), `total_earned` INT, `total_spent` INT
- `updated_at` TIMESTAMPTZ

**credit_transactions** (20260521000000 - ledger tablosu)
- `id` UUID PK, `user_id` UUID FK
- `delta` INT (±değişim), `reason` TEXT (purchase|bundled|grant|spend|refund)
- `balance_after` INT (operasyondan sonra bakiye)
- `created_at` TIMESTAMPTZ
- **Index:** `idx_credit_transactions_user` (user_id, created_at DESC)
- **RPC fonksiyonları:** `add_credits()`, `spend_credits()`, `refund_credits()` (atomik, ledger otomatik)

**payment_transactions** (20260420000000)
- `id` UUID PK, `user_id` UUID FK→signups(CASCADE)
- `conversation_id` TEXT UNIQUE (Iyzico session)
- `iyzico_token`, `iyzico_payment_id` TEXT UNIQUE
- `item_type` ENUM: 'subscription'|'credit_pack'
- `plan_id`, `package_id`, `billing_cycle`, `ad_accounts` (meta)
- `amount` NUMERIC, `currency` TEXT (default 'TRY')
- `status` ENUM: 'pending'|'succeeded'|'failed'|'processed'
- `raw_init`, `raw_callback` JSONB (tam webhook kaydı)
- `processed_at` TIMESTAMPTZ
- **Index:** `idx_payment_transactions_user`, `idx_payment_transactions_status`

---

#### 3. CRM Tables (20260530000000)

**crm_page_subscriptions**
- `id` UUID PK, `user_id` UUID FK→signups(CASCADE)
- `page_id` TEXT UNIQUE (Facebook page), `page_name` TEXT
- `subscribed_at` TIMESTAMPTZ
- **Index:** `idx_crm_page_subs_user`
- **RLS:** `crm_page_subs_select_own` (SELECT only)

**crm_leads**
- `id` UUID PK, `user_id` UUID FK, `source` TEXT (default 'meta')
- `meta_leadgen_id` TEXT, `meta_form_id`, `meta_page_id`, `form_name`, `ad_id`, `campaign_name` TEXT
- `full_name`, `email`, `phone` TEXT
- `raw_field_data` JSONB (form alanları)
- `status` ENUM: 'new'|'positive'|'negative' (default 'new')
- `note` TEXT, `lead_created_time` TIMESTAMPTZ
- `created_at`, `updated_at` TIMESTAMPTZ
- **Index:** `idx_crm_leads_user_status`, `idx_crm_leads_user_created`
- **Constraint:** `UNIQUE (user_id, meta_leadgen_id)` (webhook idempotency)
- **RLS:** SELECT/UPDATE own (SELECT USING, UPDATE WITH CHECK on user_id)

---

#### 4. Social Media Tables (20260617000000)

**social_projects**
- `id` UUID PK, `user_id` TEXT, `business_scope` TEXT (null = tüm hesaplar)
- `name` TEXT, `color` TEXT (default '#10b981' — yeşil)
- `status` ENUM: 'active'|'archived'
- `created_at`, `updated_at` TIMESTAMPTZ
- **Index:** `idx_social_projects_user`

**social_scheduled_posts**
- `id` UUID PK, `user_id` TEXT, `project_id` UUID FK (SET NULL)
- `format` ENUM: 'feed'|'reels'|'story'
- `caption` TEXT, `scheduled_at` TIMESTAMPTZ
- `timezone` TEXT (default 'Europe/Istanbul')
- `status` ENUM: 'draft'|'scheduled'|'publishing'|'published'|'failed'|'cancelled'
- `attempts` INT, `last_error` TEXT, `next_retry_at` TIMESTAMPTZ
- `published_at` TIMESTAMPTZ, `source` ENUM: 'upload'|'tasarim'
- `created_at`, `updated_at` TIMESTAMPTZ
- **Index:** `idx_social_posts_due` (status, scheduled_at), `idx_social_posts_user_date`, `idx_social_posts_project`

**social_post_targets**
- `id` UUID PK, `post_id` UUID FK→social_scheduled_posts(CASCADE)
- `platform` ENUM: 'instagram'|'facebook'
- `page_id` TEXT, `ig_user_id` TEXT, `account_label` TEXT
- `target_status` ENUM: 'pending'|'published'|'failed'
- `target_error` TEXT, `published_id` TEXT
- `created_at` TIMESTAMPTZ
- **Index:** `idx_social_targets_post`

**social_post_media**
- `id` UUID PK, `post_id` UUID FK→social_scheduled_posts(CASCADE)
- `media_type` ENUM: 'image'|'video'
- `storage_path` TEXT, `public_url` TEXT
- `sort_order` INT, `width`, `height` INT, `duration` NUMERIC
- `created_at` TIMESTAMPTZ
- **Index:** `idx_social_media_post` (post_id, sort_order)

---

#### 5. User Foundation (signups)

**signups** (20260323200000)
- `id` UUID PK, `name`, `email` TEXT UNIQUE, `company`, `phone` TEXT
- `verification_token` TEXT UNIQUE
- `status` ENUM: 'pending'|'active'|'expired' (email verification akışı)
- `verified_at` TIMESTAMPTZ, `created_at` TIMESTAMPTZ
- **Index:** `idx_signups_email`, `idx_signups_token`, `idx_signups_status`

---

### YENİ TABLOLAR İÇİN İNTEGRASYON MAPI

| **Yeni Tablo** | **Mevcut Yapı ile İlişki** | **Entegrasyon Notları** |
|---|---|---|
| **website_blocks** | website_pages.sections JSONB → tablo | sections[]'deki her blok ayrı satır; section id'leri FK ile; carousel/grid/form editörlüğü kolaylaşır |
| **website_assets** | website_versions/website_pages | Görüntü/video/font store (Supabase Storage path + public_url, social_post_media gibi) |
| **website_products** | website_pages (product page role) | E-commerce entegrasyon; `product_id`, `sku`, `price`, `inventory` kol'ları |
| **website_orders** | website_products + credit_transactions (billing model benzer) | Atomik order + item list, payment status tracking |
| **website_forms** | website_pages (form role) | crm_leads model'e paralel; form_id, field_definitions JSONB, submissions_count |
| **website_domains** | websites.subdomain | CNAME/A record yönetimi; domain_status: 'pending_dns'|'verified'|'failed' |
| **website_deployments** | website_versions.credit_charged | Yayın akışı; scheduled_at, deployed_at, status enum, rollback_to_version_id |
| **website_credit_events** | credit_transactions (ledger model) | website-specific spending: codegen_cost, optimization_cost, publish_cost; reason: 'website_codegen'|'website_optimize'|'website_publish' |
| **website_publish_events** | website_versions + website_deployments | Yayın geçmişi; before/after snapshot, change_summary JSONB |
| **website_edit_events** | website_versions (fakat granular) | Her edit'in kim/ne zaman/ne değişti; delta JSONB, user_ip; audit log |
| **website_templates** | websites | Site şablonları; standart layout/block/theme'ler; system=true for built-ins |
| **website_component_library** | website_blocks | Reusable block/component'ler; block_definition JSONB (schema, default values); shared=true for team |
| **website_integrations** | crm_leads (Meta Leadgen) / social_scheduled_posts | Form→CRM, Analytics API bağlantısı, Email (MailChimp vb.), Payment gateways (Stripe vb.) |
| **website_error_reports** | website_pages (404/500 tracking) | Status 4xx/5xx pages + client-side JS errors; reported_at, error_type, resolved |
| **website_repair_attempts** | website_error_reports | Auto-repair log; repair_type: 'regenerate'|'restore_version'|'manual_fix'; status, result_summary JSONB |

---

### SCHEMA DESIGN PRENSIPLERI (Mevcut Kod'dan Çıkarılan)

1. **User Isolation:** `user_id` TEXT (Supabase auth.uid()::text normalize) veya UUID REFERENCES signups(id) — her satırda mandatory
2. **RLS Pattern:** ALTER TABLE ENABLE RLS; DROP/CREATE POLICY (idempotent); `auth.uid()` vs `current_setting('request.jwt.claim.sub', true)` (EMAIL sütunundaki fallback)
3. **Soft Status Enum'ları:** CHECK constraint ile sıkı tip; DEFAULT ile safe fallback
4. **JSONB Flexibility:** tema, sections, raw data → type-agnostic storage; index gerektirse GIN index ekle
5. **Cascade vs SET NULL:** FK'ler website_id→CASCADE (parent silince children git), project_id→SET NULL (orphan ok)
6. **Ledger Pattern:** atomik mutasyonlar credit_transactions gibi; audit trail otomatik; RPC SECURITY DEFINER
7. **Index Stratejisi:**
   - PK automatic
   - (user_id, created_at DESC) — zaman serisi queries
   - UNIQUE constraint tekrarlama önler (idempotency)
   - (foreign_key) FK lookup
   - (status, timestamp) — cron/polling queries
8. **Migration Zamanı:** iki dosya aynı dakikada yazılırsa isimlendirme çakışır → EN BAŞA +1 saniye ekle veya script önce zaman sync et
9. **IF NOT EXISTS Clause:** idempotent design; rerun halinde aman
10. **NFC/NFD Uyarısı:** Dosya isimleri ASCII-only (Türkçe karakter path NFC/NFD bozulması); DB'ye geri veri yazarken UTF-8 normal

---

### HANGI TABLOLAR ZATEN VAR / GENİŞLETİLEBİLİR

- ✅ **websites** / **website_pages** / **website_versions** — VER 1 mevcut
- ✅ **credit_transactions** — ledger altyapısı hazır; `reason` enum genişletilir (website_codegen, website_publish vb.)
- ✅ **signups** — user foundation hazır (FK referans için yeterli)
- ✅ **social_posts** / **social_post_media** — asset storage pattern hazır; website_assets benzer dizayn
- ✅ **crm_leads** — form submission yapı; website_forms kopyalı (user_id, source, status enums)

---

### DEPLOYMENT VE ENTEGRASYON HIZLARI

**Atomik RPC + Ledger** (credit_transactions, spend_credits gibi) website_credit_events'e kopyalanırsa:
- Batch website codegen → single spend_credits() call → credit_transactions + website_credit_events log
- Deployed site crash → website_error_reports → auto-repair inngest trigger → website_repair_attempts kayıt

**RLS Policy'ler** website_* tabloları için:
- `user_id = auth.uid()::text` doğrudan
- FK+nested SELECT (website_pages_own ← websites.user_id check) — çoklu level guard

**Versioning Akışı:**
- User publish → website_versions.snapshot.create
- website_deployments.scheduled_at future ise pending; cron deploy_scheduler trigger
- Rollback → restore_to_version_id + new version create (revision reason)

---

Tez/şimdi yazılacak Faz 1 'website-codegen' tablolarının mevcut altyapıya sokulması için başlıca pattern'ler ve data type'lar yukarıda haritalanmıştır. Migration file naming, RLS policies, JSONB flexibility, FK cascading, atomik credit tracking — hepsi proof-of-concept olarak başka tablolarda çalışmakta.

### ANALIZ: deploy-domain
Perfect. Now I have enough information to provide a comprehensive analysis. Let me create my report:

---

## DEPLOYMENT + DOMAIN + VERCEL + GITHUB ANALIZ

### MEVCUT ARCHITECTURE (Single-App DB-Serving Model)

**Site Servisi Mimarisi:**
- `/app/(sites)/s/[subdomain]/route.ts` (lines 23-73): Tek YoAi Vercel uygulamasının tüm siteleri servis etmesi
- Dual-format support: `format='html'` (Codegen V2) ve `format='sections'` (eski SiteRenderer)
- Tüm siteler **aynı Next.js instance** üzerinde çalışır → `GET /s/site-slug` veya `/s/site-slug/page-slug`
- Database (`websites` + `website_pages` tabloları): user_id, subdomain, status, publishedVersionId, theme.jsonb
- **Status:** draft/published/unpublished (sitenin yayın durumu)

**Domain Bağlama (Faz 3 — DEFAULT-OFF):**
- `/lib/website/edgeConfig.ts` (lines 1-46): Vercel Edge Config API çağrıları
  - `VERCEL_API_TOKEN` + `VERCEL_TEAM_ID` okuması
  - `setCustomDomainMapping(host, subdomain)`: domain→subdomain eşlemesi Edge Config'e yazıyor
  - `removeCustomDomainMapping(host)`: domain kaldırıyor
- `/lib/website/vercelDomain.ts` (lines 1-80): Vercel Domains API (DNS)
  - `attachDomain(projectId, domain)`: Domaini projeye ekler, DNS kayıtlarını döner
  - Apex (firma.com) → A record (76.76.21.21)
  - Subdomain (www.firma.com) → CNAME (cname.vercel-dns.com)
  - `checkDomainConfig(domain)`: Doğrulama durumunu kontrol ediyor
- `/middleware.ts` (lines 85-105): Custom domain rewrite (flag: `WEBSITE_CUSTOM_DOMAINS='1'`)
  - Host başlığı okunuyor (app host = yoai.yodijital.com hariç tutulur)
  - Edge Config'ten `cd_<host>` anahtarı okunuyor (noktalar → alt çizgi)
  - Custom domain hit → `/s/<subdomain><pathname>` rewrite işlemi
  - Flag kapalıyken bu blok çalışmaz (sıfır risk)

**Preview Domains & Certificate Management:**
- `/app/website-preview/[id]/page.tsx`: Dashboard içi sandbox iframe (srcDoc)
- `/app/website-thumb/[id]/route.ts`: Live thumbnail (yayın gerekmiyor, taslak okur)
- Vercel wildcard DNS: `*.vercel.app` (otomatik, TLS dahil)
- Custom domain wildcard `.preview.yoai-domain.com` **kurulmamış** (dokümantasyon yok)

**Environment Variables (Deployment-Critical):**
```
VERCEL_API_TOKEN       ← Vercel OAuth token (domain binding için)
VERCEL_TEAM_ID         ← Vercel team ID
EDGE_CONFIG            ← Vercel Edge Config connection URL (ecfg_*)
WEBSITE_CUSTOM_DOMAINS ← Flag (default='', açıkken='1')
WEBSITE_ISR            ← ISR cache (default-OFF)
WEBSITE_CODEGEN_V2     ← Yeni motor (default-OFF)
NEXT_PUBLIC_BASE_URL   ← App URL (siteler için form action base)
```

---

### MEVCUT MODEL YAPISI

**Veritabanı Schema (omddq):**
```
websites
├── id (uuid)
├── user_id (FK)
├── subdomain (unique, a-z0-9-) ← ORTAK UYGULAMADA ANAHTAR
├── site_type (landing|multipage)
├── status (draft|published|unpublished)
├── theme (jsonb)
│   ├── customDomain?: string (örn. firma.com)
│   ├── dataSourcePriority? (reference|manual)
│   ├── initialInstructions?
│   ├── mobileMenuAnim?
│   ├── designVars? (Codegen V2 renk/font tokenları)
│   └── compiledCssVersion?
├── publishedVersionId (FK, sadece yayınlı siteler)
└── (pages, versions cascade)

website_pages
├── id (uuid)
├── website_id (FK)
├── locale (tr|en)
├── slug (home|about|contact)
├── format (sections|html)
└── html/sections (içerik)
```

**GitHub Integration:**
- **Mevcut:** YOK. Hiç bir GitHub repo siteler için oluşturulmayan.
- Single monolithic repo (ana YoAi projesi)

**Vercel Deployment:**
- **Mevcut:** 1 Vercel projesi (yoai.yodijital.com)
- Preview deployments: Vercel otomatik (`vercel.app` subdomain)
- Custom domains: Single app instance üzerinden Edge Config rewrite

---

### PROMPT TALEBİ KARŞI KARŞIYLAŞTIRMASI

**Prompt:** "1 site = 1 GitHub repo = 1 Vercel projesi + gerçek deploy"

**Mevcut:** "Tek uygulama + DB-servisi (custom domain rewrite ile)"

| Yön | Prompt (Per-Site) | Mevcut (DB-Service) |
|-----|-------------------|----------------------|
| **GitHub Repo** | Site başına yeni repo | Single shared repo |
| **Vercel Projesi** | Site başına Vercel projesi | 1 Vercel projesi (yoai.yodijital.com) |
| **Deployment** | `git push` → Vercel CI/CD | API → DB → edge rewrite |
| **Domain Binding** | Vercel project settings | Edge Config + middleware rewrite |
| **Build** | Next.js fullstack build | Single build, multi-site router |
| **Cost/Ops** | Repo/deploy/cert per site | Shared infra, DB-driven routing |

---

### PER-SITE VERCEL + GITHUB MODELI: FEASIBILITY ANALIZ

**1. GitHub App / Token Management (BLAST-RADIUS RİSKİ)**
- Per-site repo oluşturma → GitHub App token ihtiyacı
- **Risk:** Single token → 100+ site repo'su üzerinde tam kontrol
  - Token sızdırırsa: tüm siteler fork, delete, force-push zarar
  - Token rotation: Vercel, tüm repo'lar, local dev iş yükü
- **Harita:** Supabase → GitHub repo URL, Vercel project → site record
- **Owner bypass:** Site başına GitHub org ataması → fakat ~10 site/org sınırı var (GitHub)

**2. Vercel Project Limits**
- Vercel account: ~1000 project sınırı (soft)
- Free tier: 5 static site → ücretli (Pro: $20/ay per dev)
- **Per 100 site:** $2000/ay Vercel Pro (tüm siteler)
- Deployment logs, analytics, edge config: project başına ayrı
- **Custom domain:** Vercel domain'de SSL otomatik (per-project) veya manual cert

**3. Preview Domains (Wildcard)**
- **Mevcut:** `/website-preview/<id>?slug=...` (iç iframe, sandbox)
- **Per-site Vercel:** Her Vercel projesi kendi `*.vercel.app` subdomain
  - Wildcard: `*.preview.yoai-domain.com` 
  - DNS setup: `*.preview` → Vercel NS (yok)
  - Middleware rewrite yok (her proje bağımsız)
  - Alternative: `site-{slug}.preview.yoai-domain.com` (wildcard DNS + dnsmasq)

**4. 308 Apex → www Redirect**
- Mevcut: Middleware yok, Edge Config kural yok
- Per-site: Vercel redirects.json / next.config rewrites
- Custom domain: `firma.com` → `www.firma.com` (her site's vercel.json)

**5. Build & Deploy Mechatronics**
- Per-site: GitHub → Vercel CI/CD (Next.js build per project)
  - Build cache miss (Vercel shared) → 2-3 min per deploy
  - 100 site push → 100 parallel build queue
  - Vercel build limit: 6 concurrent (Pro) → 16+ dakika toplam
- Mevcut: Single build → 1 min, multi-site cache hit

**6. Secrets Management**
- Per-site: `.env.vercel` → GitHub secrets + Vercel env vars
  - Duplicate: ANTHROPIC_API_KEY, SUPABASE_* × 100 project
  - Rotation: Script via Vercel API (`VERCEL_TOKEN`)
  - Cost: 0 (ama ops overhead)

**7. Monitoring & Logs**
- Per-site: Vercel Analytics + Logs 100 proje = ~~Vercel UI'da lost~~
- Mevcut: Single dashboard, shared logging

---

### NET TAVSIYE: MVP İÇİN MODEL SEÇİMİ

**1. DB-Service Model (Mevcut) — ÖNERİLEN:**
✅ **MVP için en uygun**
- Operasyon: Tek build, multi-site routing
- Cost: Vercel 1 project ($20/ay Pro)
- GitHub: Single repo (token risk minimal)
- Scalability: 10,000+ site yapabilir (DB I/O, edge rewrite)
- Domain binding: Verified (Edge Config + middleware)
- Custom domain preview: `/website-preview/<id>` sandbox

**Eksikler:**
- Wildcard `.preview.yoai-domain.com` kurulmamış (docs yok)
- Per-site `.vercel.app` hissi yok (tüm siteler `yoai-yodijital.com` gibi)

**2. Hibrit Model (Phase 2+) — Skalama için:**
```
User base < 50 site    → DB-Service (mevcut)
User base 50-200 site  → DB-Service + Vercel Project templatizer
User base 200+ site    → Per-user Vercel account (org sharing)
                         + GitHub org per 10 site + automation
```

**3. Per-Site Model — SADECE EĞERİ:**
- Premium tier müşteri (enterprise)
- Müşteri kendi GitHub org + Vercel account ister
- YoAi role: Generator (code) + Updater (git push, re-build)
- Maliyet: Müşteri öder (Vercel Pro + GitHub commit quota)
- Setup: >1 saat manual per site

---

### İMPLEMENTASYON ROADMAP (DB-Service Model Optimize)

**0. Wildcard Preview Domain (CRITICAL):**
- DNS: `*.preview.yoai-domain.com` → Vercel NS
- Middleware: Custom host check → preview.yoai-domain.com `/s/<site>` rewrite
- Cert: Let's Encrypt wildcard (Vercel free)

**1. Domain Panel (UI):**
- `/app/web-site-yoneticisi/[id]/domain/page.tsx`
- Input: custom domain
- Flow: Check → Attach (Vercel API) → DNS record display → Verify button
- Status: Verified / Pending / Failed

**2. 308 Apex Redirect:**
- Per-site vercel.json: `redirects: [{ source: '/(.*)' if apex, destination: 'www...' }]`
- Mevcut middleware → per-site config (Codegen'de)

**3. ISR Cache (Yayınlı siteler):**
- `WEBSITE_ISR='1'` → `Cache-Control: public, s-maxage=300`
- CDN: Vercel Edge (included)

**4. Monitor & Observability:**
- Per-site status: DNS verified, deployment health, error rate
- Supabase: `website_deployments` table (optional, for logging)

---

### ÖZETLEŞTİRME (Teknik Tabı)

| Boyut | Değerlendirme | Açıklama |
|-------|---------------|----------|
| **Feasibility** | ✅ DB-Service HIGH | Single app, proven architecture |
| **Cost** | ✅ Per-site LOWEST | ~$20/mo Vercel + DB |
| **GitHub Risk** | ✅ Per-site MINIMAL | 1 token, 1 repo, 1 account |
| **Deployment Speed** | ✅ Per-site FAST | 1-2 min (vs 15+ min per-project) |
| **Scalability** | ✅ Per-site 10K+ | DB I/O only bottleneck |
| **Domain Binding** | ⚠️ Per-site READY | Edge Config implemented, preview missing |
| **Wildcard Preview** | ❌ Per-site MISSING | `.preview.yoai-domain.com` not set up |
| **Per-site feeling** | ⚠️ Per-site MIDDLING | Servis `/s/slug`, subdomain brand-aware |

---

**SONUÇ: MVP için mevcut DB-Service model ile devam, Wildcard preview domain kurulumunu öncelik ver (1-2 saat). Per-site Vercel modeline geçiş yalnız **100+ site user base** ve **enterprise talebi** olunca.**

**Dosya referansları:**
- /Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/.claude/worktrees/web-site-yoneticisi-codegen/middleware.ts (lines 85-105)
- /Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/.claude/worktrees/web-site-yoneticisi-codegen/lib/website/edgeConfig.ts (lines 1-46)
- /Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/.claude/worktrees/web-site-yoneticisi-codegen/lib/website/vercelDomain.ts (lines 1-80)
- /Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/.claude/worktrees/web-site-yoneticisi-codegen/lib/website/types.ts (customDomain, designVars)
- /Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/.claude/worktrees/web-site-yoneticisi-codegen/app/(sites)/s/[subdomain]/route.ts (lines 23-73)
- /Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/.claude/worktrees/web-site-yoneticisi-codegen/.env.example (deployment vars)

### ANALIZ: email-crm-ecosystem
Perfect! Now I have a comprehensive understanding. Let me compile the final report:

## ANALYSIS RAPORU: Email/Bildirim + CRM + Ekosistem Moduller (YoAi Project)

### (A) E-POSTA GÖNDERİM AKIŞI: Form → Sahip E-postası + Gözetim Merkezi

#### **1. İletişim Formu Girişi (Site Ziyaretçisi)**

**Dosya:** `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/.claude/worktrees/web-site-yoneticisi-codegen/app/(sites)/s/[subdomain]/lead/route.ts:72-160`
- **POST /s/<subdomain>/lead** — Public iletişim formu (authenticated DEĞİL)
- Giriş: `{name, email, phone, message, company(honeypot)}`
- Doğrulama: Honeypot (bot protection), regex email, uzunluk sınırları, IP rate-limit (5 istek/60sn)
- **Çıkış:** owner e-postası çekilir → `notifySiteOwnerOfContact()` çağrılır

**İlişkili:** `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/.claude/worktrees/web-site-yoneticisi-codegen/app/api/website/[id]/contact/route.ts:43-91`
- **POST /api/website/[id]/contact** — Alternatif: dashboard'dan site editörü tarafından gönderilen form
- Aynı `notifySiteOwnerOfContact()` çağrılır

---

#### **2. Sahip E-postası Kaynağı (signups.email by user_id)**

**Dosya:** `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/.claude/worktrees/web-site-yoneticisi-codegen/app/(sites)/s/[subdomain]/lead/route.ts:124-136`
```typescript
const site = await getPublishedSiteBySubdomain(params.subdomain)
// site.website.userId → 
const ownerEmail = await getOwnerEmailByUserId(site.website.userId)
// SELECT email FROM signups WHERE id = user_id
```

---

#### **3. E-Posta Gönderimi: Resend API (SMTP Değil)**

**Dosya:** `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/.claude/worktrees/web-site-yoneticisi-codegen/lib/website/contactNotify.ts`
- **Provider:** Resend (Vercel SMTP port bloğu nedeniyle)
- **FROM_EMAIL:** `process.env.FROM_EMAIL` (default: `'YO Dijital Medya Anonim Şirketi <info@yodijital.com>'`)
- **API_KEY:** `process.env.RESEND_API_KEY`
- **Fonksiyon:** `notifySiteOwnerOfContact(ownerEmail, siteName, {name, email, phone, message})`
  - replyTo = ziyaretçi e-postası (sahip doğrudan yanıtlayabilir)
  - CRLF/HTML injection koruması var
  - Başarısız gönderim false döner (hata sızdırılmaz)

---

#### **4. Gözetim Merkezi Hata Raporlaması + Bildirim**

**Dosya:** `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/.claude/worktrees/web-site-yoneticisi-codegen/lib/yoai/watchdog/notify.ts:72-91`
- **Fonksiyon:** `sendWatchdogDigest(userId, findings)`
- **Tetikleyici:** Günlük reklam erken uyarı (watchdog scanning)
- **Alıcı:** Kullanıcının kendi e-postası (`signups.email`) veya fallback sahibi (`OWNER_NOTIFICATION_RECIPIENTS`)
- **Akış:**
  1. Bulgular varsa (findings.length > 0) → HTML özeti oluştur
  2. `resolveRecipients(userId)` → user's email veya OWNER addrs
  3. Resend ile gönder
  4. Her sonuç `notification_log` tablosuna loglanır (sent/failed)

**Tablo:** `notification_log`
- Sütunlar: `recipient, subject, notification_type('watchdog_alert'), related_user_id, status('sent'|'failed'), error_message`

---

#### **5. Admin Bildirimler (İşletme Events)**

**Dosya:** `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/.claude/worktrees/web-site-yoneticisi-codegen/lib/notifications/ownerNotifier.ts`
- **Alıcılar (FIXED):**
  - `onursuay@hotmail.com`
  - `cnursuay@gmail.com`
- **Eventler:** `new_signup`, `premeeting_scheduled`, `premeeting_declined`, `booking_requested`
- **Akış:**
  1. Event type + signup/booking summary
  2. Iki adrese de gönder (bir başarısız olsa diğeri dene)
  3. Her sonuç `notification_log` loglanır

---

### (B) CRM ENTEGRASYON: Meta Lead Ads → CRM Leads → Email Contacts

#### **1. Meta Webhook Ingestion**

**Dosya:** `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/.claude/worktrees/web-site-yoneticisi-codegen/app/api/meta/webhook/route.ts`
- **POST /api/meta/webhook** — Meta leadgen webhook
- Doğrulama: GET hub.challenge, POST leadgen change events
- **Fire-and-forget:** `ingestLeadgen(pageId, leadgenId, formId)` async çağrılır (Meta 20sn içinde 200 bekler)

**Tablo:** Lead gelmeden önce: `page_subscriptions` → page_id → user_id bulunur

---

#### **2. Lead Çekme + CRM Kayıt**

**Dosya:** `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/.claude/worktrees/web-site-yoneticisi-codegen/lib/crm/metaLeadIngest.ts:37-118`
- **Fonksiyon:** `ingestLeadgen(pageId, leadgenId, formId)`
- **Adımlar:**
  1. pageId → page_subscription → userId
  2. userId → Meta user token + page access token
  3. GET /{leadgenId} (Meta Graph API) → lead detayları
  4. Field data ayrıştır (name, email, phone, custom fields)
  5. `upsertLead()` → `crm_leads` (idempotent: UNIQUE user_id,meta_leadgen_id)
  6. **Auto:** e-posta varsa `syncLeadToContact()` → email_contacts'e ekle (CRM↔Email bridge)

**Tablo:** `crm_leads`
- Sütunlar: `user_id, source('meta'), meta_leadgen_id, meta_form_id, meta_page_id, form_name, ad_id, campaign_name, full_name, email, phone, raw_field_data(JSON), status('giris'|'uygun'|'donusum'|'kayip'|'uygun_degil'), note, meta_synced_at, meta_capi_sent, meta_sync_error, created_at, updated_at`

---

#### **3. Email Kişi Havuzuna Otomatik Senkron**

**Dosya:** `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/.claude/worktrees/web-site-yoneticisi-codegen/lib/email/contactStore.ts:207-225`
- **Fonksiyon:** `syncLeadToContact(userId, lead)`
  - CRM lead'in e-postası varsa email_contacts'e ekle
  - Idempotent (UNIQUE user_id,email)
  - source: 'crm', crmLeadId, pageId, submittedAt taşınır

**Tablo:** `email_contacts`
- Sütunlar: `user_id, email, full_name, phone, source('crm'|'csv'|'sheets'|'manual'), crm_lead_id, page_id, submitted_at, opt_out, created_at`

**Benzer işlevler:**
- `importFromCrm(userId)` — toplu export: tüm CRM lead'leri (e-postası olan, opt-out olmayan) email_contacts'e aktarır
- `listContactPageIds(userId)` — kişilerin Meta sayfa hesaplarına göre filtrelemesi (account-based segmentation)

---

### (C) EMAIL MARKETİNG MODÜLÜ: Gönderim Akışı

#### **1. Gönderim Hesapları (SMTP/Gmail/Domain/Platform)**

**Dosya:** `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/.claude/worktrees/web-site-yoneticisi-codegen/lib/email/sendingAccountStore.ts`

**Tablo:** `email_sending_accounts`
- type: `'smtp'` | `'gmail'` | `'domain'` | `'outlook'` | `'platform'`
- SMTP: host, port, user, passEnc (AES-256-GCM şifreli)
- Gmail/Outlook: refreshTokenEnc (OAuth)
- Domain: Resend (kullanıcı custom domain)
- Platform: Resend (shared FROM_EMAIL, reply_to = user email)
- Status: `'pending' | 'active' | 'failed'`

**API Fonksiyonları:**
- `getDefaultAccount(userId)` → varsayılan/ilk active hesap
- `createSmtpAccount()`, `createOAuthAccount()`, `createPlatformAccount()`
- `decryptSmtpPass()`, `decryptRefreshToken()` (server-side only)

---

#### **2. Kampanya Gönderimi**

**Dosya:** `/Users/onursuay/Desktop/Onur Suay/Web Siteleri/YoAi_Project/.claude/worktrees/web-site-yoneticisi-codegen/lib/email/sender.ts:154-234`
- **Fonksiyon:** `sendCampaign(userId, campaignId)`
- **Adımlar:**
  1. Kampanya getir, status kontrol (duplicate/stuck gönderim recovery)
  2. `buildDispatch(userId)` → gönderim hesabı seç (SMTP/Gmail/Domain/Platform)
  3. Segmente göre alıcılar çöz (`resolveRecipients()`)
  4. Her alıcıya:
     - HTML oluştur (body + unsubscribe footer + tracking pixel/click wrapping)
     - Dispatch çağrı (resumable: zaten gönderilenleri atla)
     - `email_sends` tablosuna kayıt (campaign_id, email, status, resend_id)
  5. Campaign → 'sent' / 'failed' işaretle

**Tablo:** `email_sends`
- campaign_id, user_id, contact_id, email, resend_id, status('sent'|'failed'), sent_at

---

### (D) EKOSISTEM MODULLER: WEB BUILDER SONRASI UPSELL ROUTE'LARI

#### **Ana Modul Giriş Noktaları (lib/routes.ts + lib/tabRoutes.ts)**

| Modul | TR Route | EN Route | Amaç |
|-------|----------|----------|------|
| **Google Ads** | `/google-ads` | `/google-ads` | Kampanya/ad set/reklam yönetimi |
| **Meta Ads** | `/meta-ads` | `/meta-ads` | Kampanya/ad set/reklam yönetimi |
| **TikTok Ads** | `/tiktok-ads` | `/tiktok-ads` | TikTok reklam yönetimi (Yakında) |
| **Email Marketing** | `/email-marketing` | `/email-marketing` | Kişiler, kampanyalar, otomasyonlar |
| **CRM Sistemi** | `/crm-sistemi` | `/crm-system` | Meta Lead Ads CRM |
| **Optimizasyon** | `/optimizasyon` | `/optimization` | AI reklam taraması (Meta/Google) |
| **Strateji** | `/strateji` | `/strategy` | Marketing stratejisi discovery + planlama |
| **Hedef Kitle** | `/hedef-kitle` | `/target-audience` | Platform bazlı kitle segmentasyonu |
| **Tasarım** | `/tasarim` | `/design` | AI tasarım tools + kütüphane |
| **Raporlar** | `/raporlar` | `/reports` | Meta/Google/Analytics/GSC dashboard |
| **SEO Plus** | `/seo-plus` | (seo-plus) | SEO analiz + otomatik makale |

---

#### **Entegrasyon Merkezi (Ekosistem Seçme)**

**Route:** `/entegrasyon` (app/entegrasyon/page.tsx)
- **Meta Ads:** OAuth + hesap seçim modal
- **Google Ads:** OAuth + manager/customer hesap seçim modal
- **Google Analytics:** Property seçim modal
- **Google Search Console:** Site seçim modal
- **TikTok Ads:** OAuth (yapı hazır)
- Her platform başarısız/success URL parametreleri: `?meta=connected` → `?ga=error&reason=...`

---

#### **CRM Sistemi (Lead Management)**

**Route:** `/crm-sistemi` (app/crm-sistemi/page.tsx)
- CRM lead listesi (status filtresi: giris/uygun/donusum/kayip/uygun_degil)
- Lead detayı + durum güncelleme + not ekle
- **Bridge:** Email marketing'e kişi aktarma (`importFromCrm()`)

---

#### **Email Marketing**

**Route:** `/email-marketing`
- **Sekmeler:** Kişiler (`contacts`), Kampanyalar (`campaigns`), Otomasyonlar (`automation`)
- **Kişiler:** CRM/CSV/Sheets/manual importu, sayfa bazlı filtreleme (Meta ads account)
- **Kampanyalar:** HTML editor + segment seçim + gönderim hesabı seçim
- **Otomasyonlar:** Drip queue + trigger-based akışlar

---

#### **API Endpoints (Backend Integration)**

**Meta Leads:**
- `GET/POST /api/meta/leads` — lead listesi/aktarma
- `GET /api/meta/lead-forms` — form listesi

**CRM:**
- `GET/POST /api/crm/leads` — lead CRUD
- `POST /api/crm/sync` — manual senkron
- `POST /api/crm/connect` — page subscription bağlantısı
- `GET /api/crm/pages` — subscribed sayfalar

**Email:**
- `GET/POST /api/email/contacts` — kişi CRUD
- `GET /api/email/campaigns` — kampanya yönetimi
- `POST /api/email/campaigns/:id/send` — gönderim tetikleme
- `GET /api/email/sending-accounts` — SMTP/Gmail/Domain hesapları

**Website Contact (Lead Form):**
- `POST /api/website/[id]/contact` — form submission
- `POST /s/<subdomain>/lead` — public form (rate-limited, honeypot)

---

### (E) ENTEGRASYON AKIŞI (FORM → OWNER EMAIL + WATCHDOG → UPSELL KARTLARI)

```
1. ZİYARETÇİ İLETİŞİM FORMU
   ├─ POST /s/<subdomain>/lead
   ├─ (honeypot + rate-limit + doğrulama)
   ├─ ownerEmail = signups.email (by user_id)
   └─ notifySiteOwnerOfContact(ownerEmail, siteName, form)
      └─ Resend: FROM_EMAIL → ownerEmail
         ├─ HTML: form summary (name, email, phone, message)
         ├─ replyTo: ziyaretçi e-postası
         └─ Gönderim başarısız bile graceful (e-posta sızdırılmaz)

2. GÖZETIM MERKEZI (İŞİN ELİ)
   ├─ Günlük reklam taraması (watchdog scanning — Inngest)
   ├─ Bulgular varsa: sendWatchdogDigest(userId, findings)
   └─ notification_log: {recipient, subject, status, error}
      ├─ Gönderildi: user's email | fallback: onursuay@hotmail.com
      └─ E-posta: "Günlük Reklam Erken Uyarı" + kart listesi + "YoAi'de İncele" link

3. META LEAD ADS WEBHOOK (REKLAM FORMUNDAN LEAD)
   ├─ POST /api/meta/webhook (leadgen change event)
   ├─ ingestLeadgen(pageId, leadgenId, formId)
   │  ├─ Lead detayını Meta Graph API'den çek
   │  ├─ upsertLead() → crm_leads (idempotent)
   │  └─ syncLeadToContact() → email_contacts (auto, e-posta varsa)
   └─ CRM + Email Marketing'de görünür

4. UPSELL: EKOSISTEM MODÜLLERİ (WEB BUILDER SONRASI)
   ├─ /dashboard → sidebar navigasyon
   │  ├─ Email Marketing (/email-marketing) — CRM leads → campaigns
   │  ├─ CRM Sistemi (/crm-sistemi) — lead management
   │  ├─ Meta/Google Ads — OAuth connect → yönetim
   │  ├─ Optimizasyon (/optimizasyon) — AI scan (AI credit/subscription)
   │  ├─ Strateji (/strateji) — planning (subscription)
   │  ├─ Hedef Kitle (/hedef-kitle) — segmentation
   │  ├─ Tasarım (/tasarim) — AI design (credit-based)
   │  ├─ Raporlar (/raporlar) — analytics dashboard
   │  └─ SEO Plus (/seo-plus) — article generation
   └─ /entegrasyon — OAuth setup hub (Meta, Google, GA, GSC, TikTok)
```

---

### (F) SONUÇ: Dosya → Satır Matrisi (Load-Bearing Points)

| **Akış Aşaması** | **Dosya** | **Satır Aralığı** | **Kritik Fonksiyon** |
|-----------------|-----------|------------------|---------------------|
| Form → Owner Email | `/lib/website/contactNotify.ts` | 8-60 | `notifySiteOwnerOfContact(ownerEmail, ...)` |
| Owner Email Kaynağı | `/app/(sites)/s/.../lead/route.ts` | 124-136 | `getOwnerEmailByUserId()` |
| Resend Config | `/lib/website/contactNotify.ts` | 8-9 | FROM_EMAIL, RESEND_API_KEY |
| Watchdog Bildirim | `/lib/yoai/watchdog/notify.ts` | 73-91 | `sendWatchdogDigest(userId, findings)` |
| Admin Bildir (Owner) | `/lib/notifications/ownerNotifier.ts` | 19-22 | OWNER_NOTIFICATION_RECIPIENTS (fixed) |
| Notification Log | `/lib/yoai/watchdog/notify.ts` | 63-70 | `logNotification()` → `notification_log` table |
| CRM Ingestion | `/lib/crm/metaLeadIngest.ts` | 37-118 | `ingestLeadgen()` → `upsertLead()` + `syncLeadToContact()` |
| CRM Leads Table | `/lib/crm/leadStore.ts` | 1-100 | `upsertLead()`, status enums, UNIQUE constraint |
| Email Contacts Bridge | `/lib/email/contactStore.ts` | 207-225 | `syncLeadToContact()` → idempotent upsert |
| Email Sending | `/lib/email/sender.ts` | 154-234 | `sendCampaign()` + `buildDispatch()` |
| Sending Accounts | `/lib/email/sendingAccountStore.ts` | 10-100 | account types (SMTP/Gmail/Domain/Platform) |
| Meta Webhook | `/app/api/meta/webhook/route.ts` | 35-77 | leadgen → `ingestLeadgen()` fire-and-forget |
| Web Contact Form | `/app/api/website/[id]/contact/route.ts` | 43-91 | alt form submission path |
| Ecosystem Routes | `/lib/routes.ts` | 1-101 | ROUTES object + locale mapping |
| Tab Routes | `/lib/tabRoutes.ts` | 48-162 | TAB_ROUTES (module entry points) |
| Entegrasyon Hub | `/app/entegrasyon/page.tsx` | 1-150+ | OAuth setup + platform status |

---

**ÖZET:**

1. **Form → Owner Email:** Ziyaretçi formu (honeypot + rate-limit) → `getOwnerEmailByUserId()` via `signups.email` → Resend `FROM_EMAIL` + `RESEND_API_KEY`
2. **Gözetim Merkezi:** Watchdog findings → `sendWatchdogDigest()` → user email | fallback: fixed admin addrs → `notification_log`
3. **CRM:** Meta webhook → `ingestLeadgen()` → `crm_leads` (idempotent) → **auto bridge** → `email_contacts`
4. **Ekosistem Upsell:** `/dashboard` sidebar (Email Marketing, CRM, Meta/Google Ads, Optimizasyon, Strateji, …) → `/entegrasyon` OAuth hub → `/lib/tabRoutes.ts` modul entry points
