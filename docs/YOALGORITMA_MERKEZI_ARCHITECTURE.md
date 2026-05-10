# YoAlgoritma Merkezi — Living Architecture Document

> **Son güncelleme:** 2026-05-11  
> **Kapsam:** Faz 0A → Faz 7  
> **Bu belge:** Codebase'den türetilmiştir; senkronize tutulacaktır.

---

## Genel Bakış

YoAlgoritma Merkezi; reklam verilerini analiz eden, rakip intel toplayan, AI destekli öneriler üreten, insan onayı bekleyen, opsiyonel olarak Meta'ya PAUSED kampanya olarak basan ve sonuçları feedback loop'a geri besleyen bütünleşik bir sistemdir.

**Temel prensipler:**
- Sahte veri üretilmez — tüm veriler gerçek API'ler veya kullanıcı datasından gelir
- Publish her zaman PAUSED — kampanya hiçbir zaman otomatik aktif olmaz
- Soft-fail pattern — tablo/key yoksa hata loglar, flow'u kırmaz
- Additive development — mevcut Meta/Google integration kodu dokunulmaz

---

## Mimari Katmanlar

```
┌─────────────────────────────────────────────────────────┐
│  UI Layer                                               │
│  AiAdSuggestions · ApprovalHistoryPanel                 │
│  OneClickApproveDialog · CompetitorDashboard            │
│  DecisionDeskSummary · ApprovalVersionPanel             │
└──────────────┬──────────────────────────────────────────┘
               │ fetch / REST
┌──────────────▼──────────────────────────────────────────┐
│  API Routes (app/api/yoai/*)                            │
│  approvals · approvals/[id] · approvals/[id]/versions   │
│  competitors/analyze · competitors/google-auction       │
│  one-click-approve · results · daily-run                │
└──────────────┬──────────────────────────────────────────┘
               │ import
┌──────────────▼──────────────────────────────────────────┐
│  Business Logic (lib/yoai/*)                            │
│  adCreator · synthesisEngine · competitorAnalyzer       │
│  approvalStore · modelDecisionStore · approvalVersions  │
│  competitorAdStore · competitorInsightStore             │
│  competitorScanner · googleTransparencyConnector        │
│  publishSafety · publishPayloadValidator · policyGuard  │
│  publishAuditStore · resultTrackingStore                │
│  learningStore · campaignDoctrine                       │
└──────────────┬──────────────────────────────────────────┘
               │ supabase-js
┌──────────────▼──────────────────────────────────────────┐
│  Supabase (PostgreSQL + RLS)                            │
│  yoai_pending_approvals · yoai_approval_versions        │
│  yoai_model_decisions · yoai_competitor_ads             │
│  yoai_competitor_insights · yoai_platform_doctrine      │
│  yoai_publish_audit_log · yoai_action_outcomes          │
│  yoai_recommendation_results                            │
└─────────────────────────────────────────────────────────┘
```

---

## Faz Tarihi

### Faz 0A — Temel Approval Queue
**Dosyalar:** `lib/yoai/approvalStore.ts`, `supabase/migrations/20260510003000_create_yoai_pending_approvals.sql`

- `yoai_pending_approvals` tablosu: status enum (pending/approved/rejected/hold/editing/published/failed/expired)
- `upsertPendingApprovalFromProposal()` — proposal üretildiğinde idempotent kayıt
- `updateApprovalStatus()` — PATCH; metadata JSONB merge ile rejection_category/hold_category destekler
- `markApprovalPublished()` — publish başarılı olunca published + audit_id
- RLS: user_id = auth.uid() SELECT/INSERT/UPDATE; soft-fail (tablo yoksa log + null)

---

### Faz 0B — Publish Audit Log
**Dosyalar:** `lib/yoai/publishAuditStore.ts`, `supabase/migrations/20260510001000_create_yoai_publish_audit_log.sql`

- `yoai_publish_audit_log`: pending → success/blocked/failed/orphaned yaşam döngüsü
- `recordPublishAuditAttempt()`, `updatePublishAuditStatus()`, `hashPayload()`, `sanitizeResponseExcerpt()`
- Orphan resource tracking: campaign/adset/ad partial create durumları kaydedilir

---

### Faz 0C — One-Click Approve Pipeline
**Dosyalar:** `app/api/yoai/one-click-approve/route.ts`, `lib/yoai/meta/orchestrator.ts`

