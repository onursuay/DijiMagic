-- ─────────────────────────────────────────────────────────────
-- CRM — Faz 2.5: Pipeline aşamaları (Meta Lead Center modeli)
--
-- status 3 durumdan (new|positive|negative) 5 aşamaya geçer:
--   giris        (Giriş — yeni gelen, default)
--   uygun        (Uygun — nitelikli)
--   donusum      (Dönüşüm — müşteri oldu)
--   kayip        (Kayıp)
--   uygun_degil  (Uygun değil)
--
-- Mevcut kayıtlar eşlenir: new→giris, positive→uygun, negative→uygun_degil.
-- Idempotent: DROP IF EXISTS + yeniden ADD; UPDATE yalnız eski değerlere dokunur.
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.crm_leads DROP CONSTRAINT IF EXISTS crm_leads_status_check;

UPDATE public.crm_leads SET status = CASE status
  WHEN 'new'      THEN 'giris'
  WHEN 'positive' THEN 'uygun'
  WHEN 'negative' THEN 'uygun_degil'
  ELSE status
END
WHERE status IN ('new', 'positive', 'negative');

ALTER TABLE public.crm_leads ALTER COLUMN status SET DEFAULT 'giris';

ALTER TABLE public.crm_leads ADD CONSTRAINT crm_leads_status_check
  CHECK (status IN ('giris', 'uygun', 'donusum', 'kayip', 'uygun_degil'));
