create table if not exists public.watchlist_groups (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name varchar(50) not null,
  sort_order integer not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint watchlist_groups_name_check check (char_length(trim(name)) between 1 and 50),
  constraint watchlist_groups_user_name_key unique (user_id, name)
);

create unique index if not exists watchlist_groups_user_default_idx
  on public.watchlist_groups(user_id)
  where is_default = true;

create index if not exists watchlist_groups_user_sort_idx
  on public.watchlist_groups(user_id, sort_order asc, created_at asc);

create table if not exists public.watchlist_items (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id bigint not null references public.watchlist_groups(id) on delete restrict,
  ts_code varchar(20) not null,
  stock_name varchar(100),
  market varchar(20),
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint watchlist_items_code_check check (char_length(trim(ts_code)) > 0),
  constraint watchlist_items_user_stock_key unique (user_id, ts_code)
);

create index if not exists watchlist_items_user_group_idx
  on public.watchlist_items(user_id, group_id, sort_order asc, created_at desc);

create index if not exists watchlist_items_user_updated_idx
  on public.watchlist_items(user_id, updated_at desc);

create or replace function public.set_watchlist_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_watchlist_groups_updated_at on public.watchlist_groups;
create trigger trg_watchlist_groups_updated_at
before update on public.watchlist_groups
for each row
execute function public.set_watchlist_updated_at();

drop trigger if exists trg_watchlist_items_updated_at on public.watchlist_items;
create trigger trg_watchlist_items_updated_at
before update on public.watchlist_items
for each row
execute function public.set_watchlist_updated_at();

alter table public.watchlist_groups enable row level security;
alter table public.watchlist_items enable row level security;

drop policy if exists watchlist_groups_self_select on public.watchlist_groups;
create policy watchlist_groups_self_select
on public.watchlist_groups
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists watchlist_groups_self_insert on public.watchlist_groups;
create policy watchlist_groups_self_insert
on public.watchlist_groups
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists watchlist_groups_self_update on public.watchlist_groups;
create policy watchlist_groups_self_update
on public.watchlist_groups
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists watchlist_groups_self_delete on public.watchlist_groups;
create policy watchlist_groups_self_delete
on public.watchlist_groups
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists watchlist_items_self_select on public.watchlist_items;
create policy watchlist_items_self_select
on public.watchlist_items
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists watchlist_items_self_insert on public.watchlist_items;
create policy watchlist_items_self_insert
on public.watchlist_items
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.watchlist_groups groups
    where groups.id = group_id
      and groups.user_id = auth.uid()
  )
);

drop policy if exists watchlist_items_self_update on public.watchlist_items;
create policy watchlist_items_self_update
on public.watchlist_items
for update
to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.watchlist_groups groups
    where groups.id = group_id
      and groups.user_id = auth.uid()
  )
);

drop policy if exists watchlist_items_self_delete on public.watchlist_items;
create policy watchlist_items_self_delete
on public.watchlist_items
for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.ensure_default_watchlist_group()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  default_group_id bigint;
  next_sort_order integer;
begin
  if current_user_id is null then
    raise exception 'not authenticated';
  end if;

  select id
    into default_group_id
  from public.watchlist_groups
  where user_id = current_user_id and is_default = true
  limit 1;

  if default_group_id is not null then
    return default_group_id;
  end if;

  select coalesce(max(sort_order), -1) + 1
    into next_sort_order
  from public.watchlist_groups
  where user_id = current_user_id;

  insert into public.watchlist_groups (user_id, name, sort_order, is_default)
  values (current_user_id, '默认', next_sort_order, true)
  returning id into default_group_id;

  return default_group_id;
end;
$$;

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
          coalesce(items.stock_name, basics.name, items.ts_code) as stock_name,
          coalesce(items.market, basics.market) as market,
          items.note,
          items.sort_order,
          items.created_at,
          items.updated_at,
          daily.trade_date as latest_trade_date,
          daily.close as latest_price,
          daily.pct_chg as latest_pct_chg,
          daily_basic.turnover_rate,
          daily_basic.total_mv
        from public.watchlist_items items
        inner join public.watchlist_groups groups on groups.id = items.group_id
        left join public.stock_basic basics on basics.ts_code = items.ts_code
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

grant select, insert, update, delete on public.watchlist_groups to authenticated;
grant select, insert, update, delete on public.watchlist_items to authenticated;
grant usage, select on sequence public.watchlist_groups_id_seq to authenticated;
grant usage, select on sequence public.watchlist_items_id_seq to authenticated;
grant execute on function public.ensure_default_watchlist_group() to authenticated;
grant execute on function public.get_watchlist_overview() to authenticated;