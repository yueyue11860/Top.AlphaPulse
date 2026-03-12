-- Realtime quote cache health diagnostics
-- Purpose: provide a lightweight, queryable health status for realtime_quote_cache.

create or replace view public.v_realtime_quote_cache_health as
select
  count(*)::bigint as row_count,
  max(date) as max_date,
  max("time") as max_time,
  max(fetch_time) as max_fetch_time,
  case
    when count(*) = 0 then false
    when max(fetch_time) is null then false
    else (now() - max(fetch_time)) <= interval '10 minutes'
  end as is_fresh_10m
from public.realtime_quote_cache;

create or replace function public.get_realtime_quote_cache_health()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'rowCount', row_count,
    'maxDate', max_date,
    'maxTime', max_time,
    'maxFetchTime', max_fetch_time,
    'isFresh10m', is_fresh_10m,
    'checkedAt', now()
  )
  from public.v_realtime_quote_cache_health;
$$;

grant select on public.v_realtime_quote_cache_health to anon, authenticated, service_role;
grant execute on function public.get_realtime_quote_cache_health() to anon, authenticated, service_role;
