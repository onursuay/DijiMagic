-- ─────────────────────────────────────────────────────────────
-- DijiAlgoritma — Approval Versions (Faz 5)
--
-- Bir AI önerisinin düzenleme/versiyon geçmişini saklar.
-- Her edit, regenerate veya orijinal snapshot bir satır olarak
-- kaydedilir. Audit immutability: UPDATE/DELETE policy yok.
--
-- source değerleri:
--   original    — proposal ilk üretildiğinde (lazy, detail modal'da)
--   edited      — kullanıcı düzenleme başlattığında
--   regenerated — yeniden üretildiğinde
--   manual      — manuel güncelleme
--
-- Tenant izolasyonu: signups(id) UUID FK + RLS.
-- Idempotent migration (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dijimagic_approval_versions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES public.signups(id) ON DELETE CASCADE,
  approval_id       UUID        NOT NULL REFERENCES public.dijimagic_pending_approvals(id) ON DELETE CASCADE,
  proposal_id       TEXT        NOT NULL,
  version_number    INTEGER     NOT NULL,
  source            TEXT        NOT NULL
    CHECK (source IN ('original', 'edited', 'regenerated', 'manual')),
  proposal_snapshot JSONB       NOT NULL,
  edited_payload    JSONB       NULL,
  change_summary    TEXT        NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        TEXT        NULL,
  metadata          JSONB       NOT NULL DEFAULT '{}'::jsonb
);

-- version_number her approval için tekil olmalı
CREATE UNIQUE INDEX IF NOT EXISTS uq_dijimagic_approval_versions_approval_version
  ON public.dijimagic_approval_versions (approval_id, version_number);

CREATE INDEX IF NOT EXISTS idx_dijimagic_approval_versions_user_id
  ON public.dijimagic_approval_versions (user_id);

CREATE INDEX IF NOT EXISTS idx_dijimagic_approval_versions_approval_id
  ON public.dijimagic_approval_versions (approval_id);

CREATE INDEX IF NOT EXISTS idx_dijimagic_approval_versions_proposal_id
  ON public.dijimagic_approval_versions (proposal_id);

CREATE INDEX IF NOT EXISTS idx_dijimagic_approval_versions_approval_version_desc
  ON public.dijimagic_approval_versions (approval_id, version_number DESC);

CREATE INDEX IF NOT EXISTS idx_dijimagic_approval_versions_created_at
  ON public.dijimagic_approval_versions (created_at DESC);

-- RLS: kullanıcı sadece kendi version kayıtlarını okuyup yazabilir.
-- UPDATE/DELETE policy yok — versiyonlar immutable audit kaydıdır.
ALTER TABLE public.dijimagic_approval_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dijimagic_approval_versions_select_own" ON public.dijimagic_approval_versions;
CREATE POLICY "dijimagic_approval_versions_select_own"
  ON public.dijimagic_approval_versions
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "dijimagic_approval_versions_insert_own" ON public.dijimagic_approval_versions;
CREATE POLICY "dijimagic_approval_versions_insert_own"
  ON public.dijimagic_approval_versions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Service role key tüm RLS'i bypass eder — uygulama kodu bu şekilde yazar.

COMMENT ON TABLE public.dijimagic_approval_versions IS
  'AI Reklam Önerisi versiyonlama tablosu (Faz 5). Her düzenleme/snapshot bir satır; immutable audit.';
COMMENT ON COLUMN public.dijimagic_approval_versions.source IS
  'Versiyon kaynağı: original | edited | regenerated | manual';
COMMENT ON COLUMN public.dijimagic_approval_versions.proposal_snapshot IS
  'Versiyonun proposal snapshot''ı (sanitize edilmiş, token/secret içermez).';
COMMENT ON COLUMN public.dijimagic_approval_versions.version_number IS
  'Her approval için 1''den başlayan artan versiyon numarası.';
