-- user_billing_profile — fatura/vergi bilgisi SUNUCU TARAFI kalıcılığı (H9).
-- Eskiden bu bilgi yalnız tarayıcı localStorage'ındaydı; iyzico checkout'una
-- placeholder buyer/billingAddress ('-', TC '11111111111', Istanbul) gidiyordu.
-- Bu tablo dolu ise checkout GERÇEK fatura bilgisiyle yapılır; boş/yoksa kod
-- güvenli şekilde eski placeholder davranışına düşer (idempotent + additive).
CREATE TABLE IF NOT EXISTS public.user_billing_profile (
  user_id         uuid PRIMARY KEY,
  type            text NOT NULL DEFAULT 'individual',
  full_name       text,
  last_name       text,
  phone           text,
  country         text DEFAULT 'Türkiye',
  city            text,
  district        text,
  postal_code     text,
  address         text,
  company_name    text,
  tax_office      text,
  tax_number      text,
  identity_number text,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_billing_profile IS 'Kullanıcı fatura/vergi profili — iyzico buyer/billingAddress için (H9). Boşsa checkout placeholder fallback kullanır.';
