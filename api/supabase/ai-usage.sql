-- [INPUT]: 依赖 public.profiles、auth.uid()、authenticated 角色、统一 set_current_timestamp_updated_at trigger 与 folune.ai_usage_mutation 会话 GUC
-- [OUTPUT]: 建立每用户每日 token 用量计数表、owner-only 读 RLS、仅经受控 RPC 的累加写入口，以及原子累加 increment_ai_usage_daily RPC
-- [POS]: api/supabase 的 AI 用量配额契约；计数只增不减、写路径经 GUC 收口使用户无法自行清零绕过限流，读用于服务端按 UTC 日额度门禁
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

create table public.ai_usage_daily (
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null default (now() at time zone 'utc')::date,
  total_tokens bigint not null default 0
    constraint ai_usage_daily_total_tokens_check check (total_tokens >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_usage_daily_pkey primary key (user_id, usage_date)
);

create trigger set_ai_usage_daily_updated_at
before update on public.ai_usage_daily
for each row execute function public.set_current_timestamp_updated_at();

alter table public.ai_usage_daily enable row level security;

-- 用户可读自己的用量（前端展示"今日已用/剩余"）；写入一律不走此角色的直接 DML。
create policy "Users can select own AI usage"
on public.ai_usage_daily
for select
to authenticated
using ((select auth.uid()) = user_id);

-- 写口经 GUC 收口：只有受控 RPC 打开 folune.ai_usage_mutation 才能落账，
-- 使用户无法通过直接 PostgREST 写把自己的用量清零绕过限流。
create policy "AI usage RPC can insert owned usage"
on public.ai_usage_daily
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and current_setting('folune.ai_usage_mutation', true) = 'on'
);

create policy "AI usage RPC can update owned usage"
on public.ai_usage_daily
for update
to authenticated
using (
  (select auth.uid()) = user_id
  and current_setting('folune.ai_usage_mutation', true) = 'on'
)
with check (
  (select auth.uid()) = user_id
  and current_setting('folune.ai_usage_mutation', true) = 'on'
);

revoke all on table public.ai_usage_daily from anon, authenticated;
grant select, insert, update on table public.ai_usage_daily to authenticated;

-- 原子累加：只增不减，经 GUC 打开受控写窗口后按 (user_id, UTC 当日) upsert；
-- 日期在服务端由 now() 派生而非入参，用户无法改历史日期。返回该用户当日累计值。
-- SECURITY INVOKER 保持调用者身份，RLS 仍校验 auth.uid() = p_user_id。
create or replace function public.increment_ai_usage_daily(
  p_user_id uuid,
  p_tokens bigint
)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_total bigint;
  v_date date := (now() at time zone 'utc')::date;
begin
  if (select auth.uid()) is distinct from p_user_id then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_tokens is null or p_tokens < 0 then
    raise exception 'invalid_tokens' using errcode = '22023';
  end if;

  perform set_config('folune.ai_usage_mutation', 'on', true);

  insert into public.ai_usage_daily as u (user_id, usage_date, total_tokens)
  values (p_user_id, v_date, p_tokens)
  on conflict (user_id, usage_date)
  do update set total_tokens = u.total_tokens + excluded.total_tokens
  returning u.total_tokens into v_total;

  return v_total;
end;
$$;

revoke all on function public.increment_ai_usage_daily(uuid, bigint) from anon, public;
grant execute on function public.increment_ai_usage_daily(uuid, bigint) to authenticated;
