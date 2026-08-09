-- [INPUT]: 依赖 Supabase auth.users、auth.uid()、authenticated/service_role 数据库角色
-- [OUTPUT]: 建立只含身份、单一用户名、头像与简介五列的 public.profiles 表，以及 owner-only RLS policies 与显式 Data API grants
-- [POS]: api/supabase 的精简 profile 契约；username 是可修改、非唯一的展示名称，真实身份与 owner 边界始终由 auth.users UUID 决定
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  username text not null,
  avatar_url text,
  bio text
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

revoke all privileges on table public.profiles
from anon, authenticated, service_role;

grant usage on schema public
to authenticated, service_role;

grant select, insert, update on public.profiles
to authenticated;

grant select, insert, update, delete on public.profiles
to service_role;
