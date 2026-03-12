create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username varchar(50) not null,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_username_check check (char_length(trim(username)) between 2 and 50),
  constraint user_profiles_email_check check (char_length(trim(email)) > 3)
);

create unique index if not exists user_profiles_username_lower_key
  on public.user_profiles (lower(username));

create unique index if not exists user_profiles_email_lower_key
  on public.user_profiles (lower(email));

create or replace function public.set_user_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_user_profiles_updated_at();

alter table public.user_profiles enable row level security;

drop policy if exists user_profiles_self_select on public.user_profiles;
create policy user_profiles_self_select
on public.user_profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists user_profiles_self_update on public.user_profiles;
create policy user_profiles_self_update
on public.user_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.sync_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  resolved_username text;
begin
  resolved_username := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'display_name',
    split_part(new.email, '@', 1)
  )), '');

  if resolved_username is null then
    raise exception 'username is required';
  end if;

  insert into public.user_profiles (user_id, username, email, created_at, updated_at)
  values (
    new.id,
    resolved_username,
    new.email,
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (user_id) do update
  set username = excluded.username,
      email = excluded.email,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_profile_synced on auth.users;
create trigger on_auth_user_profile_synced
after insert or update of email, raw_user_meta_data
on auth.users
for each row
execute function public.sync_auth_user_profile();

insert into public.user_profiles (user_id, username, email, created_at, updated_at)
select
  users.id,
  nullif(trim(coalesce(
    users.raw_user_meta_data ->> 'username',
    users.raw_user_meta_data ->> 'display_name',
    split_part(users.email, '@', 1)
  )), '') as username,
  users.email,
  coalesce(users.created_at, now()) as created_at,
  now() as updated_at
from auth.users users
where users.email is not null
  and nullif(trim(coalesce(
    users.raw_user_meta_data ->> 'username',
    users.raw_user_meta_data ->> 'display_name',
    split_part(users.email, '@', 1)
  )), '') is not null
on conflict (user_id) do update
set username = excluded.username,
    email = excluded.email,
    updated_at = now();
