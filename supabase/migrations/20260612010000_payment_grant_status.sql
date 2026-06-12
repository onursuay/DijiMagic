-- Ödeme sonrası entitlement (grant) durumunu izle.
-- Sorun: ödeme 'succeeded' işaretlendikten sonra grant (abonelik/kredi verme)
-- hata verirse, müşteri para öder ama hiçbir şey almaz. Bu kolon, grant'ı
-- verilmemiş başarılı ödemeleri (reconcile gereken) tespit etmeyi sağlar.
--   pending : ödeme henüz işlenmedi / grant denenmedi
--   granted : entitlement başarıyla verildi
--   failed  : ödeme alındı ama grant başarısız → manuel/otomatik reconcile gerek

alter table public.payment_transactions
  add column if not exists grant_status text not null default 'pending';

create index if not exists idx_payment_tx_grant_failed
  on public.payment_transactions (grant_status)
  where grant_status = 'failed';
