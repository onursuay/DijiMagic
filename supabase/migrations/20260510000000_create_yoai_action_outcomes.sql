-- ─────────────────────────────────────────────────────────────
-- YoAlgoritma — Learning Layer v1 (formal migration)
--
-- yoai_action_outcomes tablosu: YoAlgoritma'nın önerileri ve
-- kullanıcının uyguladığı aksiyonların kaydı.
--
-- Bu migration, daha önce docs/sql/yoai_action_outcomes.sql altında
-- elle çalıştırılması gereken SQL'in formal migration karşılığıdır.
-- Tablo daha önce manuel oluşturulmuş olabilir; tüm DDL idempotent
-- (IF NOT EXISTS / DROP POLICY IF EXISTS) yazılmıştır, bu yüzden
-- duplicate apply güvenlidir.
--
-- NOT: user_id TEXT olarak korunmuştur. Mevcut kayıtlar string formatta
-- olabileceği için tip dönüşümü yapılmamıştır. signups(id)'ye FK
-- eklenmemiştir (TEXT/UUID type uyumsuzluğu); tenant izolasyonu
-- uygulama katmanında (cookie/session) ve RLS policy'lerinde
-- sağlanır.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.yoai_action_outcomes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            TEXT NOT NULL,
  campaign_id        TEXT NOT NULL,
  campaign_name      TEXT,
  root_cause         TEXT,
  action_type        TEXT NOT NULL,
  suggestion_payload JSONB NOT NULL,
  applied            BOOLEAN NOT NULL DEFAULT false,
  applied_at         TIMESTAMPTZ,
  outcome_summary    TEXT,
  metrics_before     JSONB,
  metrics_after      JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_yoai_action_outcomes_user_created
  ON public.yoai_action_outcomes (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_yoai_action_outcomes_campaign
  ON public.yoai_action_outcomes (user_id, campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_yoai_action_outcomes_applied
  ON public.yoai_action_outcomes (user_id, applied, created_at DESC);

ALTER TABLE public.yoai_action_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "yoai_action_outcomes_select_own" ON public.yoai_action_outcomes;
CREATE POLICY "yoai_action_outcomes_select_own"
  ON public.yoai_action_outcomes
  FOR SELECT
  USING (user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true)));

DROP POLICY IF EXISTS "yoai_action_outcomes_insert_own" ON public.yoai_action_outcomes;
CREATE POLICY "yoai_action_outcomes_insert_own"
  ON public.yoai_action_outcomes
  FOR INSERT
  WITH CHECK (user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true)));

DROP POLICY IF EXISTS "yoai_action_outcomes_update_own" ON public.yoai_action_outcomes;
CREATE POLICY "yoai_action_outcomes_update_own"
  ON public.yoai_action_outcomes
  FOR UPDATE
  USING (user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true)))
  WITH CHECK (user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true)));

COMMENT ON TABLE public.yoai_action_outcomes IS
  'YoAlgoritma learning layer v1. Action outcomes (proposed + applied). RLS bypass via service role key for application-layer access.';
