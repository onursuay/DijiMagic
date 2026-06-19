-- Web Site Yöneticisi — adım-adım kredi telemetrisi + yayın/düzenleme olay günlükleri (Bölüm 6).
-- ADDITIVE + idempotent (IF NOT EXISTS). Bu tablolar TELEMETRİ/UX akışıdır — GERÇEK kredi
-- defteri (credit_transactions, chargeFeature ile) DEĞİŞMEZ. website_credit_events tek bir
-- gerçek charge'ı fazlara KIRAR; çift düşüm YOKTUR (yalnız gösterim verisi).
-- RLS deseni create_website_tables ile birebir: *_own, websites.user_id üzerinden iç içe.

-- ── 1) website_credit_events — tek charge'ın faz-bazlı kırılımı (CreditUsageTimeline UI) ──
CREATE TABLE IF NOT EXISTS public.website_credit_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id            UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id               TEXT NOT NULL,
  version_id            UUID,
  phase                 TEXT NOT NULL CHECK (phase IN (
                          'designSystem','blueprint','render','images','translate','publish','custom_component')),
  credit_delta          INTEGER NOT NULL DEFAULT 0,
  credit_transaction_id UUID,
  status                TEXT NOT NULL DEFAULT 'charged' CHECK (status IN ('charged','refunded')),
  detail                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_website_credit_events_site ON public.website_credit_events (website_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_credit_events_user ON public.website_credit_events (user_id, created_at DESC);

-- ── 2) website_publish_events — yayın/yayından kaldırma/geri alma günlüğü ──
CREATE TABLE IF NOT EXISTS public.website_publish_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id     UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id        TEXT NOT NULL,
  version_id     UUID,
  action         TEXT NOT NULL CHECK (action IN ('publish','unpublish','rollback')),
  change_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_website_publish_events_site ON public.website_publish_events (website_id, created_at DESC);

-- ── 3) website_edit_events — sohbet/görsel/ürün/ayar düzenleme günlüğü ──
CREATE TABLE IF NOT EXISTS public.website_edit_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id      UUID NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL,
  version_id      UUID,
  edit_kind       TEXT NOT NULL CHECK (edit_kind IN ('chat_patch','visual_edit','product','settings')),
  target_block_id TEXT,
  delta           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_website_edit_events_site ON public.website_edit_events (website_id, created_at DESC);

-- ── RLS (service-role bypass + app-katmanı user_id filtresi; create_website_tables deseni) ──
ALTER TABLE public.website_credit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_publish_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.website_edit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "website_credit_events_own" ON public.website_credit_events;
CREATE POLICY "website_credit_events_own" ON public.website_credit_events
  USING (EXISTS (SELECT 1 FROM public.websites w WHERE w.id = website_id
    AND w.user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))));

DROP POLICY IF EXISTS "website_publish_events_own" ON public.website_publish_events;
CREATE POLICY "website_publish_events_own" ON public.website_publish_events
  USING (EXISTS (SELECT 1 FROM public.websites w WHERE w.id = website_id
    AND w.user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))));

DROP POLICY IF EXISTS "website_edit_events_own" ON public.website_edit_events;
CREATE POLICY "website_edit_events_own" ON public.website_edit_events
  USING (EXISTS (SELECT 1 FROM public.websites w WHERE w.id = website_id
    AND w.user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))));

COMMENT ON TABLE public.website_credit_events IS 'Web Site Yöneticisi — adım-adım kredi telemetrisi (tek charge faz kırılımı). GERÇEK defter credit_transactions; bu salt gösterim.';
COMMENT ON TABLE public.website_publish_events IS 'Web Site Yöneticisi — yayın/yayından kaldırma/geri alma olay günlüğü.';
COMMENT ON TABLE public.website_edit_events IS 'Web Site Yöneticisi — sohbet/görsel/ürün/ayar düzenleme olay günlüğü.';
