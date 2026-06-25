-- ─────────────────────────────────────────────────────────────
-- DijiMagic — dijimagic_daily_runs / dijimagic_articles için FK + RLS (Faz 0A)
--
-- Mevcut durum:
--   - dijimagic_daily_runs.user_id : TEXT (NOT NULL)
--   - dijimagic_articles.user_id   : TEXT (NOT NULL)
--   - signups.id              : UUID PK
--
-- Bu migration:
--   1) Mevcut user_id değerlerini doğrular (geçerli UUID + signups'ta var).
--   2) Geçersiz veya orphan veri varsa RAISE EXCEPTION ile durdurur
--      (transaction rollback olur, veri değişmez).
--   3) Geçerli veriyle TEXT → UUID type cast'i yapar.
--   4) signups(id) ON DELETE CASCADE FK'sını ekler.
--   5) RLS'yi aktive eder ve per-user select/insert/update/delete
--      policy'lerini yazar.
--
-- Tüm adımlar idempotent (zaten UUID ise / FK varsa skip eder).
-- Servis role key RLS'i bypass ettiği için uygulama akışı kırılmaz.
--
-- ─────────────────────────────────────────────────────────────
-- ⚠️  EĞER RAISE EXCEPTION FIRLAYIRSA MANUEL CLEANUP GEREKLİ:
--   -- Geçersiz user_id formatlı kayıtları görmek için:
--   SELECT id, user_id FROM dijimagic_daily_runs
--     WHERE user_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
--   -- Orphan referansları görmek için:
--   SELECT r.id, r.user_id FROM dijimagic_daily_runs r
--     LEFT JOIN signups s ON s.id::text = r.user_id
--     WHERE s.id IS NULL;
--   -- Aynı sorgular dijimagic_articles için de çalıştırılmalı.
--   -- Cleanup: ya kaydı sil, ya da user_id'yi geçerli bir signups(id)'ye backfill et.
-- ─────────────────────────────────────────────────────────────

-- 1) VALIDATION ────────────────────────────────────────────────
DO $$
DECLARE
  bad_runs       INT;
  orphan_runs    INT;
  bad_articles   INT;
  orphan_arts    INT;
  runs_is_uuid   BOOLEAN;
  arts_is_uuid   BOOLEAN;
  uuid_re        CONSTANT TEXT := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
BEGIN
  SELECT data_type = 'uuid' INTO runs_is_uuid
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'dijimagic_daily_runs' AND column_name = 'user_id';

  SELECT data_type = 'uuid' INTO arts_is_uuid
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'dijimagic_articles' AND column_name = 'user_id';

  IF runs_is_uuid IS NULL THEN
    RAISE NOTICE 'dijimagic_daily_runs tablosu yok — migration sırasında atlanacak';
  ELSIF NOT runs_is_uuid THEN
    EXECUTE format('SELECT count(*) FROM public.dijimagic_daily_runs WHERE user_id IS NULL OR user_id !~ %L', uuid_re)
      INTO bad_runs;
    IF bad_runs > 0 THEN
      RAISE EXCEPTION
        'Migration aborted: % rows in dijimagic_daily_runs have NULL or non-UUID user_id. Manual cleanup required (see migration header).',
        bad_runs;
    END IF;

    SELECT count(*) INTO orphan_runs
    FROM public.dijimagic_daily_runs r
    WHERE NOT EXISTS (SELECT 1 FROM public.signups s WHERE s.id::text = r.user_id);
    IF orphan_runs > 0 THEN
      RAISE EXCEPTION
        'Migration aborted: % rows in dijimagic_daily_runs reference user_id not present in signups. Manual cleanup required.',
        orphan_runs;
    END IF;
  END IF;

  IF arts_is_uuid IS NULL THEN
    RAISE NOTICE 'dijimagic_articles tablosu yok — migration sırasında atlanacak';
  ELSIF NOT arts_is_uuid THEN
    EXECUTE format('SELECT count(*) FROM public.dijimagic_articles WHERE user_id IS NULL OR user_id !~ %L', uuid_re)
      INTO bad_articles;
    IF bad_articles > 0 THEN
      RAISE EXCEPTION
        'Migration aborted: % rows in dijimagic_articles have NULL or non-UUID user_id. Manual cleanup required.',
        bad_articles;
    END IF;

    SELECT count(*) INTO orphan_arts
    FROM public.dijimagic_articles a
    WHERE NOT EXISTS (SELECT 1 FROM public.signups s WHERE s.id::text = a.user_id);
    IF orphan_arts > 0 THEN
      RAISE EXCEPTION
        'Migration aborted: % rows in dijimagic_articles reference user_id not present in signups. Manual cleanup required.',
        orphan_arts;
    END IF;
  END IF;
