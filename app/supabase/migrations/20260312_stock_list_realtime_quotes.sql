create or replace function public.get_stock_list_with_realtime_quotes(
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
    when 'pct_chg' then 'effective_pct_chg'
    when 'turnover_rate' then 'turnover_rate'
    when 'total_mv' then 'total_mv'
    else 'effective_amount'
  end;

  sort_direction := case lower(sort_order)
    when 'asc' then 'asc'
    else 'desc'
  end;

  execute format(
    $query$
      with latest_daily_date as (
        select trade_date
        from public.daily
        order by trade_date desc
        limit 1
      ),
      latest_daily_basic_date as (
        select trade_date
        from public.daily_basic
        order by trade_date desc
        limit 1
      ),
      base as (
        select
          daily.ts_code,
          coalesce(basics.symbol, split_part(daily.ts_code, '.', 1)) as symbol,
          coalesce(basics.name, new_share.name, daily.ts_code) as name,
          coalesce(basics.industry, case when new_share.name is not null then '新股' else '' end) as industry,
          daily.trade_date,
          coalesce(daily.open, 0) as open,
          coalesce(daily.high, 0) as high,
          coalesce(daily.low, 0) as low,
          coalesce(daily.close, 0) as close,
          coalesce(daily.pre_close, 0) as pre_close,
          coalesce(daily.change, 0) as change,
          coalesce(daily.pct_chg, 0) as pct_chg,
          coalesce(daily.vol, 0) as vol,
          coalesce(daily.amount, 0) as amount,
          coalesce(daily_basic.turnover_rate, 0) as turnover_rate,
          coalesce(daily_basic.pe_ttm, 0) as pe_ttm,
          coalesce(daily_basic.pb, 0) as pb,
          coalesce(daily_basic.total_mv, 0) as total_mv
        from public.daily daily
        inner join latest_daily_date latest_daily on latest_daily.trade_date = daily.trade_date
        left join latest_daily_basic_date latest_basic on true
        left join public.daily_basic daily_basic
          on daily_basic.ts_code = daily.ts_code
         and daily_basic.trade_date = latest_basic.trade_date
        left join public.stock_basic basics on basics.ts_code = daily.ts_code
        left join public.new_share new_share on new_share.ts_code = daily.ts_code
        where (
          $1 is null
          or coalesce(basics.name, new_share.name, daily.ts_code) ilike $1
          or daily.ts_code ilike $1
          or split_part(daily.ts_code, '.', 1) ilike $1
          or coalesce(basics.symbol, split_part(daily.ts_code, '.', 1)) ilike $1
        )
      ),
      enriched as (
        select
          base.ts_code,
          base.symbol,
          base.name,
          base.industry,
          case
            when realtime.quote_date is not null and realtime.quote_date >= base.trade_date then realtime.quote_date
            else base.trade_date
          end as effective_trade_date,
          case
            when realtime.quote_date is not null and realtime.quote_date >= base.trade_date then coalesce(realtime.price, base.close)
            else base.close
          end as effective_close,
          case
            when realtime.quote_date is not null and realtime.quote_date >= base.trade_date then coalesce(realtime.open, base.open)
            else base.open
          end as effective_open,
          case
            when realtime.quote_date is not null and realtime.quote_date >= base.trade_date then coalesce(realtime.high, base.high)
            else base.high
          end as effective_high,
          case
            when realtime.quote_date is not null and realtime.quote_date >= base.trade_date then coalesce(realtime.low, base.low)
            else base.low
          end as effective_low,
          coalesce(nullif(realtime.pre_close, 0), base.pre_close) as effective_pre_close,
          case
            when realtime.quote_date is not null and realtime.quote_date >= base.trade_date then coalesce(
              realtime.change_amount,
              case
                when coalesce(nullif(realtime.pre_close, 0), nullif(base.pre_close, 0)) is not null and realtime.price is not null
                  then realtime.price - coalesce(nullif(realtime.pre_close, 0), base.pre_close)
                else base.change
              end
            )
            else base.change
          end as effective_change,
          case
            when realtime.quote_date is not null and realtime.quote_date >= base.trade_date then coalesce(
              realtime.change_pct,
              case
                when coalesce(nullif(realtime.pre_close, 0), nullif(base.pre_close, 0)) is not null and realtime.price is not null
                  then ((realtime.price - coalesce(nullif(realtime.pre_close, 0), base.pre_close))
                    / coalesce(nullif(realtime.pre_close, 0), base.pre_close)) * 100
                else base.pct_chg
              end
            )
            else base.pct_chg
          end as effective_pct_chg,
          case
            when realtime.quote_date is not null and realtime.quote_date >= base.trade_date then coalesce(realtime.volume, base.vol)
            else base.vol
          end as effective_vol,
          case
            when realtime.quote_date is not null and realtime.quote_date >= base.trade_date then coalesce(realtime.amount / 1000.0, base.amount)
            else base.amount
          end as effective_amount,
          base.turnover_rate,
          base.pe_ttm,
          base.pb,
          base.total_mv
        from base
        left join lateral (
          select
            quote.date as quote_date,
            quote.time,
            quote.open,
            quote.high,
            quote.low,
            quote.price,
            quote.pre_close,
            quote.change_pct,
            quote.change_amount,
            quote.volume,
            quote.amount
          from public.realtime_quote_cache quote
          where quote.ts_code in (base.ts_code, split_part(base.ts_code, '.', 1))
          order by quote.date desc, quote.time desc
          limit 1
        ) realtime on true
      ),
      counted as (
        select count(*)::integer as total
        from enriched
      ),
      paged as (
        select *
        from enriched
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
              'close', paged.effective_close,
              'change', paged.effective_change,
              'pct_chg', paged.effective_pct_chg,
              'vol', paged.effective_vol,
              'amount', paged.effective_amount,
              'open', paged.effective_open,
              'high', paged.effective_high,
              'low', paged.effective_low,
              'pre_close', paged.effective_pre_close,
              'turnover_rate', paged.turnover_rate,
              'pe_ttm', paged.pe_ttm,
              'pb', paged.pb,
              'total_mv', paged.total_mv,
              'trade_date', paged.effective_trade_date
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

grant execute on function public.get_stock_list_with_realtime_quotes(text, integer, integer, text, text) to anon;
grant execute on function public.get_stock_list_with_realtime_quotes(text, integer, integer, text, text) to authenticated;