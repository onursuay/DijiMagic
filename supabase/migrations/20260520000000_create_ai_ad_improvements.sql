-- ─────────────────────────────────────────────────────────────
-- YoAlgoritma — Per-Ad Improvement Cards (Faz 2)
--
-- Her AKTİF reklam için 1:1 "geliştirme kartı" (improvement card).
-- Eski ai_suggestions akışı PARALEL yaşamaya devam eder (deprecate
-- sonra). Bu tablo yeni per-ad pipeline'ın queryable çıktısıdır.
--
-- Ek olarak: user_business_intelligence'a Claude marka sentezi için
-- additive kolonlar (deterministik alanlar korunur — regresyon yok).
--
-- Tümü additive + idempotent (IF NOT EXISTS). Mevcut tabloya zarar yok,
-- repoint/split-brain riski yok. USE_AI_ENGINE=false ise yazılmaz.
-- ─────────────────────────────────────────────────────────────

-- ── 1) ai_ad_improvements ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_ad_improvements (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     TEXT NOT NULL,
  source_platform             TEXT NOT NULL CHECK (source_platform IN ('meta', 'google')),
  source_ad_id                TEXT NOT NULL,
  source_ad_name              TEXT,
  source_campaign_id          TEXT,
  source_campaign_name        TEXT,
  source_ad_status_snapshot   TEXT,            -- scan anındaki status (ACTIVE/ENABLED…)
  source_creative_hash        TEXT,            -- creative değişim tespiti (refresh policy)
  improvement_payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
                                               -- { ad_spec, reasoning, competitor_comparison,
                                               --   compliance_notes, confidence }
  confidence                  INTEGER CHECK (confidence BETWEEN 0 AND 100),
  status                      TEXT NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','approved','applied','rejected','cancelled','superseded')),
  publish_mode                TEXT NOT NULL DEFAULT 'auto'
                                CHECK (publish_mode IN ('auto','manual_publish')),
                                               -- meta → auto, google → manual_publish (Faz 2 karar 5)
  model                       TEXT,
  run_id                      UUID,            -- ai_engine_runs.id (FK yok — decoupled)
  publish_audit_id            UUID,            -- yoai_publish_audit_log.id (applied olunca)
  publish_error               TEXT,            -- publish başarısızsa hata (karar 1: approved'da kalır)
  publish_attempts            INTEGER NOT NULL DEFAULT 0,
  decided_by                  TEXT,            -- user_id veya 'system' (auto-cancel/supersede)
  decision_reason             TEXT,            -- kullanıcı reddederken not / sistem iptali sebebi
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at                  TIMESTAMPTZ,
  applied_at                  TIMESTAMPTZ,
  cancelled_at                TIMESTAMPTZ
);

-- Bir aktif reklamın aynı anda yalnızca TEK açık kartı olabilir
-- (pending veya approved). Reddedilen/iptal/superseded/applied tarihçede kalır.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_ad_improvements_open_unique
  ON public.ai_ad_improvements (user_id, source_platform, source_ad_id)
  WHERE status IN ('pending', 'approved');

CREATE INDEX IF NOT EXISTS idx_ai_ad_improvements_user_status
  ON public.ai_ad_improvements (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_ad_improvements_user_ad
  ON public.ai_ad_improvements (user_id, source_platform, source_ad_id);

CREATE INDEX IF NOT EXISTS idx_ai_ad_improvements_run
  ON public.ai_ad_improvements (run_id);

-- ── 2) Touch updated_at trigger (shared fonksiyon) ────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_ad_improvements_touch ON public.ai_ad_improvements;
CREATE TRIGGER trg_ai_ad_improvements_touch
  BEFORE UPDATE ON public.ai_ad_improvements
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── 3) RLS (defense-in-depth; service-role bypass'lar) ────────
ALTER TABLE public.ai_ad_improvements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY ai_ad_improvements_select_own ON public.ai_ad_improvements
    FOR SELECT TO authenticated USING (user_id = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Yazma yalnızca service role (RLS bypass) — ekstra policy gerekmez.

-- ── 4) user_business_intelligence: Claude sentez kolonları ────
-- Mevcut deterministik kolonlar korunur. Bunlar additive + nullable;
-- Claude sentezi başarısızsa NULL kalır, deterministik fallback çalışır.
ALTER TABLE public.user_business_intelligence
  ADD COLUMN IF NOT EXISTS ai_synthesis        JSONB,
  ADD COLUMN IF NOT EXISTS ai_synthesis_model  TEXT,
  ADD COLUMN IF NOT EXISTS ai_synthesis_at     TIMESTAMPTZ;

-- ── 5) Bilgilendirme ──────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE 'ai_ad_improvements tablosu + user_business_intelligence sentez kolonları hazır.';
END $$;
