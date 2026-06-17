-- Web Site Yöneticisi kod-üretim motoru: serbest HTML çıktısı için kolonlar
ALTER TABLE website_pages
  ADD COLUMN IF NOT EXISTS html TEXT,
  ADD COLUMN IF NOT EXISTS format TEXT NOT NULL DEFAULT 'sections';

ALTER TABLE website_pages
  DROP CONSTRAINT IF EXISTS website_pages_format_chk;
ALTER TABLE website_pages
  ADD CONSTRAINT website_pages_format_chk CHECK (format IN ('sections','html'));
