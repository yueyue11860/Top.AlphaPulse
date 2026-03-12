create table if not exists public.quote_latest_snapshot (
  ts_code varchar(20) primary key,
  symbol varchar(20) not null,
  name varchar(100) not null,
  industry varchar(100) not null default '',
  market varchar(50) not null default '',
  quote_date varchar(8) not null,
  quote_time varchar(8) not null,
  fetch_time timestamptz,
  price numeric(18, 3) not null default 0,
  change_pct numeric(12, 4) not null default 0,
  change_amount numeric(18, 4) not null default 0,
  open numeric(18, 3) not null default 0,
  high numeric(18, 3) not null default 0,
  low numeric(18, 3) not null default 0,
  pre_close numeric(18, 3) not null default 0,
  volume numeric(20, 2) not null default 0,
  amount numeric(20, 2) not null default 0,
  turnover_rate numeric(12, 4) not null default 0,
  pe_ttm numeric(18, 4) not null default 0,
  pb numeric(18, 4) not null default 0,
  total_mv numeric(20, 2) not null default 0,
  source varchar(20) not null default 'realtime',
  updated_at timestamptz not null default now()
);

create index if not exists idx_quote_latest_snapshot_quote_time
  on public.quote_latest_snapshot (quote_date desc, quote_time desc);

create index if not exists idx_quote_latest_snapshot_amount
  on public.quote_latest_snapshot (amount desc, ts_code asc);

create index if not exists idx_quote_latest_snapshot_pct_chg
  on public.quote_latest_snapshot (change_pct desc, ts_code asc);

create index if not exists idx_quote_latest_snapshot_turnover_rate
  on public.quote_latest_snapshot (turnover_rate desc, ts_code asc);

create index if not exists idx_quote_latest_snapshot_total_mv
  on public.quote_latest_snapshot (total_mv desc, ts_code asc);

create index if not exists idx_quote_latest_snapshot_symbol
  on public.quote_latest_snapshot (symbol);

