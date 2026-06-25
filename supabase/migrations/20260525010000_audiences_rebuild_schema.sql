-- ─────────────────────────────────────────────────────────────
-- DijiMagic — audiences tablosu ŞEMA YENİDEN OLUŞTURMA
--
-- Tespit: omddq'daki audiences tablosu repo şemasıyla UYUŞMUYOR. Repo'da
-- olmayan, NOT NULL fazla kolonlar içeriyor (platform, audience_id, …) ve
-- repo'nun beklediği kolonların bir kısmı eksikti. Sonuç: kod (route.ts /
-- job-runner) insert yaparken "null value in column platform/audience_id"
-- (23502) hatası → kitle oluşturma HİÇ çalışmamış.
--
-- Tablo BOŞ (0 kayıt) — veri kaybı yok. Eski/uyumsuz şemayı bırakıp repo
-- şemasıyla temiz yeniden oluşturuyoruz. Kod bu şemayla çalışıyor.
-- ─────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS public.audiences CASCADE;

CREATE TABLE public.audiences (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_account_id     text,                       -- nullable (çoklu işletme; kod değer verir)
  user_id           text,
  type              text NOT NULL,              -- CUSTOM | LOOKALIKE | SAVED
  source            text,                       -- PIXEL | IG | ... | STRATEGY (null olabilir)
  name              text NOT NULL,
  description       text,
  dijimagic_spec_json    jsonb NOT NULL DEFAULT '{}'::jsonb,
  meta_payload_json jsonb,
  meta_audience_id  text,
  status            text NOT NULL DEFAULT 'DRAFT',
  error_code        text,
  error_message     text,
  last_synced_at    timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audiences_user_id     ON public.audiences (user_id);
CREATE INDEX IF NOT EXISTS idx_audiences_ad_account  ON public.audiences (ad_account_id);
CREATE INDEX IF NOT EXISTS idx_audiences_status      ON public.audiences (status);

-- updated_at trigger (paylaşılan touch fonksiyonu varsa kullanır)
DO $$ BEGIN
  CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER AS $f$
  BEGIN NEW.updated_at = now(); RETURN NEW; END; $f$ LANGUAGE plpgsql;
EXCEPTION WHEN others THEN NULL; END $$;
DROP TRIGGER IF EXISTS trg_audiences_touch ON public.audiences;
CREATE TRIGGER trg_audiences_touch BEFORE UPDATE ON public.audiences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS (defense-in-depth; yazma service-role ile RLS bypass)
ALTER TABLE public.audiences ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY audiences_select_own ON public.audiences
    FOR SELECT TO authenticated USING (user_id = auth.uid()::text);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN RAISE NOTICE 'audiences tablosu repo şemasıyla yeniden oluşturuldu (platform/audience_id fazlalıkları kaldırıldı).'; END $$;
