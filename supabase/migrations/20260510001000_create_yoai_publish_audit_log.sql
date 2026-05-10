-- ─────────────────────────────────────────────────────────────
-- YoAlgoritma — Publish Audit Log (Faz 0A)
--
-- Her publish denemesinin (one-click-approve / execute-action /
-- direct campaign create) auditlenebilir kaydı. Faz 0A'da bu tablo
-- yalnızca yapısal olarak hazırlanır; publish endpointlerine
-- bağlama ayrı fazda yapılacaktır.
--
-- status değerleri:
--   pending      — denemenin başladığı, henüz yanıt alınmadığı an
--   success      — kaynaklar başarıyla oluşturuldu (PAUSED veya ACTIVE)
--   failed       — Meta/Google API'sinden hata döndü
--   blocked      — preflight, budget guard veya policy check tarafından durduruldu
--   orphaned     — kısmi başarı (örn. campaign kuruldu, adset patladı)
--   rolled_back  — orphan resource cleanup başarıyla yapıldı
--
-- user_id UUID + signups(id) ON DELETE CASCADE FK ile sıkı tenant
-- izolasyonu. Bu tablo yeni olduğu için type/legacy data sorunu yok.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.yoai_publish_audit_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.signups(id) ON DELETE CASCADE,
  proposal_id         TEXT,
  platform            TEXT NOT NULL,
  source_campaign_id  TEXT,
  attempted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status              TEXT NOT NULL
    CHECK (status IN ('pending', 'success', 'failed', 'blocked', 'orphaned', 'rolled_back')),
  action_type         TEXT,
  payload_hash        TEXT,
  payload_excerpt     JSONB,
  response_excerpt    JSONB,
  error_message       TEXT,
  orphan_resources    JSONB NOT NULL DEFAULT '[]'::jsonb,
  budget_amount       NUMERIC(14,2),
  currency            TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_yoai_publish_audit_log_user
  ON public.yoai_publish_audit_log (user_id, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_yoai_publish_audit_log_status
  ON public.yoai_publish_audit_log (status, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_yoai_publish_audit_log_proposal
  ON public.yoai_publish_audit_log (proposal_id)
  WHERE proposal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_yoai_publish_audit_log_user_status
  ON public.yoai_publish_audit_log (user_id, status, attempted_at DESC);

ALTER TABLE public.yoai_publish_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "yoai_publish_audit_log_select_own" ON public.yoai_publish_audit_log;
CREATE POLICY "yoai_publish_audit_log_select_own"
  ON public.yoai_publish_audit_log
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "yoai_publish_audit_log_insert_own" ON public.yoai_publish_audit_log;
CREATE POLICY "yoai_publish_audit_log_insert_own"
  ON public.yoai_publish_audit_log
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "yoai_publish_audit_log_update_own" ON public.yoai_publish_audit_log;
CREATE POLICY "yoai_publish_audit_log_update_own"
  ON public.yoai_publish_audit_log
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE public.yoai_publish_audit_log IS
  'Publish denemelerinin denetim kaydı. Faz 0A: tablo hazır, publish endpointlerine bağlama Faz 0B+''ye bırakıldı. Service role key RLS''i bypass eder.';
COMMENT ON COLUMN public.yoai_publish_audit_log.payload_hash IS
  'SHA-256 hex of normalized payload — for deduplication / replay detection.';
COMMENT ON COLUMN public.yoai_publish_audit_log.orphan_resources IS
  'Partial-failure''da geride kalan kaynakların JSON listesi: [{platform, type, id, parent_id}, ...]';
