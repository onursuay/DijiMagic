-- Sosyal Medya Yönetimi — temel tablolar (additive + idempotent). CANONICAL (omddq).
-- social_projects        = adlandırılmış kampanya/proje (renk etiketli, bir/çok hesaba bağlanır).
-- social_scheduled_posts = planlanan içerik (format + scheduled_at + durum makinesi).
-- social_post_targets    = post ↔ hedef hesap (IG/FB çoklu hedef / cross-post).
-- social_post_media      = post medyası (MVP tek medya; carousel'e hazır).

CREATE TABLE IF NOT EXISTS public.social_projects (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        TEXT NOT NULL,
  business_scope TEXT,                       -- yoai_business_scope ile uyum; null = tüm hesaplar
  name           TEXT NOT NULL,
  color          TEXT NOT NULL DEFAULT '#10b981',
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_projects_user ON public.social_projects (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.social_scheduled_posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,
  project_id    UUID REFERENCES public.social_projects(id) ON DELETE SET NULL,
  format        TEXT NOT NULL CHECK (format IN ('feed','reels','story')),
  caption       TEXT,
  scheduled_at  TIMESTAMPTZ NOT NULL,
  timezone      TEXT NOT NULL DEFAULT 'Europe/Istanbul',
  status        TEXT NOT NULL DEFAULT 'scheduled'
                CHECK (status IN ('draft','scheduled','publishing','published','failed','cancelled')),
  attempts      INTEGER NOT NULL DEFAULT 0,
  last_error    TEXT,
  next_retry_at TIMESTAMPTZ,
  published_at  TIMESTAMPTZ,
  source        TEXT NOT NULL DEFAULT 'upload' CHECK (source IN ('upload','tasarim')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cron taraması: scheduled_at <= now() AND status='scheduled'
CREATE INDEX IF NOT EXISTS idx_social_posts_due ON public.social_scheduled_posts (status, scheduled_at);
-- Takvim sorgusu: kullanıcı + tarih aralığı
CREATE INDEX IF NOT EXISTS idx_social_posts_user_date ON public.social_scheduled_posts (user_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_social_posts_project ON public.social_scheduled_posts (project_id);

CREATE TABLE IF NOT EXISTS public.social_post_targets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       UUID NOT NULL REFERENCES public.social_scheduled_posts(id) ON DELETE CASCADE,
  platform      TEXT NOT NULL CHECK (platform IN ('instagram','facebook')),
  page_id       TEXT NOT NULL,
  ig_user_id    TEXT,
  account_label TEXT,                        -- UI gösterimi (sayfa adı / IG kullanıcı adı)
  target_status TEXT NOT NULL DEFAULT 'pending' CHECK (target_status IN ('pending','published','failed')),
  target_error  TEXT,
  published_id  TEXT,                         -- Meta media/post id
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_targets_post ON public.social_post_targets (post_id);

CREATE TABLE IF NOT EXISTS public.social_post_media (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      UUID NOT NULL REFERENCES public.social_scheduled_posts(id) ON DELETE CASCADE,
  media_type   TEXT NOT NULL CHECK (media_type IN ('image','video')),
  storage_path TEXT NOT NULL,
  public_url   TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  width        INTEGER,
  height       INTEGER,
  duration     NUMERIC,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_media_post ON public.social_post_media (post_id, sort_order);

-- RLS (service-role bypass + app-katmanı user_id filtresi; mevcut desenle aynı).
ALTER TABLE public.social_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "social_projects_own" ON public.social_projects;
CREATE POLICY "social_projects_own" ON public.social_projects
  USING (user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true)))
  WITH CHECK (user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true)));

DROP POLICY IF EXISTS "social_posts_own" ON public.social_scheduled_posts;
CREATE POLICY "social_posts_own" ON public.social_scheduled_posts
  USING (user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true)))
  WITH CHECK (user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true)));

DROP POLICY IF EXISTS "social_targets_own" ON public.social_post_targets;
CREATE POLICY "social_targets_own" ON public.social_post_targets
  USING (EXISTS (SELECT 1 FROM public.social_scheduled_posts p WHERE p.id = post_id
    AND p.user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))));

DROP POLICY IF EXISTS "social_media_own" ON public.social_post_media;
CREATE POLICY "social_media_own" ON public.social_post_media
  USING (EXISTS (SELECT 1 FROM public.social_scheduled_posts p WHERE p.id = post_id
    AND p.user_id = COALESCE(auth.uid()::text, current_setting('request.jwt.claim.sub', true))));

COMMENT ON TABLE public.social_scheduled_posts IS 'Sosyal Medya Yönetimi — planlanan içerik. RLS bypass via service role (app-layer scope).';
