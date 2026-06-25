# DijiMagic Rebrand — TEK OTORİTER REPLACEMENT SPEC (çalıştırılabilir)

> Kaynak otorite: `docs/superpowers/specs/2026-06-25-dijimagic-rebrand-domain-migration-design.md` (sahip onaylı tasarım). 6 keşif modalitesi bununla harmanlandı; çelişkiler tasarım dökümanı lehine çözüldü.
> Pre-launch (canlı kullanıcı yok) → DB RENAME ve env değişimi güvenli. Branch: `rebrand/dijimagic`. Her faz `npm run build` + `tsc --noEmit` + testler yeşil olmadan sonrakine geçilmez.
>
> **ÇÖZÜLEN ÇELİŞKİLER (modaliteler vs otorite):**
> 1. **Domain = `dijimagic.com`** (spec §2/§7.1). `app.dijimagic.com` (config-meta modalitesi, `.env.local`'den) REDDEDİLDİ — spec callback'leri `https://dijimagic.com/api/...` diyor. `.env.local`'deki `app.` prefix'i `dijimagic.com`'a normalize edilir.
> 2. **Inngest prefix = `dijialgoritma/*`** (spec §3.1/§5). 3 modalitenin önerdiği `dijimagic/*` YANLIŞ — REDDEDİLDİ.
> 3. **`yoai_business_scope` DB tablosu/kolonu DEĞİL** (spec envanteri yanlış). Gerçekte: cookie adı string'i + regex + migration yorumu. ALTER YOK → §1'de string replace.
> 4. **Gerçek DB tablo sayısı = 11** (spec "12" der; 12.si business_scope hayalet). Migration dosya sayısı = **14**.
> 5. **`yoai_business_context_prompt` DB kolonu DEĞİL** — `_yoai_business_context_prompt` transient JSON payload anahtarı (strategy job-runner). String replace.
> 6. **Rename modalitesindeki typo'lar düzeltildi:** `dijialgoritmaScam.ts`→`dijialgoritmaScan.ts`, `dijialgoritmaPlattformRules`→`dijialgoritmaPlatformRules`, `dijialgoritmaScamBusinessBrief`→`dijialgoritmaScanBusinessBrief`.

---

## 1) String / Identifier Replace Kuralları (case-aware)

Uygulama: case-aware + **kelime-sınırı duyarlı** (`\b`), substring bozma yok. Sıra ÖNEMLİ — uzun/özel token'lar önce, jenerik token'lar sonra (yoksa `yoalgoritma` → `dijialgoritma` adımı `yoai`'yi ezer).

### 1.A — Önce bileşik/özel token'lar (uzundan kısaya)

| # | Eski (regex/literal) | Yeni | Not |
|---|---|---|---|
| 1 | `info@yodijital.com` | `info@dijimagic.com` | e-posta |
| 2 | `yoai.yodijital.com` | `dijimagic.com` | domain (host kısmı) |
| 3 | `voiceagent.yodijital.com` | **kaldır** (yorum cümlesini yeniden yaz) | `app/page.tsx:170` yorum, `docs/CHANGELOG.md:60` — cümleden çıkar |
| 4 | `YO Dijital Medya Anonim Şirketi` | `DijiMagic` (marka) | yasal sayfalar HARİÇ (§6) |
| 5 | `YO Dijital Medya A.Ş.` | `DijiMagic` | aynı |
| 6 | `YO Dijital` | `DijiMagic` | aynı; yasal sayfalar HARİÇ |
| 7 | `YoAlgoritma` | `DijiAlgoritma` | PascalCase modül + bileşen/fonksiyon (`YoAlgoritmaHeader`→`DijiAlgoritmaHeader`) |
| 8 | `YOALGORITMA` | `DIJIALGORITMA` | env/sabit |
| 9 | `yoalgoritma` | `dijialgoritma` | route, dosya, inngest, db-dışı |
| 10 | `yoalgorithm` (EN slug) | `dijialgorithm` | **yalnız** `middleware.ts:19,39` + `lib/routes.ts:28,52` EN↔TR map |
| 11 | `YoAiBot` | `DijiMagicBot` | User-Agent (`app/api/seo/analyze-geo/route.ts:23`, `lib/website/referenceScanner.ts:90`) |
| 12 | `yodijital` | `dijimagic` | kalan tüm string/yorum |

### 1.B — Sonra çekirdek marka token'ları

| # | Eski | Yeni | Kapsam |
|---|---|---|---|
| 13 | `YoAi` | `DijiMagic` | string-literal, UI etiket, PascalCase export (`YoAiPage`→`DijiMagicPage`, `YoAiLayout`→`DijiMagicLayout`), `alt="YoAi"`/`alt="YoAI"` |
| 14 | `Yoai` | `DijiMagic` | PascalCase export varyantı |
| 15 | `YOAI` | `DIJIMAGIC` | env prefix, sabit, HMAC ad (`YOAI_SECRET`→`DIJIMAGIC_SECRET`, `YOAI_SIGNATURE`→`DIJIMAGIC_SIGNATURE`, `X_YOAI_SIGNATURE`→`X_DIJIMAGIC_SIGNATURE`) — **yalnız ad, değer aynı** |
| 16 | `yoai` | `dijimagic` | identifier, path, comment, db `.from()` string'leri, localStorage |

### 1.C — Bileşik identifier'lar (tutarlılık zinciri — 1.B sonrası kalanlar otomatik kapanır, ama doğrula)

| Eski | Yeni | Yer |
|---|---|---|
| `yoaiSpecJson` | `dijimagicSpecJson` | `app/hedef-kitle/[[...segments]]/page.tsx`, `components/hedef-kitle/wizard/types.ts:237` |
| `yoaiPrivacyPolicyUrl` | `dijimagicPrivacyPolicyUrl` | `app/api/meta/ads/create/route.ts:290`, `lib/meta/resolveLeadCreativeLink.ts:15,24,60` |
| `clearYoAlgoritmaClientCache` | `clearDijiAlgoritmaClientCache` | `lib/yoai/clientCache.ts:35` + 13 çağrı (Topbar, GoogleAccountDropdown, MultiAccountDropdown, UnifiedAccountSwitcher) |
| `YOAI_CC_CACHE_KEY` | `DIJIMAGIC_CC_CACHE_KEY` | `lib/yoai/clientCache.ts:14`, `app/yoalgoritma/page.tsx` |
| `YOAI_CC_CACHE_KEY_LEGACY` | `DIJIMAGIC_CC_CACHE_KEY_LEGACY` | `lib/yoai/clientCache.ts:16` |
| `YOAI_CC_DEEP_CACHE_KEY` | `DIJIMAGIC_CC_DEEP_CACHE_KEY` | `lib/yoai/clientCache.ts:18`, `app/yoalgoritma/page.tsx` |
| `BUSINESS_SCOPE_COOKIE = 'yoai_business_scope'` | `'dijimagic_business_scope'` | `lib/account/businessGroups.ts:15` |
| regex `/yoai_business_scope=/` | `/dijimagic_business_scope=/` | `lib/yoai/clientCache.ts:27` (cookie eşleştirme) |
| `_yoai_business_context_prompt` | `_dijimagic_business_context_prompt` | `lib/strategy/job-runner.ts:209-215`, `app/api/strategy/instances/[id]/generate-plan/route.ts:56` (JSON payload key, DB DEĞİL) |
| `yoaiTubeDrift1..7` | `dijimagicTubeDrift1..7` | CSS @keyframes `app/yoalgoritma/page.tsx:368-392` — **tanım + `animation:` referansları birlikte** |
| `yoaiTap`, `yoaiShimmerSpin`, `yoai-flip/face/back/flip-inner/shimmer/icon-glow` | `dijimagic*` / `dijimagic-*` | `components/yoai/*.tsx`, `globals.css` — keyframe adı + class adı + kullanım birlikte |
| `data-yoai-reveal`, `data-yoai-tube`, `data-yoaiId`, `data-yoaiBlock` | `data-dijimagic-*` | `app/website-preview/[id]/page.tsx`, `public/yoai-select.js` — **attribute + JS selector birlikte** |
| `yoai:select` | `dijimagic:select` | iframe mesaj protokolü: `app/website-preview/[id]/page.tsx:89,98`, `app/web-site-yoneticisi/[id]/onizleme/page.tsx:105-115`, `public/yoai-select.js:15,175` |

### 1.D — localStorage / cookie değer string'leri (pre-launch: cache reset kabul)

`yoai_cc_cache_v2`→`dijimagic_cc_cache_v2`, `yoai_cc_cache_v1`→`dijimagic_cc_cache_v1`, `yoai_cc_deep_cache`→`dijimagic_cc_deep_cache`, `yoai_proposals_cache_v1..v4`→`dijimagic_proposals_cache_v*`, `yoai_gate_`→`dijimagic_gate_`, `yoai_adimg_`→`dijimagic_adimg_`, `yoai_competitor_v2`→`dijimagic_competitor_v2`, `yoai-tasarim-library`→`dijimagic-tasarim-library`, `yoai-help-access`→`dijimagic-help-access`, `yoai_scope_autoinit`→`dijimagic_scope_autoinit`, `yoai_kart_bootstrap_at`→`dijimagic_kart_bootstrap_at`, `yoai_seo_wp_incompatible`→`dijimagic_seo_wp_incompatible`. Yerler: `lib/yoai/clientCache.ts`, `app/yoalgoritma/page.tsx`, `components/yoai/{AiAdSuggestions,AdImageGenerator,CompetitorDashboard}.tsx`, `app/tasarim/[[...segments]]/page.tsx:15`, `components/social/PostComposerModal.tsx:92`, `app/hesabim/page.tsx:15`, `components/account/UnifiedAccountSwitcher.tsx:116-117`.

### 1.E — DB tablo adlarının kod-içi string'leri (faz 3 ile lockstep)

`.from('yoai_*')` ve sabit string'ler 11 tablo için güncellenir (§3 tablosuyla aynı): `lib/yoai/{resultTrackingStore('yoai_recommendation_results'),approvalStore('yoai_approval_versions'),modelDecisionStore('yoai_model_decisions'),actionOutcomeStore,learningStore}.ts`, `app/api/yoai/articles/route.ts` (`yoai_articles`), `app/api/audiences/route.ts:52,57,75` + `app/api/audiences/[id]/route.ts:75` + `app/api/audiences/[id]/create/route.ts:58` + `app/hedef-kitle/[[...segments]]/page.tsx:49,125,221` (`yoai_spec_json`→`dijimagic_spec_json`).

### Uygulanacak dosya türleri
`*.ts, *.tsx, *.js, *.mjs, *.json, *.md, *.sql, *.html, *.css, *.plist` (working tree).

### Exclude glob'ları (replace ÇALIŞTIRMA)
```
node_modules/**, .next/**, .git/**, .vercel/**(salt project.json hariç — §4),
**/*.png, **/*.jpg, **/*.jpeg, **/*.webp, **/*.ico, **/*.woff*, **/*.mp4, **/*.pdf,
package-lock.json (name alanı hariç — elle),
app/mesafeli-satis-sozlesmesi/page.tsx (§6 elle),
app/on-bilgilendirme-formu/page.tsx (§6 elle),
+ bunların TR/EN karşılıkları (kullanim-kosullari, terms vb. yasal satıcı blokları)
```

---

## 2) Dosya / Klasör / Route `git mv` (sıralı)

> Her `git mv` sonrası: import yolları (`@/components/yoai/*`→`@/components/dijimagic/*`, `@/lib/yoai/*`→`@/lib/dijimagic/*`), `fetch('/api/yoai/...')`→`fetch('/api/dijimagic/...')`, `<Link href="/yoalgoritma">`→`/dijialgoritma`, `vercel.json` cron path'leri (§4), `public` script `<script src>` referansları güncellenir. Klasör mv'leri içerikteki §1 replace'lerinden ÖNCE veya hemen sonra yapılabilir; tercihen önce mv sonra string replace (tek geçiş).

### 2.A — Klasörler
```
git mv app/yoalgoritma                         app/dijialgoritma
git mv app/api/yoai                            app/api/dijimagic
git mv app/api/cron/yoai-outcome-snapshots     app/api/cron/dijimagic-outcome-snapshots
git mv app/api/cron/yoalgoritma-scan           app/api/cron/dijialgoritma-scan
git mv components/yoai                          components/dijimagic
git mv lib/yoai                                 lib/dijimagic
```

### 2.B — Dosyalar (klasör mv'lerinden SONRA — yol artık dijimagic/dijialgoritma)
```
git mv components/dijimagic/YoAlgoritmaHeader.tsx   components/dijimagic/DijiAlgoritmaHeader.tsx
git mv public/logos/yoai-logo.png                   public/logos/dijimagic-logo.png   # §6: görsel de yeniden tasarlanacak
git mv public/yoai-select.js                        public/dijimagic-select.js
git mv public/yoai-site-runtime.js                  public/dijimagic-site-runtime.js
git mv inngest/functions/yoalgoritmaScan.ts         inngest/functions/dijialgoritmaScan.ts
git mv _automation/com.yoai.saglik.plist            _automation/com.dijimagic.saglik.plist
git mv src/tests/yoalgoritmaAdSpecPayload.test.ts       src/tests/dijialgoritmaAdSpecPayload.test.ts
git mv src/tests/yoalgoritmaCompetitorBrief.test.ts     src/tests/dijialgoritmaCompetitorBrief.test.ts
git mv src/tests/yoalgoritmaPlatformRules.test.ts       src/tests/dijialgoritmaPlatformRules.test.ts
git mv src/tests/yoalgoritmaProposalCardLayout.test.ts  src/tests/dijialgoritmaProposalCardLayout.test.ts
git mv src/tests/yoalgoritmaScanBusinessBrief.test.ts   src/tests/dijialgoritmaScanBusinessBrief.test.ts
```

### 2.C — docs
```
git mv docs/YOALGORITMA_MERKEZI_ARCHITECTURE.md     docs/DIJIALGORITMA_MERKEZI_ARCHITECTURE.md
git mv docs/YoAi_Sunum.html                          docs/DijiMagic_Sunum.html
git mv docs/YoAi_Sunum.md                            docs/DijiMagic_Sunum.md
git mv docs/sql/yoai_action_outcomes.sql             docs/sql/dijimagic_action_outcomes.sql
git mv docs/yoalgoritma_audit.md                     docs/dijialgoritma_audit.md
git mv docs/yoalgoritma_context_audit.md             docs/dijialgoritma_context_audit.md
git mv docs/yoalgoritma_per_ad_refactor_plan.md      docs/dijialgoritma_per_ad_refactor_plan.md
git mv docs/yoalgoritma_proje_amaci.md               docs/dijialgoritma_proje_amaci.md
git mv docs/yoalgoritma_test_plan.md                 docs/dijialgoritma_test_plan.md
git mv docs/superpowers/specs/2026-06-02-yoalgoritma-iyilestirmeleri-design.md \
       docs/superpowers/specs/2026-06-02-dijialgoritma-iyilestirmeleri-design.md
git mv sunum/YoAi_Sunum.html                          sunum/DijiMagic_Sunum.html
```

### 2.D — `inngest/functions/index.ts` (veya client registry) içindeki `yoalgoritmaScan` import + fonksiyon kaydı güncellenir; `perAdImprovements.ts` / `perCampaignImprovements.ts` içeriği (§1/§5) güncellenir (dosya adları değişmez — yoai içermiyor).

### 2.E — Logo `<Image src="/logos/yoai-logo.png">` referansları (12 dosya) `/logos/dijimagic-logo.png` olur: `app/page.tsx`, `app/signup/page.tsx`, `app/signup/verify/page.tsx`, `app/login/page.tsx`, `app/fiyatlandirma/page.tsx`, `app/basvuru-durumu/page.tsx`, `components/SidebarNav.tsx`, `components/landing/LandingHeader.tsx`, `components/legal/{PrivacyPolicyContent,TermsContent,DataDeletionContent,CookiePolicyContent}.tsx`. `alt="YoAi"/"YoAI"`→`alt="DijiMagic"` (§1.B).

### 2.F — `public/dijimagic-site-runtime.js` referansı: `app/website-thumb/[id]/route.ts:31,47,48` (regex replace + yorum).

---

## 3) DB RENAME (canlı Supabase `omddqhcvhxvzrizehnzw`) — `scripts/rebrand/rename-db.sql`

> RENAME = metadata-only (veri kopyalanmaz). Postgres FK'leri OID bağlı → RENAME FK bütünlüğünü bozmaz. Yine de cross-FK güvenliği için tablo sırası korunur. **11 tablo + 2 kolon** (NOT: `yoai_business_scope` tablo DEĞİL → §1.C cookie string). `\dt` ve `rg yoai supabase/ scripts/` ile 0-iz doğrulanır.

### 3.A — Tablolar (cross-FK güvenli sıra: child önce, parent sonra fark etmez — RENAME ad değil OID kullanır; yine de mantıksal sıra)
```sql
-- Cross-FK zinciri: yoai_approval_versions → yoai_pending_approvals; yoai_recommendation_results.approval_id → yoai_pending_approvals (ON DELETE SET NULL)
ALTER TABLE yoai_pending_approvals     RENAME TO dijimagic_pending_approvals;
ALTER TABLE yoai_approval_versions     RENAME TO dijimagic_approval_versions;
ALTER TABLE yoai_recommendation_results RENAME TO dijimagic_recommendation_results;
ALTER TABLE yoai_publish_audit_log     RENAME TO dijimagic_publish_audit_log;
ALTER TABLE yoai_articles              RENAME TO dijimagic_articles;
ALTER TABLE yoai_daily_runs            RENAME TO dijimagic_daily_runs;
ALTER TABLE yoai_action_outcomes       RENAME TO dijimagic_action_outcomes;
ALTER TABLE yoai_competitor_ads        RENAME TO dijimagic_competitor_ads;
ALTER TABLE yoai_competitor_insights   RENAME TO dijimagic_competitor_insights;
ALTER TABLE yoai_platform_doctrine     RENAME TO dijimagic_platform_doctrine;
ALTER TABLE yoai_model_decisions       RENAME TO dijimagic_model_decisions;
```

### 3.B — Kolonlar (2)
```sql
ALTER TABLE audiences RENAME COLUMN yoai_spec_json TO dijimagic_spec_json;
-- NOT: yoai_business_scope DB nesnesi DEĞİL (social_projects.business_scope zaten doğru ad; yalnız yorum + cookie string). DB ALTER YOK.
```

### 3.C — Index'ler (~52) — her tablonun renamenden SONRA
```sql
ALTER INDEX idx_yoai_articles_user                       RENAME TO idx_dijimagic_articles_user;
ALTER INDEX idx_yoai_articles_status                     RENAME TO idx_dijimagic_articles_status;
ALTER INDEX idx_yoai_daily_runs_user_date                RENAME TO idx_dijimagic_daily_runs_user_date;
ALTER INDEX idx_yoai_daily_runs_user_status              RENAME TO idx_dijimagic_daily_runs_user_status;
ALTER INDEX idx_yoai_action_outcomes_user_created        RENAME TO idx_dijimagic_action_outcomes_user_created;
ALTER INDEX idx_yoai_action_outcomes_campaign            RENAME TO idx_dijimagic_action_outcomes_campaign;
ALTER INDEX idx_yoai_action_outcomes_applied             RENAME TO idx_dijimagic_action_outcomes_applied;
ALTER INDEX idx_yoai_publish_audit_log_user              RENAME TO idx_dijimagic_publish_audit_log_user;
ALTER INDEX idx_yoai_publish_audit_log_status            RENAME TO idx_dijimagic_publish_audit_log_status;
ALTER INDEX idx_yoai_publish_audit_log_proposal          RENAME TO idx_dijimagic_publish_audit_log_proposal;
ALTER INDEX idx_yoai_publish_audit_log_user_status       RENAME TO idx_dijimagic_publish_audit_log_user_status;
ALTER INDEX uq_yoai_pending_approvals_user_proposal      RENAME TO uq_dijimagic_pending_approvals_user_proposal;
ALTER INDEX idx_yoai_pending_approvals_user              RENAME TO idx_dijimagic_pending_approvals_user;
ALTER INDEX idx_yoai_pending_approvals_status            RENAME TO idx_dijimagic_pending_approvals_status;
ALTER INDEX idx_yoai_pending_approvals_proposal_id       RENAME TO idx_dijimagic_pending_approvals_proposal_id;
ALTER INDEX idx_yoai_pending_approvals_platform          RENAME TO idx_dijimagic_pending_approvals_platform;
ALTER INDEX idx_yoai_pending_approvals_source_campaign   RENAME TO idx_dijimagic_pending_approvals_source_campaign;
ALTER INDEX idx_yoai_pending_approvals_created           RENAME TO idx_dijimagic_pending_approvals_created;
ALTER INDEX idx_yoai_pending_approvals_user_status_created RENAME TO idx_dijimagic_pending_approvals_user_status_created;
ALTER INDEX uq_yoai_platform_doctrine_type_active        RENAME TO uq_dijimagic_platform_doctrine_type_active;
ALTER INDEX idx_yoai_platform_doctrine_platform          RENAME TO idx_dijimagic_platform_doctrine_platform;
ALTER INDEX idx_yoai_platform_doctrine_campaign_type     RENAME TO idx_dijimagic_platform_doctrine_campaign_type;
ALTER INDEX idx_yoai_platform_doctrine_objective         RENAME TO idx_dijimagic_platform_doctrine_objective;
ALTER INDEX idx_yoai_platform_doctrine_channel_type      RENAME TO idx_dijimagic_platform_doctrine_channel_type;
ALTER INDEX idx_yoai_platform_doctrine_active            RENAME TO idx_dijimagic_platform_doctrine_active;
ALTER INDEX uq_yoai_competitor_ads_user_platform_source_fingerprint RENAME TO uq_dijimagic_competitor_ads_user_platform_source_fingerprint;
ALTER INDEX idx_yoai_competitor_ads_user                 RENAME TO idx_dijimagic_competitor_ads_user;
ALTER INDEX idx_yoai_competitor_ads_platform             RENAME TO idx_dijimagic_competitor_ads_platform;
ALTER INDEX idx_yoai_competitor_ads_source               RENAME TO idx_dijimagic_competitor_ads_source;
ALTER INDEX idx_yoai_competitor_ads_query_keyword        RENAME TO idx_dijimagic_competitor_ads_query_keyword;
ALTER INDEX idx_yoai_competitor_ads_campaign_type_context RENAME TO idx_dijimagic_competitor_ads_campaign_type_context;
ALTER INDEX idx_yoai_competitor_ads_advertiser_domain    RENAME TO idx_dijimagic_competitor_ads_advertiser_domain;
ALTER INDEX idx_yoai_competitor_ads_last_seen            RENAME TO idx_dijimagic_competitor_ads_last_seen;
ALTER INDEX idx_yoai_competitor_ads_user_platform_type_lastseen RENAME TO idx_dijimagic_competitor_ads_user_platform_type_lastseen;
ALTER INDEX uq_yoai_competitor_insights_tuple            RENAME TO uq_dijimagic_competitor_insights_tuple;
ALTER INDEX idx_yoai_competitor_insights_user            RENAME TO idx_dijimagic_competitor_insights_user;
ALTER INDEX idx_yoai_competitor_insights_user_platform_type RENAME TO idx_dijimagic_competitor_insights_user_platform_type;
ALTER INDEX idx_yoai_competitor_insights_generated       RENAME TO idx_dijimagic_competitor_insights_generated;
ALTER INDEX idx_yoai_model_decisions_user_id             RENAME TO idx_dijimagic_model_decisions_user_id;
ALTER INDEX idx_yoai_model_decisions_proposal_id         RENAME TO idx_dijimagic_model_decisions_proposal_id;
ALTER INDEX idx_yoai_model_decisions_source_campaign_id  RENAME TO idx_dijimagic_model_decisions_source_campaign_id;
ALTER INDEX idx_yoai_model_decisions_role                RENAME TO idx_dijimagic_model_decisions_role;
ALTER INDEX idx_yoai_model_decisions_provider            RENAME TO idx_dijimagic_model_decisions_provider;
ALTER INDEX idx_yoai_model_decisions_synthesis_hash      RENAME TO idx_dijimagic_model_decisions_synthesis_hash;
ALTER INDEX idx_yoai_model_decisions_created_at          RENAME TO idx_dijimagic_model_decisions_created_at;
ALTER INDEX idx_yoai_model_decisions_user_campaign_role  RENAME TO idx_dijimagic_model_decisions_user_campaign_role;
ALTER INDEX uq_yoai_approval_versions_approval_version   RENAME TO uq_dijimagic_approval_versions_approval_version;
ALTER INDEX idx_yoai_approval_versions_user_id           RENAME TO idx_dijimagic_approval_versions_user_id;
ALTER INDEX idx_yoai_approval_versions_approval_id       RENAME TO idx_dijimagic_approval_versions_approval_id;
ALTER INDEX idx_yoai_approval_versions_proposal_id       RENAME TO idx_dijimagic_approval_versions_proposal_id;
ALTER INDEX idx_yoai_approval_versions_approval_version_desc RENAME TO idx_dijimagic_approval_versions_approval_version_desc;
ALTER INDEX idx_yoai_approval_versions_created_at        RENAME TO idx_dijimagic_approval_versions_created_at;
ALTER INDEX yoai_recommendation_results_user_id_idx           RENAME TO dijimagic_recommendation_results_user_id_idx;
ALTER INDEX yoai_recommendation_results_proposal_id_idx       RENAME TO dijimagic_recommendation_results_proposal_id_idx;
ALTER INDEX yoai_recommendation_results_source_campaign_id_idx RENAME TO dijimagic_recommendation_results_source_campaign_id_idx;
ALTER INDEX yoai_recommendation_results_outcome_idx           RENAME TO dijimagic_recommendation_results_outcome_idx;
```

### 3.D — Constraint (FK + CHECK)
```sql
ALTER TABLE dijimagic_articles   RENAME CONSTRAINT yoai_articles_user_id_fkey   TO dijimagic_articles_user_id_fkey;
ALTER TABLE dijimagic_articles   RENAME CONSTRAINT yoai_articles_source_check   TO dijimagic_articles_source_check;
ALTER TABLE dijimagic_daily_runs RENAME CONSTRAINT yoai_daily_runs_user_id_fkey TO dijimagic_daily_runs_user_id_fkey;
```

### 3.E — Function + Trigger (function ÖNCE, trigger SONRA — trigger EXECUTE yeni adı görmeli)
```sql
ALTER FUNCTION update_yoai_recommendation_results_updated_at() RENAME TO update_dijimagic_recommendation_results_updated_at;
ALTER TRIGGER yoai_recommendation_results_updated_at_trigger ON dijimagic_recommendation_results
  RENAME TO dijimagic_recommendation_results_updated_at_trigger;
```

### 3.F — RLS Policy'ler (her tablo rename'inden SONRA)
```sql
-- action_outcomes
ALTER POLICY yoai_action_outcomes_select_own ON dijimagic_action_outcomes RENAME TO dijimagic_action_outcomes_select_own;
ALTER POLICY yoai_action_outcomes_insert_own ON dijimagic_action_outcomes RENAME TO dijimagic_action_outcomes_insert_own;
-- publish_audit_log
ALTER POLICY yoai_publish_audit_log_select_own ON dijimagic_publish_audit_log RENAME TO dijimagic_publish_audit_log_select_own;
ALTER POLICY yoai_publish_audit_log_insert_own ON dijimagic_publish_audit_log RENAME TO dijimagic_publish_audit_log_insert_own;
ALTER POLICY yoai_publish_audit_log_update_own ON dijimagic_publish_audit_log RENAME TO dijimagic_publish_audit_log_update_own;
-- daily_runs
ALTER POLICY yoai_daily_runs_select_own ON dijimagic_daily_runs RENAME TO dijimagic_daily_runs_select_own;
ALTER POLICY yoai_daily_runs_insert_own ON dijimagic_daily_runs RENAME TO dijimagic_daily_runs_insert_own;
ALTER POLICY yoai_daily_runs_update_own ON dijimagic_daily_runs RENAME TO dijimagic_daily_runs_update_own;
ALTER POLICY yoai_daily_runs_delete_own ON dijimagic_daily_runs RENAME TO dijimagic_daily_runs_delete_own;
-- articles
ALTER POLICY yoai_articles_select_own ON dijimagic_articles RENAME TO dijimagic_articles_select_own;
ALTER POLICY yoai_articles_insert_own ON dijimagic_articles RENAME TO dijimagic_articles_insert_own;
ALTER POLICY yoai_articles_update_own ON dijimagic_articles RENAME TO dijimagic_articles_update_own;
ALTER POLICY yoai_articles_delete_own ON dijimagic_articles RENAME TO dijimagic_articles_delete_own;
-- pending_approvals
ALTER POLICY yoai_pending_approvals_select_own ON dijimagic_pending_approvals RENAME TO dijimagic_pending_approvals_select_own;
ALTER POLICY yoai_pending_approvals_insert_own ON dijimagic_pending_approvals RENAME TO dijimagic_pending_approvals_insert_own;
ALTER POLICY yoai_pending_approvals_update_own ON dijimagic_pending_approvals RENAME TO dijimagic_pending_approvals_update_own;
ALTER POLICY yoai_pending_approvals_delete_own ON dijimagic_pending_approvals RENAME TO dijimagic_pending_approvals_delete_own;
-- competitor_ads
ALTER POLICY yoai_competitor_ads_select_own ON dijimagic_competitor_ads RENAME TO dijimagic_competitor_ads_select_own;
ALTER POLICY yoai_competitor_ads_insert_own ON dijimagic_competitor_ads RENAME TO dijimagic_competitor_ads_insert_own;
ALTER POLICY yoai_competitor_ads_update_own ON dijimagic_competitor_ads RENAME TO dijimagic_competitor_ads_update_own;
ALTER POLICY yoai_competitor_ads_delete_own ON dijimagic_competitor_ads RENAME TO dijimagic_competitor_ads_delete_own;
-- platform_doctrine
ALTER POLICY yoai_platform_doctrine_select_authenticated ON dijimagic_platform_doctrine RENAME TO dijimagic_platform_doctrine_select_authenticated;
ALTER POLICY yoai_platform_doctrine_write_service_role   ON dijimagic_platform_doctrine RENAME TO dijimagic_platform_doctrine_write_service_role;
-- competitor_insights
ALTER POLICY yoai_competitor_insights_select_own ON dijimagic_competitor_insights RENAME TO dijimagic_competitor_insights_select_own;
ALTER POLICY yoai_competitor_insights_insert_own ON dijimagic_competitor_insights RENAME TO dijimagic_competitor_insights_insert_own;
ALTER POLICY yoai_competitor_insights_update_own ON dijimagic_competitor_insights RENAME TO dijimagic_competitor_insights_update_own;
ALTER POLICY yoai_competitor_insights_delete_own ON dijimagic_competitor_insights RENAME TO dijimagic_competitor_insights_delete_own;
-- model_decisions
ALTER POLICY yoai_model_decisions_select_own ON dijimagic_model_decisions RENAME TO dijimagic_model_decisions_select_own;
-- approval_versions
ALTER POLICY yoai_approval_versions_select_own ON dijimagic_approval_versions RENAME TO dijimagic_approval_versions_select_own;
ALTER POLICY yoai_approval_versions_insert_own ON dijimagic_approval_versions RENAME TO dijimagic_approval_versions_insert_own;
-- recommendation_results
ALTER POLICY yoai_recommendation_results_select_own ON dijimagic_recommendation_results RENAME TO dijimagic_recommendation_results_select_own;
ALTER POLICY yoai_recommendation_results_insert_own ON dijimagic_recommendation_results RENAME TO dijimagic_recommendation_results_insert_own;
ALTER POLICY yoai_recommendation_results_update_own ON dijimagic_recommendation_results RENAME TO dijimagic_recommendation_results_update_own;
```
> Policy adlarını DB'den teyit et (`SELECT polname,tablename FROM pg_policies WHERE polname LIKE 'yoai_%'`) — yukarıdaki liste migration'lardan; varyasyon varsa script gerçek adları kullanmalı.

### 3.G — Migration dosyaları (14) — ad + İÇERİK `dijimagic_*` olacak şekilde yeniden yazılır
Timestamp prefix DEĞİŞMEZ (Supabase migration version tracking eşleşsin, re-apply olmasın; fresh `db reset` dijimagic şemasını üretsin):
```
20260304000000_create_audiences.sql                  (yoai_spec_json kolonu içerikte)
20260309000000_create_yoai_articles.sql              → ..._create_dijimagic_articles.sql
20260330000000_create_yoai_daily_runs.sql            → ..._create_dijimagic_daily_runs.sql
20260510000000_create_yoai_action_outcomes.sql       → ..._create_dijimagic_action_outcomes.sql
20260510001000_create_yoai_publish_audit_log.sql     → ..._create_dijimagic_publish_audit_log.sql
20260510002000_yoai_runs_articles_rls_fk.sql         → ..._dijimagic_runs_articles_rls_fk.sql
20260510003000_create_yoai_pending_approvals.sql     → ..._create_dijimagic_pending_approvals.sql
20260510004000_create_yoai_platform_doctrine.sql     → ..._create_dijimagic_platform_doctrine.sql
20260510005000_create_yoai_competitor_ads.sql        → ..._create_dijimagic_competitor_ads.sql
20260510005100_create_yoai_competitor_insights.sql   → ..._create_dijimagic_competitor_insights.sql
20260510006000_create_yoai_model_decisions.sql       → ..._create_dijimagic_model_decisions.sql
20260510007000_create_yoai_approval_versions.sql     → ..._create_dijimagic_approval_versions.sql
20260510008000_create_yoai_recommendation_results.sql → ..._create_dijimagic_recommendation_results.sql
20260522020000_yoai_daily_runs_account_scope.sql     → ..._dijimagic_daily_runs_account_scope.sql
20260525002000_yoai_articles_seo_columns.sql         → ..._dijimagic_articles_seo_columns.sql
```
> ⚠️ Bu, modalite-2'deki "migration ad değişimi tracking'i bozar" uyarısını kapatır: prefix korunduğu için version aynı; canlı DB zaten RENAME ile dijimagic_*'a alındığından `db reset` ile içerik tutarlı.

### 3.H — `yoai-brain` repo lockstep
- `scripts/brain/collect-outcomes.mjs`: `fetchAll('yoai_recommendation_results')`→`dijimagic_recommendation_results`, `'yoai_action_outcomes'`→`dijimagic_action_outcomes`; header yorumları `YoAi`→`DijiMagic`.
- `_learnings/README.md`, `_learnings/INDEX.md`, `_learnings/units/*.md`, `_learnings/global/*.md`, `_learnings/_data/latest.json` (`source` alanı) + `_data/history/*.json`: tablo referansları `dijimagic_*`.
- `_learnings` ayrı private repo (`yoai-brain`) → DB rename ile **aynı commit penceresinde** güncelle ve push et (yoksa collector boş döner). Repo adı `yoai-brain`→`dijimagic-brain` opsiyonel (§5/§7 dış pano), tablo referansları zorunlu.

---

## 4) env + Vercel

### 4.A — Değişken AD değişimleri (YALNIZ AD; değer aynı) — kod + `.env.local` + `.env.example` + Vercel
```
YOAI_ACTIVE_PUBLISH_ENABLED        → DIJIMAGIC_ACTIVE_PUBLISH_ENABLED
YOAI_DIRECT_PUBLISH_ENABLED        → DIJIMAGIC_DIRECT_PUBLISH_ENABLED
YOAI_DAILY_RUN_ENABLED             → DIJIMAGIC_DAILY_RUN_ENABLED
YOAI_COMPETITOR_INTEL_ENABLED      → DIJIMAGIC_COMPETITOR_INTEL_ENABLED
YOAI_MAX_DAILY_BUDGET_TRY          → DIJIMAGIC_MAX_DAILY_BUDGET_TRY
YOAI_MULTI_AI_ENABLED              → DIJIMAGIC_MULTI_AI_ENABLED
YOAI_MULTI_AI_TIMEOUT_MS           → DIJIMAGIC_MULTI_AI_TIMEOUT_MS
YOAI_MULTI_AI_MAX_COST_PER_RUN_TRY → DIJIMAGIC_MULTI_AI_MAX_COST_PER_RUN_TRY
YOAI_PER_ACCOUNT_SCOPE             → DIJIMAGIC_PER_ACCOUNT_SCOPE
YOALGORITMA_SCRAPE_COMPETITORS     → DIJIALGORITMA_SCRAPE_COMPETITORS
YOAI_SECRET                        → DIJIMAGIC_SECRET        (🔒 değer DEĞİŞMEZ — HMAC bozulmaz)
YOAI_SIGNATURE                     → DIJIMAGIC_SIGNATURE     (🔒 değer DEĞİŞMEZ)
```
Kod yerleri: `lib/yoai/{publishSafety,multiAiDecisionDesk,featureFlag,businessScope}.ts`, `lib/yoai/ai/competitorScanStep.ts`, `app/api/yoai/{one-click-approve,generate-ad,business-scope,improvements/hierarchy}/route.ts`, `app/yoalgoritma/page.tsx`, `hooks/useRegisteredAccounts.ts`, `lib/website/codegen/buildCodegenContext.ts`, `inngest/functions/{yoalgoritmaScan,perCampaignImprovements}.ts`, `components/seo/SeoWebhookConnect.tsx`. **Vercel: yeni adı EKLE → smoke → eski adı SİL** (kesinti yok). Vercel env'i sahip/CLI lockstep günceller.

### 4.B — Domain DEĞER değişimleri (ad aynı, değer dijimagic.com)
```
NEXT_PUBLIC_APP_URL  : https://yoai.yodijital.com  → https://dijimagic.com
META_REDIRECT_URI    : .../api/meta/callback        → https://dijimagic.com/api/meta/callback
TIKTOK_REDIRECT_URI  : .../tiktok-ads/callback       → https://dijimagic.com/api/integrations/tiktok-ads/callback
FROM_EMAIL           : "YO Dijital Medya Anonim Şirketi <info@yodijital.com>" → "DijiMagic <info@dijimagic.com>"
PLATFORM_FROM_ADDRESS: info@yodijital.com            → info@dijimagic.com
```
> ⚠️ `.env.local` şu an `app.dijimagic.com` kullanıyor (callback'ler) → spec'e göre `dijimagic.com`'a normalize et (subdomain'siz). `.env.local.backup-*` dosyaları da §1 replace kapsamında (working tree'de yoai izi kalmasın) AMA gizli/teknik dosya — git-dışı kalmalı (DOKUNMA listesi değil, replace evet; secret değer commitlenmez).

### 4.C — Hardcoded fallback default'ları (~32 dosya) — `'https://yoai.yodijital.com'` literal'leri `'https://dijimagic.com'`
`app/api/signup/route.ts`, `app/api/signup/verify/route.ts`, `app/api/email/track/click/route.ts`, `app/api/cron/email-drip-process/route.ts`, `lib/yoai/watchdog/notify.ts`, `lib/notifications/ownerNotifier.ts`, `lib/email/{sender,automationRunner,sendingAccountStore}.ts`, `lib/website/contactNotify.ts`, `middleware.ts:5` (`APP_HOST='yoai.yodijital.com'`→`'dijimagic.com'`), `app/robots.ts`, `app/sitemap.ts`, `app/layout.tsx:20` (`metadataBase`), per-page canonical (`app/privacy-policy`, `app/terms`, `app/gizlilik-politikasi`), `app/hesabim/page.tsx` (referral link), `app/api/meta/ads/create/route.ts:290`.

### 4.D — `vercel.json` cron path'leri (§2 klasör mv ile eşzamanlı)
```
/api/yoai/daily-run                → /api/dijimagic/daily-run
/api/cron/yoai-outcome-snapshots   → /api/cron/dijimagic-outcome-snapshots
/api/cron/yoalgoritma-scan         → /api/cron/dijialgoritma-scan
```

### 4.E — `.vercel/project.json` `projectName: "yoai-project"`→`"dijimagic"` (Vercel proje adı dış pano ile lockstep — §6). `package.json` + `package-lock.json` `"name":"YoAi"`→`"DijiMagic"` → `npm install` ile lockfile tazele.

### 4.F — `.env.example` tüm `YOAI_*`/yorum/domain default'ları (satır 2,21,51,53,55-62,97,98,146) güncellenir.

---

## 5) Inngest event ID değişimleri (`dijialgoritma/*` — NOT `dijimagic/*`)

| Eski | Yeni | send() yerleri | function trigger |
|---|---|---|---|
| `yoalgoritma/scan.user` | `dijialgoritma/scan.user` | `app/api/yoai/daily-run/route.ts:247`, `app/api/cron/yoalgoritma-scan/route.ts:133,138,211` | `inngest/functions/yoalgoritmaScan.ts:2,44` |
| `yoalgoritma/campaign-improvements.user` | `dijialgoritma/campaign-improvements.user` | `app/api/yoai/improvements/bootstrap/route.ts:69`, `app/api/yoai/improvements/scan/route.ts:35`, `app/api/cron/yoalgoritma-scan/route.ts:133,139,212` | `inngest/functions/perCampaignImprovements.ts:2,90` |
| `yoalgoritma/improvements.user` (legacy) | `dijialgoritma/improvements.user` | yorum: `app/api/yoai/improvements/scan/route.ts:16`, `app/api/cron/.../route.ts:16` | `inngest/functions/perAdImprovements.ts:2,90` |

**Kural:** send + function trigger AYNI commit'te (biri kaçarsa runtime kopar). TypeScript union tipi (`'yoalgoritma/scan.user' | 'yoalgoritma/campaign-improvements.user'` — `route.ts:133`) da güncellenir. `brand/ingest.user` DEĞİŞMEZ (yoai içermez). Deploy sonrası Inngest function registry doğrula.

---

## 6) ELLE İşlenecekler (otomatik replace YASAK)

1. **Yasal sayfalar — satıcı kimliği zorunlu (Mesafeli Sözleşmeler Yön. m.5):**
   - `app/mesafeli-satis-sozlesmesi/page.tsx`, `app/on-bilgilendirme-formu/page.tsx` (+ TR/EN karşılıkları: `kullanim-kosullari`, `terms`, ilgili `components/legal/*`).
   - Marka **DijiMagic**, AMA satıcı bloğu birebir: **"DijiMagic — Onur Şuay (şahıs işletmesi)"** + vergi dairesi/no + açık adres (**sahip sağlayacak — bkz. spec §10**). Şirket adı `YO Dijital Medya A.Ş.`'yi otomatik `DijiMagic`'e çevirmek yasal uyumu bozar.
2. **Locale TR/EN grameri (elle gözden geçir):** `locales/tr.json` + `locales/en.json` marka cümleleri — kesme işareti/ekler ("DijiMagic'e", "DijiMagic'in"), footer `"YO Dijital Medya A.Ş. · yoai.yodijital.com"` → `"DijiMagic · dijimagic.com"`, e-posta imza blokları. EN/TR **aynı key path**, parite korunur. Düz string→`t()` taşıma değil, mevcut değerlerin marka/gramerini düzelt.
3. **Logo tasarımı (alt-teslimat):** `public/logos/yoai-logo.png` görsel olarak "YoAi" wordmark içeriyor → dosya adı değişimi yetmez. DijiMagic wordmark + ikon yeni tasarlanır (mevcut palet/stile uyumlu), PC + mobil önizleme, sahip onayı sonrası yerleştir. `frontend-design` skill'i çağrılır.
4. **`docs/CHANGELOG.md` + `app/page.tsx:170` voiceagent cümlesi:** `voiceagent.yodijital.com` referansını otomatik domain replace ETME — cümleyi yeniden yaz (gradyan tekniği açıklaması; marka bağı koparılır).
5. **Dış panolar checklist (sahip + CLI):** Meta Business Manager domain doğrulama + OAuth Redirect URI + webhook + Privacy/Data-Deletion URL (spec §7.1, sıra bağlayıcı); TikTok Developer redirect; Google Cloud OAuth authorized domains; iyzico callback whitelist; Supabase Auth Site URL/Redirect; Cloudflare Turnstile allowed domains; DNS (A/CNAME + Meta TXT + SPF/DKIM/DMARC); GitHub repo adları (`yoai-brain`); launchd `com.yoai.saglik.plist` unload→rename→reload; yerel klasör `YoAi_Project`→`DijiMagic_Project` (EN SON — yolları değiştirir).

---

## 7) DOKUNMA Listesi (over-replacement / coincidental / 3.parti / binary / git-history)

1. **Git geçmişi/log/commit mesajları** — immutable, sevk edilmez, rebrand kapsam dışı (spec §11). Rewrite YOK.
2. **`node_modules/`, `.next/`, `.git/`** — replace ÇALIŞTIRMA.
3. **Binary varlıklar** — `.png/.jpg/.webp/.ico/.woff*/.mp4/.pdf`. `yoai-logo.png` SADECE git mv + görsel yeniden tasarım (içine sed çalıştırılmaz).
4. **`YOAI_SECRET` / `YOAI_SIGNATURE` DEĞERLERİ** — yalnız değişken ADI değişir; kriptografik değer birebir korunur (HMAC/webhook imzası bozulmaz).
5. **`data-yoai-*` attribute'ları** — modalite "geri uyumluluk için bırak" dedi AMA spec hard-requirement "tek kelime kalmayacak" + pre-launch (üretilmiş eski markup yok) → **değiştirilir** (`data-dijimagic-*`), attribute + JS selector + iframe protokol birlikte (§1.C). [Çelişki çözümü: spec kazanır.]
6. **Coincidental substring'ler — kelime-sınırı (`\b`) ile koru:** İngilizce "yoga", "kayoai" gibi kelime içi `yoai` parçaları (mevcut taramada YOK ama blind replace-all YASAK). `\byoai\b` / context-aware kullan; 303+ dosyada kör değişim yapma.
7. **`social_projects.business_scope`** — gerçek DB kolonu zaten doğru adda (`business_scope`); yalnız yorumdaki `yoai_business_scope` ibaresi string olarak düzelir. ALTER COLUMN YOK.
8. **3.parti paket adları** — `package.json` dependency'lerinde `yoai` adlı paket YOK (doğrulandı); `"name"` alanı dışında dependency adlarına dokunma.
9. **`brand/ingest.user` Inngest event'i** — `yoai` içermez, DEĞİŞMEZ.
10. **`.env.local` / `.env.local.backup-*` secret DEĞERLERİ** — token prefix string'leri (`yoai_refresh_*`, `yoai-tiktok-aes256-*`, `yoai_pmax_smoke_*`) kozmetik olarak rename edilir AMA bu dosyalar git-dışı kalır; gerçek secret değerleri Vercel'de ayrı yönetilir, commitlenmez.
11. **Migration timestamp prefix'leri** — değişmez (sadece dosya adının `yoai`/`yoalgoritma` parçası + içerik). Aksi Supabase version tracking'i bozar.
12. **301 yönlendirme / eski domain tutma** — kapsam dışı (kullanıcı yok, spec §11); eski `yoai.yodijital.com` Vercel'den kaldırılır.