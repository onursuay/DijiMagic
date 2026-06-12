-- Login brute-force throttle.
-- Serverless'te in-memory sayaç güvenilmez (çok örnek) → DB-backed.
-- Yalnız service-role erişir (uygulama lib/supabase/client service key kullanır);
-- RLS açık + politika yok = anon'a deny-all.

create table if not exists public.login_attempts (
  identifier     text primary key,                 -- normalize edilmiş e-posta
  fail_count     int not null default 0,
  first_fail_at  timestamptz not null default now(),
  locked_until   timestamptz,
  updated_at     timestamptz not null default now()
);

alter table public.login_attempts enable row level security;

-- Atomik başarısız-deneme kaydı. Pencere içinde p_max'a ulaşınca p_lock_secs kilitler.
-- locked_until döner (kilitliyse zaman, değilse null).
create or replace function public.register_login_failure(
  p_identifier  text,
  p_max         int,
  p_window_secs int,
  p_lock_secs   int
) returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now  timestamptz := now();
  v_row  public.login_attempts;
begin
  insert into public.login_attempts (identifier, fail_count, first_fail_at, updated_at)
    values (p_identifier, 1, v_now, v_now)
  on conflict (identifier) do update set
    fail_count = case
      when public.login_attempts.first_fail_at < v_now - make_interval(secs => p_window_secs)
        then 1
      else public.login_attempts.fail_count + 1 end,
    first_fail_at = case
      when public.login_attempts.first_fail_at < v_now - make_interval(secs => p_window_secs)
        then v_now
      else public.login_attempts.first_fail_at end,
    updated_at = v_now
  returning * into v_row;

  if v_row.fail_count >= p_max then
    update public.login_attempts
      set locked_until = v_now + make_interval(secs => p_lock_secs), updated_at = v_now
      where identifier = p_identifier
      returning locked_until into v_row.locked_until;
    return v_row.locked_until;
  end if;

  return null;
end $$;

-- Başarılı girişte sayaç sıfırlanır.
create or replace function public.clear_login_attempts(p_identifier text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.login_attempts where identifier = p_identifier;
$$;