create or replace function public.refresh_quote_latest_snapshot(target_codes text[] default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_count integer := 0;
begin
  with normalized_targets as (
    select distinct code
    from (
      select unnest(target_codes) as code
      union all
      select split_part(code, '.', 1)
      from unnest(target_codes) as code
    ) target_codes_expanded
    where code is not null and btrim(code) <> ''
  ),
  max_rt_date as (
    select max(date) as max_date
    from public.realtime_quote_cache
  ),
  normalized_realtime as (
    select
      coalesce(sb_exact.ts_code, sb_symbol.ts_code, rt.ts_code) as canonical_ts_code,
      coalesce(sb_exact.symbol, sb_symbol.symbol, split_part(coalesce(sb_exact.ts_code, sb_symbol.ts_code, rt.ts_code), '.', 1)) as canonical_symbol,
      coalesce(rt.name, sb_exact.name, sb_symbol.name, ns.name, coalesce(sb_exact.ts_code, sb_symbol.ts_code, rt.ts_code)) as canonical_name,
      coalesce(
        sb_exact.industry,
        sb_symbol.industry,
        case when ns.name is not null then '新股' else '' end,
        ''
      ) as canonical_industry,
      coalesce(
        sb_exact.market,
        sb_symbol.market,
        case
          when coalesce(sb_exact.ts_code, sb_symbol.ts_code, rt.ts_code) like '%.SZ' then '深市'
          when coalesce(sb_exact.ts_code, sb_symbol.ts_code, rt.ts_code) like '%.SH' then '沪市'
          when coalesce(sb_exact.ts_code, sb_symbol.ts_code, rt.ts_code) like '%.BJ' then '北交所'
          else ''
        end
      ) as canonical_market,
      rt.date,
      rt.time,
      rt.fetch_time,
      rt.price,
      rt.change_pct,
      rt.change_amount,
      rt.open,
      rt.high,
      rt.low,
      rt.pre_close,
      coalesce(rt.volume, 0) / 100.0 as volume,
      coalesce(rt.amount, 0) / 1000.0 as amount
    from public.realtime_quote_cache rt
    cross join max_rt_date rt_date
    left join public.stock_basic sb_exact on sb_exact.ts_code = rt.ts_code
    left join public.stock_basic sb_symbol on sb_symbol.symbol = rt.ts_code
    left join public.new_share ns on ns.ts_code = coalesce(sb_exact.ts_code, sb_symbol.ts_code, rt.ts_code)
    where rt_date.max_date is not null
      and rt.date = rt_date.max_date
      and (
        target_codes is null
        or rt.ts_code in (select code from normalized_targets)
      )
  ),
  latest_realtime as (
    select distinct on (canonical_ts_code)
      canonical_ts_code as ts_code,
      canonical_symbol as symbol,
      canonical_name as name,
      canonical_industry as industry,
      canonical_market as market,
      date as quote_date,
      time as quote_time,
      fetch_time,
      coalesce(price, 0) as price,
      coalesce(change_pct, 0) as change_pct,
      coalesce(change_amount, 0) as change_amount,
      coalesce(open, 0) as open,
      coalesce(high, 0) as high,
      coalesce(low, 0) as low,
      coalesce(pre_close, 0) as pre_close,
      coalesce(volume, 0) as volume,
      coalesce(amount, 0) as amount
    from normalized_realtime
    order by canonical_ts_code, date desc, time desc
  ),
  enriched as (
    select
      latest.ts_code,
      latest.symbol,
      latest.name,
      latest.industry,
      latest.market,
      latest.quote_date,
      latest.quote_time,
      latest.fetch_time,
      latest.price,
      latest.change_pct,
      latest.change_amount,
      latest.open,
      latest.high,
      latest.low,
      latest.pre_close,
      latest.volume,
      latest.amount,
      coalesce(daily_basic.turnover_rate, 0) as turnover_rate,
      coalesce(daily_basic.pe_ttm, 0) as pe_ttm,
      coalesce(daily_basic.pb, 0) as pb,
      coalesce(daily_basic.total_mv, 0) as total_mv,
      'realtime'::varchar(20) as source,
      now() as updated_at
    from latest_realtime latest
    left join lateral (
      select turnover_rate, pe_ttm, pb, total_mv
      from public.daily_basic
      where ts_code = latest.ts_code
      order by trade_date desc
      limit 1
    ) daily_basic on true
  ),
  upserted as (
    insert into public.quote_latest_snapshot (
      ts_code,
      symbol,
      name,
      industry,
      market,
      quote_date,
      quote_time,
      fetch_time,
      price,
      change_pct,
      change_amount,
      open,
      high,
      low,
      pre_close,
      volume,
      amount,
      turnover_rate,
      pe_ttm,
      pb,
      total_mv,
      source,
      updated_at
    )
    select
      ts_code,
      symbol,
      name,
      industry,
      market,
      quote_date,
      quote_time,
      fetch_time,
      price,
      change_pct,
      change_amount,
      open,
      high,
      low,
      pre_close,
      volume,
      amount,
      turnover_rate,
      pe_ttm,
      pb,
      total_mv,
      source,
      updated_at
    from enriched
    on conflict (ts_code) do update
    set symbol = excluded.symbol,
        name = excluded.name,
        industry = excluded.industry,
        market = excluded.market,
        quote_date = excluded.quote_date,
        quote_time = excluded.quote_time,
        fetch_time = excluded.fetch_time,
        price = excluded.price,
        change_pct = excluded.change_pct,
        change_amount = excluded.change_amount,
        open = excluded.open,
        high = excluded.high,
        low = excluded.low,
        pre_close = excluded.pre_close,
        volume = excluded.volume,
        amount = excluded.amount,
        turnover_rate = excluded.turnover_rate,
        pe_ttm = excluded.pe_ttm,
        pb = excluded.pb,
        total_mv = excluded.total_mv,
        source = excluded.source,
        updated_at = excluded.updated_at
    returning 1
  )
  select count(*)::integer into affected_count
  from upserted;

  return affected_count;
end;
$$;

create or replace function public.get_stock_list_snapshot(
  keyword_text text default null,
  limit_count integer default 50,
  offset_count integer default 0,
  sort_by text default 'amount',
  sort_order text default 'desc'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_keyword text := nullif(trim(keyword_text), '');
  keyword_pattern text := null;
  safe_limit integer := greatest(coalesce(limit_count, 50), 1);
  safe_offset integer := greatest(coalesce(offset_count, 0), 0);
  sort_column text;
  sort_direction text;
  result jsonb;
begin
  if normalized_keyword is not null then
    keyword_pattern := '%' || normalized_keyword || '%';
  end if;

  sort_column := case sort_by
    when 'pct_chg' then 'change_pct'
    when 'turnover_rate' then 'turnover_rate'
    when 'total_mv' then 'total_mv'
    else 'amount'
  end;

  sort_direction := case lower(sort_order)
    when 'asc' then 'asc'
    else 'desc'
  end;

  execute format(
    $query$
      with filtered as (
        select *
        from public.quote_latest_snapshot
        where (
          $1 is null
          or name ilike $1
          or ts_code ilike $1
          or symbol ilike $1
          or industry ilike $1
        )
      ),
      counted as (
        select count(*)::integer as total
        from filtered
      ),
      paged as (
        select *
        from filtered
        order by %I %s nulls last, ts_code asc
        limit $2 offset $3
      )
      select jsonb_build_object(
        'data', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'ts_code', paged.ts_code,
              'symbol', paged.symbol,
              'name', paged.name,
              'industry', paged.industry,
              'close', paged.price,
              'change', paged.change_amount,
              'pct_chg', paged.change_pct,
              'vol', paged.volume,
              'amount', paged.amount,
              'open', paged.open,
              'high', paged.high,
              'low', paged.low,
              'pre_close', paged.pre_close,
              'turnover_rate', paged.turnover_rate,
              'pe_ttm', paged.pe_ttm,
              'pb', paged.pb,
              'total_mv', paged.total_mv,
              'trade_date', paged.quote_date,
              'quote_time', paged.quote_time,
              'fetch_time', paged.fetch_time,
              'source', paged.source
            )
            order by %I %s nulls last, paged.ts_code asc
          )
          from paged
        ), '[]'::jsonb),
        'total', coalesce((select total from counted), 0)
      )
    $query$,
    sort_column,
    sort_direction,
    sort_column,
    sort_direction
  )
  into result
  using keyword_pattern, safe_limit, safe_offset;

  return coalesce(result, jsonb_build_object('data', '[]'::jsonb, 'total', 0));