Flow:
1. Auth check
2. Feature flag + PAUSED guard (`assertPausedOnly`) ← **Faz 6'da eklendi**
3. `validatePublishFeatureFlags` ← **Faz 6'da eklendi**
4. `validatePublishPayload` ← **Faz 6'da eklendi**
5. Budget guard (`evaluateBudgetGuard`) — `YOAI_MAX_DAILY_BUDGET_TRY`
6. Capability check (`getCapability`)
7. Asset resolution (page/pixel/lead form)
8. Preflight (`runPreflight`)
9. Policy guard (`checkPolicyViolations`) ← **Faz 6'da eklendi**
10. AI image generate → Meta upload
11. Orchestrator (`orchestrateMetaCreate`) — tümü PAUSED
12. Audit update + approval published + learning kaydı

---

### Faz 0D — Approval History Panel
**Dosyalar:** `components/yoai/ApprovalHistoryPanel.tsx`

- Son 20 approval kaydını listeler (`GET /api/yoai/approvals?limit=20`)
- Status badge, rejection/hold kategorisi, AI decision badge inline
- Expand → öneri detayı; **Faz 7'de** lazy outcome fetch eklendi

---

### Faz 1 — DB-Driven Platform Doctrine
**Dosyalar:** `lib/yoai/campaignDoctrine.ts`, `supabase/migrations/20260510004000_create_yoai_platform_doctrine.sql`

- `yoai_platform_doctrine`: platform/campaign_type bazında stratejik doktrin
- `getCampaignTypeDoctrine()` — synthesis engine tarafından tüketilir
- Fallback: tablo yoksa veya satır yoksa boş döner

---

### Faz 2 — Competitor Intel Persistence
**Dosyalar:** `lib/yoai/competitorAdStore.ts`, `lib/yoai/competitorInsightStore.ts`

- `yoai_competitor_ads`: platform+source bazında normalize reklam kayıtları, fingerprint-based upsert, dedup
- `yoai_competitor_insights`: platform+query başına özet insight (CTR/budget/tema/format ağırlıkları)
- `upsertCompetitorAds()` — fingerprint match → update | insert; inserted/updated/skipped sayaçları
- `generateCompetitorInsightFromAds()` — deterministic aggregation, LLM yok
- `buildCompetitorContextForPrompt()` — synthesis engine tarafından tüketilir

---

### Faz 2B — Google Ads Transparency Connector + Meta Scanner
**Dosyalar:** `lib/yoai/googleTransparencyConnector.ts`, `lib/yoai/competitorScanner.ts`, `app/api/yoai/competitors/google-auction/route.ts`, `components/yoai/CompetitorDashboard.tsx`

- **googleTransparencyConnector.ts**: SerpApi `engine=google_ads_transparency_center`; `SERPAPI_API_KEY` yoksa `supported:false`; `normalizeGoogleTransparencyAd()` → NormalizedCompetitorAd
- **competitorScanner.ts**: Unified Meta+Google scanner; `deriveCompetitorQueriesFromCampaigns()` (max 5 sorgu); `runCompetitorScanForUser()` → `Promise.allSettled` soft-fail per platform
- **google-auction route**: SerpApi → persist → insight; key yoksa `{ supported:false }`
- **CompetitorDashboard**: Header'da Meta/Google bağlantı durumu badge'leri

---

### Faz 3 — Synthesis Engine v2
**Dosyalar:** `lib/yoai/synthesisEngine.ts`

- Kampanya + doktrin + rakip intel + tanı verilerini birleştiren fusion engine
- `buildSynthesisContext()` — paralel veri toplama
- `synthesizeProposal()` — LLM'e zengin context gönderir; doktrin + rakip ağırlıklarını dahil eder
- LLM sağlayıcı: Anthropic/OpenAI/Gemini fallback chain

---

### Faz 3.5 — Environment Security Hardening
**Dosyalar:** `lib/yoai/security/*.ts`, `.env.example`

- Webhook signature doğrulama
- Token encryption (AES-256-GCM)
- Cron secret validation
- Server-only module guards

---

### Faz 4 — Multi-AI Decision Desk (Shadow Mode)
**Dosyalar:** `lib/yoai/multiAiEngine.ts`, `lib/yoai/modelDecisionStore.ts`, `supabase/migrations/20260510006000_create_yoai_model_decisions.sql`

