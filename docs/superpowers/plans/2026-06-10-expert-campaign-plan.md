# Uzman Kampanya Planı — Implementation Plan (Alt-Proje A, Faz A1)

**Goal:** Strateji'ye markadan eksiksiz gerekçeli uzman kampanya planı (hedefleme/demografi/lokasyon/bütçe/CTA/metin) üreten advisory katman. Flag-off default, publish'e dokunulmaz.

**Tech:** TypeScript, Next.js, Claude (`claudeJson`), Strateji modülü, next-intl, `npx tsx` test harness.

**Flag:** `EXPERT_PLAN_ENABLED` (default-off).

---

## Task 1: Türkçe metin util + İstanbul/İ lokasyon bug fix
**Files:** Create `lib/yoai/turkishText.ts`; Modify `lib/yoai/businessSourceScanner.ts`; Test `src/tests/turkishText.test.ts`
- `normalizeTrLower(s)` — Türkçe-bilinçli küçük harf (İ→i, I→ı combining-dot strip), `cityIncludes(text, city)`.
- `extractLocations` → `cityIncludes` kullan (büyük "İstanbul" yakalanır).
- Tests: normalize İ/I; cityIncludes İstanbul/istanbul/ISTANBUL; extractLocations regresyon (İstanbul + Ankara).

## Task 2: ExpertCampaignPlan motoru
**Files:** Create `lib/strategy/expertPlan.ts`; Test `src/tests/expertPlan.test.ts`
- Tip `ExpertCampaignPlan` (spec şeması).
- `goalToObjective(goal_type, platform)` deterministik map (awareness/traffic/engagement/leads/app/sales → meta OUTCOME_* / google campaign type).
- `clampBudget(modelDaily, platform, objective, minDaily)` — min'in altına inmez.
- `validateCta(ctaValue, allowedValues)` — geçersizse default + warning.
- `generateExpertPlan({ input, platform, approvedKnowledge, deps })` — claudeJson (DI) → ham plan → guardrails uygula → ExpertCampaignPlan + warnings. `isClaudeReady` false → boş plan + warning.
- Tests (claudeJson mock): alanlar+reasoning; objective deterministik; bütçe clamp; CTA invalid→default; claude-not-ready→warning; lokasyon normalize.

## Task 3: API endpoint
**Files:** Create `app/api/strategy/instances/[id]/expert-plan/route.ts`
- POST; Strateji guard (abonelik/owner — mevcut desen); flag kapalı→`{disabled:true}`.
- Instance `InputPayload` oku; `channels.meta/google` için plan üret; onaylı bilgi yükle; `{ plans:{meta?,google?}, generatedAt }`.
- tsc doğrulama (route unit-test edilmez; motor test edildi).

## Task 4: Strateji UI — Uzman Plan paneli + i18n
**Files:** Create `components/strateji/ExpertPlanView.tsx`; Modify `app/strateji/[id]/[[...tab]]/page.tsx` (sekme/panel mount); Modify `locales/tr.json` + `locales/en.json`
- Panel: "Uzman Plan" — endpoint çağır; platform başına karar+gerekçe kartları + metin varyantları. Proje UI standardı, amber yok, animate-card-enter. Flag kapalı/boş → bilgilendirici durum.
- Tüm metinler i18n (tr+en aynı key path).

## Task 5: env + CHANGELOG + merge
**Files:** `.env.example`, `docs/CHANGELOG.md`
- `EXPERT_PLAN_ENABLED=false` dokümante.
- CHANGELOG. Tüm testler + tsc. Merge→main.

---

## Self-Review
- Spec kapsamı: util/bugfix(T1), motor+guardrail(T2), API(T3), UI+i18n(T4), env/doc(T5) → tüm kararlar.
- Güvenlik: flag-off default; advisory; publish/wizard/Apify dokunulmaz; migration yok.
- Regresyon: extractLocations testi + flag-off Strateji davranışı.
