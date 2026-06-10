-- ─────────────────────────────────────────────────────────────
-- Email Marketing — Başvuru tarihi + hesap (sayfa) kapsamı
--
-- email_contacts'a iki additive kolon:
--   submitted_at : reklam formuna GERÇEK başvuru/submit tarihi
--                  (crm_leads.lead_created_time'dan taşınır). CSV/manuel'de NULL.
--   page_id      : Meta sayfa kimliği — hesap bazlı filtre için
--                  (crm_leads.meta_page_id'den taşınır). CSV/manuel'de NULL.
--
-- crm_lead_id zaten vardı (create_email_marketing.sql); artık reklamdan düşen
-- lead'ler otomatik akışta bu kolonları doldurur.
--
-- Yalnız additive; idempotent (IF NOT EXISTS). Mevcut veriyi/RLS'i etkilemez.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.email_contacts ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE public.email_contacts ADD COLUMN IF NOT EXISTS page_id text;

-- Hesap (sayfa) bazlı filtre sorgusu için indeks.
CREATE INDEX IF NOT EXISTS idx_email_contacts_user_page ON public.email_contacts(user_id, page_id);
