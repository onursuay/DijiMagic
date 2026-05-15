-- Gözetim Merkezi — Signup Blocklist & Yeni Onay Statusları
-- Idempotent: CREATE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS
-- Mevcut verilere dokunmaz.

-- ────────────────────────────────────────────────
-- 1. signup_blocklist tablosu
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS signup_blocklist (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_type   text NOT NULL,
  value        text NOT NULL,
  signup_id    uuid REFERENCES signups(id) ON DELETE SET NULL,
  reason       text,
  created_by   text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz,
  active       boolean NOT NULL DEFAULT true,
  metadata     jsonb,
  source_ip    text,
  CONSTRAINT chk_block_type CHECK (block_type IN ('user', 'email', 'domain', 'ip'))
);

-- Aynı aktif kayıt tekrar eklenmemesi için partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_blocklist_active_type_value
  ON signup_blocklist (block_type, lower(value))
  WHERE active = true;

-- Hızlı lookup indexleri
CREATE INDEX IF NOT EXISTS idx_blocklist_type_value  ON signup_blocklist (block_type, lower(value));
CREATE INDEX IF NOT EXISTS idx_blocklist_signup_id   ON signup_blocklist (signup_id) WHERE signup_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_blocklist_active       ON signup_blocklist (active) WHERE active = true;

-- RLS: Normal client erişemez; service role + admin endpointleri yönetir
ALTER TABLE signup_blocklist ENABLE ROW LEVEL SECURITY;

-- Sadece service role (server tarafı) okuyabilir/yazabilir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'signup_blocklist' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON signup_blocklist
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- ────────────────────────────────────────────────
-- 2. signups tablosu — yeni sütunlar
-- ────────────────────────────────────────────────

-- blocked_* sütunları
ALTER TABLE signups ADD COLUMN IF NOT EXISTS blocked_at          timestamptz;
ALTER TABLE signups ADD COLUMN IF NOT EXISTS blocked_by          text;
ALTER TABLE signups ADD COLUMN IF NOT EXISTS block_reason        text;

-- manual_review_* sütunları
ALTER TABLE signups ADD COLUMN IF NOT EXISTS manual_review_at    timestamptz;
ALTER TABLE signups ADD COLUMN IF NOT EXISTS manual_review_by    text;
ALTER TABLE signups ADD COLUMN IF NOT EXISTS manual_review_note  text;

-- ────────────────────────────────────────────────
-- 3. approval_status kısıtlaması güncelle
-- blocked ve manual_review ekle
-- ────────────────────────────────────────────────
ALTER TABLE signups DROP CONSTRAINT IF EXISTS signups_approval_status_check;
ALTER TABLE signups ADD CONSTRAINT signups_approval_status_check
  CHECK (approval_status IN (
    'pending',
    'approved',
    'rejected',
    'call_scheduled',
    'call_declined',
    'needs_call',
    'blocked',
    'manual_review'
  ));