- `yoai_model_decisions`: role (strategist/creative/risk_policy/technical_validator/judge) + provider + output_json
- `YOAI_MULTI_AI_ENABLED=false` — default kapalı (shadow mode)
- Judge: `JudgeFinalDecision` = publish_ready/needs_edit/reject/hold/needs_human_review
- `getJudgeDecisionSummaryByCampaignIds()` — batch N+1 problemi olmadan decision badge
- Soft-fail: engine çalışmasa bile approval flow devam eder

---

### Faz 5 — Approval Lifecycle Advanced
**Dosyalar:** `lib/yoai/approvalStore.ts` (eklenti), `lib/yoai/modelDecisionStore.ts` (eklenti), `supabase/migrations/20260510007000_create_yoai_approval_versions.sql`, `components/yoai/DecisionDeskSummary.tsx`, `components/yoai/ApprovalVersionPanel.tsx`, `components/yoai/AiAdSuggestions.tsx` (güncellendi)

- **yoai_approval_versions**: UNIQUE(approval_id, version_number); source CHECK (original/edited/regenerated/manual); NO UPDATE/DELETE policy (immutable audit)
- `createApprovalVersion()`, `listApprovalVersions()`, `ensureInitialApprovalVersion()`
- **DecisionDeskSummary**: 5 rol satırı + judge final decision badge; amber/sarı yok
- **ApprovalVersionPanel**: collapse/expand, GitBranch icon, version list
- **AiAdSuggestions** güncellendi: rejection/hold category dropdown, decision badge in card, detail modal lazy fetch (version + decision rows concurrent), non-blocking version POST on edit

---

### Faz 6 — Direct Publish Safety Layer Advanced
**Dosyalar:** `lib/yoai/publishSafety.ts`, `lib/yoai/publishPayloadValidator.ts`, `lib/yoai/policyGuard.ts`

- **publishSafety.ts**: `isDirectPublishEnabled()` (YOAI_DIRECT_PUBLISH_ENABLED), `isActivePublishEnabled()` (YOAI_ACTIVE_PUBLISH_ENABLED), `assertPausedOnly()` (ACTIVE açıksa throw), `getMaxDailyBudgetTry()`, `validatePublishFeatureFlags()`
- **publishPayloadValidator.ts**: platform/campaignName/campaignObjective/headline/dailyBudget/finalUrl/primaryText — finalUrl destination'a göre koşullu
- **policyGuard.ts**: 13 deterministic regex kural (Türkçe+İngilizce); garantili kazanç/risksiz yatırım/kumar/ilaç garantisi/clickbait; riskLevel=high → yayın blok; riskLevel=low → uyarı geç
- one-click-approve route'a entegre: step 0 (flags+paused), step 0B (payload), step 7B (policy)
- OneClickApproveDialog: 4 maddelik "Otomatik güvenlik kontrolleri" info kutusu

---

### Faz 7 — Result Tracking / Feedback Loop
**Dosyalar:** `lib/yoai/resultTrackingStore.ts`, `app/api/yoai/results/route.ts`, `supabase/migrations/20260510008000_create_yoai_recommendation_results.sql`

- `yoai_recommendation_results`: before_snapshot + after_snapshot (MetricSnapshot JSONB) + metric_delta + outcome enum + outcome_summary
- `computeMetricDelta()` — sayısal alan farkları
- `summarizeOutcomeDeterministic()` — CTR±%15, CPC±%15 (ters), ROAS±%10 eşikleri; insufficient_data/improved/no_change/declined
- `recordBeforeSnapshot()` / `recordAfterSnapshot()` — after çağrısı otomatik delta+outcome hesaplar
- results/route.ts: GET (filters: outcome/status/sourceCampaignId/limit), POST (before/after)
- **ApprovalHistoryPanel**: expand açılınca lazy fetch; improved=emerald, declined=red, diğer=gray outcome badge

---

## Tablo Şeması Özeti

| Tablo | Amaç | Migration |
|-------|------|-----------|
| `yoai_pending_approvals` | Approval lifecycle | 20260510003000 |
| `yoai_approval_versions` | Versiyonlama (immutable) | 20260510007000 |
| `yoai_model_decisions` | Multi-AI karar kayıtları | 20260510006000 |
| `yoai_publish_audit_log` | Publish girişim audit | 20260510001000 |
| `yoai_action_outcomes` | Learning loop geçmişi | 20260510000000 |
| `yoai_competitor_ads` | Normalize rakip reklamlar | 20260510005000 |
| `yoai_competitor_insights` | Platform başına insight özeti | 20260510005100 |
| `yoai_platform_doctrine` | Kampanya tipi doktrin | 20260510004000 |
| `yoai_recommendation_results` | Before/after metric tracking | 20260510008000 |

