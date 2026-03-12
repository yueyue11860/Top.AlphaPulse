create or replace function public.get_watchlist_overview()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  overview jsonb;
begin
  if current_user_id is null then
    return jsonb_build_object(
      'groups', '[]'::jsonb,
      'items', '[]'::jsonb,
      'defaultGroupId', null,
      'updatedAt', now()
    );
  end if;

  perform public.ensure_default_watchlist_group();

  select jsonb_build_object(
    'defaultGroupId', (
      select id
      from public.watchlist_groups
      where user_id = current_user_id and is_default = true
      limit 1
    ),
    'groups', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', group_rows.id,
          'name', group_rows.name,
          'isDefault', group_rows.is_default,
          'sortOrder', group_rows.sort_order,
          'itemCount', group_rows.item_count,
          'createdAt', group_rows.created_at
        )
        order by group_rows.sort_order asc, group_rows.created_at asc
      )
      from (
        select
          groups.id,
          groups.name,
          groups.is_default,
          groups.sort_order,
          groups.created_at,
          count(items.id)::integer as item_count
        from public.watchlist_groups groups
        left join public.watchlist_items items on items.group_id = groups.id
        where groups.user_id = current_user_id
        group by groups.id, groups.name, groups.is_default, groups.sort_order, groups.created_at
      ) as group_rows
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', item_rows.id,
          'groupId', item_rows.group_id,
          'groupName', item_rows.group_name,
          'tsCode', item_rows.ts_code,
          'stockName', item_rows.stock_name,
          'market', item_rows.market,
          'note', item_rows.note,
          'sortOrder', item_rows.sort_order,
          'createdAt', item_rows.created_at,
          'updatedAt', item_rows.updated_at,
          'latestTradeDate', item_rows.latest_trade_date,
          'latestPrice', item_rows.latest_price,
          'latestPctChg', item_rows.latest_pct_chg,
          'turnoverRate', item_rows.turnover_rate,
          'totalMv', item_rows.total_mv
        )
        order by item_rows.group_sort_order asc, item_rows.sort_order asc, item_rows.created_at desc
      )
      from (
        select
          items.id,
          items.group_id,
          groups.name as group_name,
          groups.sort_order as group_sort_order,
          items.ts_code,
          coalesce(items.stock_name, snapshot.name, basics.name, items.ts_code) as stock_name,
          coalesce(items.market, snapshot.market, basics.market) as market,
          items.note,
          items.sort_order,
          items.created_at,
          items.updated_at,
          coalesce(snapshot.quote_date, daily.trade_date) as latest_trade_date,
          coalesce(snapshot.price, daily.close, 0) as latest_price,
          coalesce(snapshot.change_pct, daily.pct_chg, 0) as latest_pct_chg,
          coalesce(snapshot.turnover_rate, daily_basic.turnover_rate, 0) as turnover_rate,
          coalesce(snapshot.total_mv, daily_basic.total_mv, 0) as total_mv
        from public.watchlist_items items
        inner join public.watchlist_groups groups on groups.id = items.group_id
        left join public.stock_basic basics on basics.ts_code = items.ts_code
        left join lateral (
          select
            ts_code,
            name,
            market,
            quote_date,
            price,
            change_pct,
            turnover_rate,
            total_mv
          from public.quote_latest_snapshot
          where ts_code = items.ts_code
             or symbol = split_part(items.ts_code, '.', 1)
          order by updated_at desc
          limit 1
        ) snapshot on true
        left join lateral (
          select trade_date, close, pct_chg
          from public.daily
          where ts_code = items.ts_code
          order by trade_date desc
          limit 1
        ) daily on true
        left join lateral (
          select turnover_rate, total_mv
          from public.daily_basic
          where ts_code = items.ts_code
          order by trade_date desc
          limit 1
        ) daily_basic on true
        where items.user_id = current_user_id
      ) as item_rows
    ), '[]'::jsonb),
    'updatedAt', now()
  ) into overview;

  return overview;
end;
$$;

grant execute on function public.get_watchlist_overview() to authenticated;