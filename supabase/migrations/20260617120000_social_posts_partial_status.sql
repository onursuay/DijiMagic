-- Sosyal Medya — 'partial' (kısmen yayınlandı) durumu (additive + idempotent).
-- Bazı hedefler yayınlanıp bazıları kalıcı başarısız olduğunda post artık 'failed'
-- yerine 'partial' işaretlenir; böylece durum hedef gerçekliğiyle çelişmez.

ALTER TABLE public.social_scheduled_posts DROP CONSTRAINT IF EXISTS social_scheduled_posts_status_check;
ALTER TABLE public.social_scheduled_posts ADD CONSTRAINT social_scheduled_posts_status_check
  CHECK (status IN ('draft','scheduled','publishing','published','failed','partial','cancelled'));