Tüm tablolar: `user_id = auth.uid()` RLS; `service_role` bypass.

---

## Ortam Değişkenleri

| Değişken | Amaç | Default |
|----------|------|---------|
| `YOAI_MAX_DAILY_BUDGET_TRY` | Bütçe üst sınırı | 1000 |
| `YOAI_MULTI_AI_ENABLED` | Multi-AI Decision Desk | false |
| `YOAI_MULTI_AI_TIMEOUT_MS` | Multi-AI timeout | 45000 |
| `YOAI_DIRECT_PUBLISH_ENABLED` | One-click-approve aktif | true (tanımsızsa) |
| `YOAI_ACTIVE_PUBLISH_ENABLED` | ACTIVE kampanya izni | false |
| `YOAI_COMPETITOR_INTEL_ENABLED` | Rakip tarama | true |
| `YOAI_DAILY_RUN_ENABLED` | Günlük otomatik analiz | true |
| `SERPAPI_API_KEY` | Google Transparency | — (yoksa disabled) |
| `META_TOKEN_SECRET` | Token şifreleme (AES-256) | zorunlu |
| `META_WEBHOOK_VERIFY_TOKEN` | Webhook doğrulama | zorunlu |
| `CRON_SECRET` | Cron auth | zorunlu |

---

## Güvenlik Katmanları

```
Publish flow güvenlik sırası:
  1. Auth (session_id cookie)
  2. assertPausedOnly() — ACTIVE publish yasağı
  3. validatePublishFeatureFlags() — DIRECT_PUBLISH_ENABLED
  4. validatePublishPayload() — zorunlu alanlar
  5. evaluateBudgetGuard() — max TRY limiti
  6. capability / preflight checks
  7. checkPolicyViolations() — içerik politikası (deterministic)
  8. Orchestrator → Meta API (tümü PAUSED)
```

---

## Data Flow

```
Kullanıcı verisi (Meta/Google kampanyaları)
  ↓ synthesisEngine.buildSynthesisContext()
  ↓ (+ competitor intel + doctrine + diagnosis)
  ↓ synthesizeProposal() → FullAdProposal
  ↓
  ↓ upsertPendingApprovalFromProposal()
  ↓  → yoai_pending_approvals (status: pending)
  ↓
  ↓ [Multi-AI: shadow mode]
  ↓ multiAiEngine → yoai_model_decisions
  ↓ judge → JudgeFinalDecision
  ↓
  ↓ AiAdSuggestions UI
  ↓ ─ Onayla → status: approved
  ↓ ─ Reddet (+ kategori) → status: rejected
  ↓ ─ Beklet (+ kategori) → status: hold
  ↓ ─ Düzenle → wizard + version create
  ↓ ─ Tek Tık Onayla → one-click-approve route
  ↓      → safety guards (flags, payload, policy)
  ↓      → Meta API → PAUSED campaign+adset+ad
  ↓      → status: published
  ↓      → yoai_publish_audit_log: success
  ↓
  ↓ [Result Tracking — Faz 7]
  ↓ recordBeforeSnapshot() → yoai_recommendation_results
  ↓ [sonra] recordAfterSnapshot() → delta + outcome
```

---

## Genişleme Kılavuzu

**Yeni platform eklemek (ör. TikTok):**
1. `adCreator.ts` → Platform type'ına ekle
2. Yeni `lib/yoai/tiktok/` orchestrator
3. `one-click-approve/route.ts` → platform switch case
4. `capabilityMatrix.ts` → TikTok objective/destination mapping
5. `yoai_pending_approvals.platform` CHECK constraint güncelle (migration)

**Yeni Multi-AI rolü eklemek:**
1. `multiAiEngine.ts` → role tanımı + prompt
2. `yoai_model_decisions` → role CHECK constraint güncelle (migration)
3. `DecisionDeskSummary.tsx` → ROLE_META objesine ekle

**Yeni güvenlik kuralı eklemek:**
- Content policy: `policyGuard.ts` → `BANNED_PATTERNS` dizisine regex ekle
- Payload field: `publishPayloadValidator.ts` → `FIELD_SPECS` dizisine ekle
- Feature flag: `publishSafety.ts` → `validatePublishFeatureFlags()` genişlet
