-- ─────────────────────────────────────────────────────────────────────────────
-- YoAlgoritma — Campaign Intent Profiles (Campaign Intent Engine)
--
-- Kampanya verilerinden çıkarılan iş bağlamı (intent) profillerini saklar.
-- Her (user_id, platform, campaign_id) için tekil kayıt; 7 gün TTL.
--
-- Bu tablo YOKSA sistem kırılmaz — Intent Engine cache write hatasını
-- non-fatal olarak yakalar ve generation devam eder.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS campaign_intent_profiles (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  user_id               TEXT          NOT NULL,
  platform              TEXT          NOT NULL CHECK (platform IN ('Meta', 'Google')),
  campaign_id           TEXT          NOT NULL,

  -- Intent fields
  campaign_type         TEXT,
  business_domain       TEXT,
  offer_type            TEXT,
  service_or_product    TEXT,
  target_audience       TEXT,
  conversion_goal       TEXT,
  funnel_stage          TEXT          CHECK (funnel_stage IN (
                                        'awareness', 'consideration', 'conversion', 'full_funnel'
                                      )),

  -- Extracted signals
  detected_keywords     TEXT[]        NOT NULL DEFAULT '{}',
  forbidden_claims      TEXT[]        NOT NULL DEFAULT '{}',
  required_disclaimers  TEXT[]        NOT NULL DEFAULT '{}',

  -- Landing page
  landing_page_summary  TEXT,

  -- Quality
  confidence            INTEGER       NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100),
  missing_data          TEXT[]        NOT NULL DEFAULT '{}',
  evidence_json         JSONB,

  -- Lifecycle
  generated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  expires_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT campaign_intent_profiles_user_platform_campaign_uq
    UNIQUE (user_id, platform, campaign_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS campaign_intent_profiles_user_id_idx
  ON campaign_intent_profiles(user_id);

CREATE INDEX IF NOT EXISTS campaign_intent_profiles_expires_at_idx
  ON campaign_intent_profiles(expires_at)
  WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS campaign_intent_profiles_platform_idx
  ON campaign_intent_profiles(user_id, platform);

-- ── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_campaign_intent_profiles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS campaign_intent_profiles_updated_at_trigger
  ON campaign_intent_profiles;

CREATE TRIGGER campaign_intent_profiles_updated_at_trigger
  BEFORE UPDATE ON campaign_intent_profiles
  FOR EACH ROW EXECUTE FUNCTION update_campaign_intent_profiles_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Intent profilleri kullanıcı bazlı izole edilir.
-- Service role (adCreator server-side) her satıra erişebilir.

ALTER TABLE campaign_intent_profiles ENABLE ROW LEVEL SECURITY;

-- Service role bypass (read/write from API routes)
CREATE POLICY "service_role_all" ON campaign_intent_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
