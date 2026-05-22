-- User Registered Ad Accounts (Madde 2 — çoklu reklam hesabı)
-- Kullanıcının planına eklediği reklam hesapları kümesi. Faturalama TOPLAM
-- adede göre (Meta + Google birlikte). AKTİF hesap hâlâ meta_connections /
-- google_ads_connections içinde tutulur; bu tablo kullanıcının arasında geçiş
-- yapabileceği izinli kümedir.
-- Plan limiti = subscriptions.ad_accounts (toplam). Owner = sınırsız.
-- Yalnızca additive — mevcut tablolara veya davranışa dokunmaz.

CREATE TABLE IF NOT EXISTS user_registered_ad_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('meta', 'google')),
  account_id TEXT NOT NULL,              -- Meta: act_xxxxx | Google: 10 haneli customer id
  account_name TEXT,
  login_customer_id TEXT,                -- Google yönetici (MCC) id; Meta için NULL
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, platform, account_id) -- aynı hesap kullanıcı başına bir kez
);

-- Kullanıcı bazlı hızlı listeleme + sayım
CREATE INDEX IF NOT EXISTS idx_user_registered_ad_accounts_user
  ON user_registered_ad_accounts (user_id, platform);
