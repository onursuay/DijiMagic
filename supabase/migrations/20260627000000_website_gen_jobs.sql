CREATE TABLE IF NOT EXISTS website_gen_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id    UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL,
  status        TEXT NOT NULL DEFAULT 'queued',
  stage         TEXT NOT NULL DEFAULT 'queued',
  progress      INTEGER NOT NULL DEFAULT 0,
  step_log      TEXT[] NOT NULL DEFAULT '{}',
  brief         TEXT,
  locales       TEXT[] NOT NULL DEFAULT '{}',
  site_type     TEXT NOT NULL DEFAULT 'landing',
  generated_html TEXT,
  design_vars   JSONB,
  error_reason  TEXT,
  inngest_run_id TEXT,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_website_gen_jobs_website ON website_gen_jobs(website_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_gen_jobs_user ON website_gen_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_gen_jobs_status ON website_gen_jobs(status);

-- Erişim service-role client üzerinden (websites tablosuyla aynı desen). RLS açık;
-- service key RLS'i bypass eder, anon/auth doğrudan erişemez.
ALTER TABLE website_gen_jobs ENABLE ROW LEVEL SECURITY;
