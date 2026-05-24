-- ─────────────────────────────────────────────────────────────
-- YoAi — Çoklu İşletme Profili: UNIQUE(user_id) → partial unique — Faz 2.4
--
-- Sorun: user_business_profiles UNIQUE(user_id) kullanıcı başına TEK profil
-- zorluyordu. Ajans modelinde her reklam hesabının kendi profili olmalı
-- (Antso, Fikret Petrol, Metropol Yayınları … her biri ayrı marka).
--
-- Çözüm: UNIQUE(user_id) kısıtını kaldır; yerine business_key dolu olanlar için
-- partial unique (user_id, business_key) koy.
--   • business_key dolu (hesaba bağlı profil) → (user_id, business_key) TEKİL.
--   • business_key NULL (legacy/henüz hesaba bağlanmamış profil — örn. "Belgemod")
--     → kısıtsız; pratikte kullanıcı başına 1 tane.
--
-- Geriye uyumlu: mevcut tek-profil (NULL) kullanıcıları bozulmaz. upsertProfile
-- artık find-then-write (constraint-agnostik) → onConflict'e bağlı değil.
--
-- NOT: user_business_intelligence UNIQUE(user_id) KASITLI korunuyor — intelligence
-- çoklu-profil desteği ayrı bir adımda (şimdilik son senkronlanan profil kazanır,
-- ikincil veri; profil + competitors + scan zaten profile_id bazlı).
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.user_business_profiles
  DROP CONSTRAINT IF EXISTS user_business_profiles_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS user_business_profiles_user_bkey_uidx
  ON public.user_business_profiles (user_id, business_key)
  WHERE business_key IS NOT NULL;

DO $$
BEGIN
  RAISE NOTICE 'Faz 2.4: user_business_profiles artık çoklu profil destekliyor (UNIQUE(user_id) → partial unique (user_id, business_key)).';
END $$;