END
$$;

-- 2) TYPE CAST + 3) FK ────────────────────────────────────────
DO $$
DECLARE
  runs_exists  BOOLEAN;
  arts_exists  BOOLEAN;
  runs_is_uuid BOOLEAN;
  arts_is_uuid BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'dijimagic_daily_runs'
  ) INTO runs_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'dijimagic_articles'
  ) INTO arts_exists;

  IF runs_exists THEN
    SELECT data_type = 'uuid' INTO runs_is_uuid
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dijimagic_daily_runs' AND column_name = 'user_id';

    IF NOT runs_is_uuid THEN
      ALTER TABLE public.dijimagic_daily_runs
        ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = 'dijimagic_daily_runs'
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name = 'dijimagic_daily_runs_user_id_fkey'
    ) THEN
      ALTER TABLE public.dijimagic_daily_runs
        ADD CONSTRAINT dijimagic_daily_runs_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.signups(id) ON DELETE CASCADE;
    END IF;
  END IF;

  IF arts_exists THEN
    SELECT data_type = 'uuid' INTO arts_is_uuid
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'dijimagic_articles' AND column_name = 'user_id';

    IF NOT arts_is_uuid THEN
      ALTER TABLE public.dijimagic_articles
        ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = 'dijimagic_articles'
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name = 'dijimagic_articles_user_id_fkey'
    ) THEN
      ALTER TABLE public.dijimagic_articles
        ADD CONSTRAINT dijimagic_articles_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.signups(id) ON DELETE CASCADE;
    END IF;
  END IF;
END
$$;

-- 4) RLS + POLICIES ───────────────────────────────────────────
-- dijimagic_daily_runs
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'dijimagic_daily_runs'
  ) THEN
    EXECUTE 'ALTER TABLE public.dijimagic_daily_runs ENABLE ROW LEVEL SECURITY';
  END IF;
END
$$;

DROP POLICY IF EXISTS "dijimagic_daily_runs_select_own" ON public.dijimagic_daily_runs;
CREATE POLICY "dijimagic_daily_runs_select_own"
  ON public.dijimagic_daily_runs
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "dijimagic_daily_runs_insert_own" ON public.dijimagic_daily_runs;
CREATE POLICY "dijimagic_daily_runs_insert_own"
  ON public.dijimagic_daily_runs
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "dijimagic_daily_runs_update_own" ON public.dijimagic_daily_runs;
CREATE POLICY "dijimagic_daily_runs_update_own"
  ON public.dijimagic_daily_runs
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "dijimagic_daily_runs_delete_own" ON public.dijimagic_daily_runs;
CREATE POLICY "dijimagic_daily_runs_delete_own"
  ON public.dijimagic_daily_runs
  FOR DELETE
  USING (user_id = auth.uid());

-- dijimagic_articles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'dijimagic_articles'
  ) THEN
    EXECUTE 'ALTER TABLE public.dijimagic_articles ENABLE ROW LEVEL SECURITY';
  END IF;
END
$$;

DROP POLICY IF EXISTS "dijimagic_articles_select_own" ON public.dijimagic_articles;
CREATE POLICY "dijimagic_articles_select_own"
  ON public.dijimagic_articles
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "dijimagic_articles_insert_own" ON public.dijimagic_articles;
CREATE POLICY "dijimagic_articles_insert_own"
  ON public.dijimagic_articles
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "dijimagic_articles_update_own" ON public.dijimagic_articles;
CREATE POLICY "dijimagic_articles_update_own"
  ON public.dijimagic_articles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "dijimagic_articles_delete_own" ON public.dijimagic_articles;
CREATE POLICY "dijimagic_articles_delete_own"
  ON public.dijimagic_articles
  FOR DELETE
  USING (user_id = auth.uid());

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'dijimagic_daily_runs'
      AND constraint_name = 'dijimagic_daily_runs_user_id_fkey'
  ) THEN
    EXECUTE 'COMMENT ON CONSTRAINT dijimagic_daily_runs_user_id_fkey ON public.dijimagic_daily_runs IS '
      || quote_literal('Faz 0A: tenant izolasyonu için signups(id) ON DELETE CASCADE.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'dijimagic_articles'
      AND constraint_name = 'dijimagic_articles_user_id_fkey'
  ) THEN
    EXECUTE 'COMMENT ON CONSTRAINT dijimagic_articles_user_id_fkey ON public.dijimagic_articles IS '
      || quote_literal('Faz 0A: tenant izolasyonu için signups(id) ON DELETE CASCADE.');
  END IF;
END
$$;
