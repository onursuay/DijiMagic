-- Marketing Setup Wizard — persistent state
-- Mirrors existing connection-table conventions (user_id TEXT, service-role access, no RLS).
-- NOTE: must be applied manually to the canonical Supabase project (omddq).

CREATE TABLE IF NOT EXISTS marketing_setups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  site_url TEXT NOT NULL,
  site_scan_result JSONB,
  selected_events JSONB,
  gtm_container_id TEXT,
  gtm_public_id TEXT,
  gtm_workspace_id TEXT,
  gtm_snippet_head TEXT,
  gtm_snippet_body TEXT,
  ga4_property_id TEXT,
  ga4_measurement_id TEXT,
  ga4_data_stream_id TEXT,
  meta_pixel_id TEXT,
  meta_ad_account_id TEXT,
  google_ads_customer_id TEXT,
  search_console_property TEXT,
  -- Encrypted refresh token for the separate "setup" Google consent (write scopes).
  -- Existing Meta/Google read connections are NOT touched; this is isolated.
  google_token_enc TEXT,
  google_token_scopes TEXT,
  meta_token_enc TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'error')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_setups_user_id ON marketing_setups(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_setups_status ON marketing_setups(status);

CREATE TABLE IF NOT EXISTS setup_steps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setup_id UUID NOT NULL REFERENCES marketing_setups(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'error')),
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_setup_steps_setup_id ON setup_steps(setup_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_setup_steps_unique ON setup_steps(setup_id, step_name);

CREATE TABLE IF NOT EXISTS capi_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setup_id UUID REFERENCES marketing_setups(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_id TEXT NOT NULL,
  match_quality_score NUMERIC,
  sent_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capi_events_setup_id ON capi_events(setup_id);
CREATE INDEX IF NOT EXISTS idx_capi_events_event_id ON capi_events(event_id);
