-- [INPUT]: 依赖 public.profiles、auth.uid()、authenticated 角色与统一 updated_at trigger
-- [OUTPUT]: 建立 owner-only 只读 billing_subscriptions 付款事实表；普通用户仅能读公开订阅列，不能直接创建或修改权益
-- [POS]: api/supabase 的最小订阅持久化契约；没有付款验证写入者时保持空表，未来支付接入须经服务端验签/幂等/对账再扩展可信写入口
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

create table public.billing_subscriptions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  plan_id text not null check (plan_id in ('starter', 'pro', 'studio')),
  status text not null check (status in ('active', 'past_due', 'canceled', 'expired')),
  billing_interval text not null check (billing_interval in ('monthly', 'yearly')),
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  provider text not null check (length(trim(provider)) > 0),
  provider_subscription_id text not null check (length(trim(provider_subscription_id)) > 0),
  last_verified_event_id text not null check (length(trim(last_verified_event_id)) > 0),
  verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_subscription_period_check check (current_period_end > current_period_start),
  constraint billing_subscription_provider_unique unique (provider, provider_subscription_id)
);

create trigger set_billing_subscriptions_updated_at
before update on public.billing_subscriptions
for each row execute function public.set_current_timestamp_updated_at();

alter table public.billing_subscriptions enable row level security;

create policy "Users can select own subscription"
on public.billing_subscriptions
for select to authenticated
using ((select auth.uid()) = user_id);

-- 列级 SELECT 同时隐藏平台客户/订阅标识；不向任何运行时角色开放付款事实写口。
revoke all on table public.billing_subscriptions from public, anon, authenticated, service_role;
grant select (
  user_id, plan_id, status, billing_interval,
  current_period_start, current_period_end, cancel_at_period_end
) on public.billing_subscriptions to authenticated;