end;
$$;

create or replace function public.get_stock_quote_snapshot(target_code text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'ts_code', snapshot.ts_code,
        'symbol', snapshot.symbol,
        'name', snapshot.name,
        'industry', snapshot.industry,
        'market', snapshot.market,
        'quote_date', snapshot.quote_date,
        'quote_time', snapshot.quote_time,
        'fetch_time', snapshot.fetch_time,
        'price', snapshot.price,
        'change_pct', snapshot.change_pct,
        'change_amount', snapshot.change_amount,
        'open', snapshot.open,
        'high', snapshot.high,
        'low', snapshot.low,
        'pre_close', snapshot.pre_close,
        'volume', snapshot.volume,
        'amount', snapshot.amount,
        'turnover_rate', snapshot.turnover_rate,
        'pe_ttm', snapshot.pe_ttm,
        'pb', snapshot.pb,
        'total_mv', snapshot.total_mv,
        'source', snapshot.source
      )
      from public.quote_latest_snapshot snapshot
      where snapshot.ts_code = target_code
         or snapshot.symbol = split_part(target_code, '.', 1)
      order by snapshot.updated_at desc
      limit 1
    ),
    '{}'::jsonb
  );
$$;

grant select on public.quote_latest_snapshot to anon;
grant select on public.quote_latest_snapshot to authenticated;
grant execute on function public.get_stock_list_snapshot(text, integer, integer, text, text) to anon;
grant execute on function public.get_stock_list_snapshot(text, integer, integer, text, text) to authenticated;
grant execute on function public.get_stock_quote_snapshot(text) to anon;
grant execute on function public.get_stock_quote_snapshot(text) to authenticated;
grant execute on function public.refresh_quote_latest_snapshot(text[]) to service_role;