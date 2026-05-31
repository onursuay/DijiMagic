-- ─────────────────────────────────────────────────────────────
-- Email Marketing — Gönderim Hesapları (kullanıcı kendi mailini bağlar)
--
-- type: smtp | domain | gmail | outlook
--   smtp   : config = {host, port, secure, user, passEnc(AES)} — şifre ŞİFRELİ.
--   domain : config = {resendDomainId, records[]} — kendi domain (Resend).
--   gmail/outlook : config = {oauth...} — OAuth (sonraki faz).
-- is_default: kampanyaların kullanacağı varsayılan hesap.
--
-- Yalnız additive; RLS açık (service-role yazar). Idempotent.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.email_sending_accounts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.signups(id) ON DELETE CASCADE,
  type       text NOT NULL CHECK (type IN ('smtp', 'domain', 'gmail', 'outlook')),
  label      text,
  from_name  text,
  from_email text NOT NULL,
  config     jsonb NOT NULL DEFAULT '{}'::jsonb,
  status     text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'failed')),
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_sending_accounts_user ON public.email_sending_accounts(user_id);

ALTER TABLE public.email_sending_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "email_sending_accounts_own" ON public.email_sending_accounts;
CREATE POLICY "email_sending_accounts_own" ON public.email_sending_accounts
  FOR SELECT USING (user_id = auth.uid());
