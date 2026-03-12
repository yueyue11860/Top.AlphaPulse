create or replace function public.refresh_quote_latest_snapshot_recent(window_minutes integer default 20)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_window_minutes integer := greatest(coalesce(window_minutes, 20), 1);
  target_codes text[];
begin
  with max_rt_date as (
    select max(date) as max_date
    from public.realtime_quote_cache
  ),
  recent_codes as (
    select distinct coalesce(sb_exact.ts_code, sb_symbol.ts_code, rt.ts_code) as canonical_ts_code
    from public.realtime_quote_cache rt
    cross join max_rt_date rt_date
    left join public.stock_basic sb_exact on sb_exact.ts_code = rt.ts_code
    left join public.stock_basic sb_symbol on sb_symbol.symbol = rt.ts_code
    where rt_date.max_date is not null
      and rt.date = rt_date.max_date
      and coalesce(rt.fetch_time, now() - interval '365 days') >= now() - make_interval(mins => safe_window_minutes)
  )
  select array_agg(canonical_ts_code)
  into target_codes
  from recent_codes;

  if target_codes is null or array_length(target_codes, 1) is null then
    return 0;
  end if;

  return public.refresh_quote_latest_snapshot(target_codes);
end;
$$;

create or replace function public.refresh_quote_latest_snapshot_job()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  shanghai_now timestamp := timezone('Asia/Shanghai', now());
  shanghai_time time := shanghai_now::time;
  shanghai_isodow integer := extract(isodow from shanghai_now);
begin
  if shanghai_isodow not between 1 and 5 then
    return 0;
  end if;

  if not (
    (shanghai_time between time '09:15:00' and time '11:35:00')
    or (shanghai_time between time '12:55:00' and time '15:10:00')
  ) then
    return 0;
  end if;

  return public.refresh_quote_latest_snapshot_recent(20);
end;
$$;

create or replace view public.v_quote_latest_snapshot_health as
select
  count(*)::bigint as row_count,
  max(quote_date) as max_quote_date,
  max(quote_time) as max_quote_time,
  max(fetch_time) as max_fetch_time,
  max(updated_at) as max_updated_at,
  case
    when count(*) = 0 then false
    when max(updated_at) is null then false
    else (now() - max(updated_at)) <= interval '5 minutes'
  end as is_fresh_5m,
  case
    when count(*) = 0 then false
    when max(fetch_time) is null then false
    else (now() - max(fetch_time)) <= interval '10 minutes'
  end as is_source_fresh_10m
from public.quote_latest_snapshot;

create or replace function public.get_quote_latest_snapshot_health()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'rowCount', row_count,
    'maxQuoteDate', max_quote_date,
    'maxQuoteTime', max_quote_time,
    'maxFetchTime', max_fetch_time,
    'maxUpdatedAt', max_updated_at,
    'isFresh5m', is_fresh_5m,
    'isSourceFresh10m', is_source_fresh_10m,
    'checkedAt', now()
  )
  from public.v_quote_latest_snapshot_health;
$$;

do $$
begin
  begin
    create extension if not exists pg_cron;
  exception
    when others then
      raise notice 'pg_cron extension unavailable, skip snapshot refresh schedule';
  end;

  if to_regnamespace('cron') is not null then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'refresh-quote-latest-snapshot-every-minute';

    perform cron.schedule(
      'refresh-quote-latest-snapshot-every-minute',
      '* * * * 1-5',
      'select public.refresh_quote_latest_snapshot_job();'
    );
  end if;
end;
$$;

grant select on public.v_quote_latest_snapshot_health to anon, authenticated, service_role;
grant execute on function public.refresh_quote_latest_snapshot_recent(integer) to service_role;
grant execute on function public.refresh_quote_latest_snapshot_job() to service_role;
grant execute on function public.get_quote_latest_snapshot_health() to anon, authenticated, service_role;