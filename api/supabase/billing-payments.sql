-- [INPUT]: 依赖 profiles、billing_subscriptions、ai_usage_daily 与 PostgREST authenticator
-- [OUTPUT]: 建立隔离环境订单、支付审计、不可重复发放/扣减账本、订阅周期及受限服务 RPC
-- [POS]: 支付持久化内核；folune_billing 无 BYPASSRLS，仅服务端可写，用户只读本人公开事实
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

begin;
do $$ begin
  if not exists(select 1 from pg_roles where rolname='folune_billing') then
    create role folune_billing nologin noinherit;
  end if;
end $$;
grant folune_billing to authenticator;
grant usage on schema public to folune_billing;

-- 环境绑定必须由部署者填入；不允许切换 ENV 后把测试余额带入生产。
create table public.billing_environment (
  singleton boolean primary key default true check(singleton),
  environment text not null check(environment in ('sandbox','production'))
);
alter table public.billing_environment enable row level security;
revoke all on public.billing_environment from public,anon,authenticated,service_role;
grant select on public.billing_environment to folune_billing;
create policy billing_environment_read on public.billing_environment for select to folune_billing using(true);

create table public.billing_wallets (
  user_id uuid primary key references public.profiles(id),
  balance_tokens bigint not null default 0 check(balance_tokens between -9007199254740991 and 9007199254740991),
  updated_at timestamptz not null default now()
);
create table public.billing_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  environment text not null check(environment in ('sandbox','production')),
  idempotency_key uuid not null,
  kind text not null check(kind in ('subscription','credits')),
  sku text not null,
  billing_interval text check(billing_interval in ('monthly','yearly')),
  amount_cents bigint not null check(amount_cents > 0 and amount_cents <= 10000000),
  credit_tokens bigint not null default 0 check(credit_tokens >= 0),
  status text not null default 'created' check(status in ('created','creating','pending','confirming','partially_paid','paid','failed','expired','refunded','review')),
  invoice_id text,
  checkout_url text,
  payment_id text,
  provider_updated_at timestamptz,
  fulfilled_at timestamptz,
  refunded_at timestamptz,
  error_code text,
  next_check_at timestamptz not null default now(),
  last_checked_at timestamptz,
  lease_until timestamptz,
  lease_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,environment,idempotency_key),
  unique(environment,invoice_id),
  unique(environment,payment_id),
  check((kind='credits' and billing_interval is null and credit_tokens>0) or
        (kind='subscription' and sku in ('starter','pro','studio') and billing_interval is not null and credit_tokens=0))
);
create index billing_orders_owner on public.billing_orders(user_id,created_at desc);
create index billing_orders_due on public.billing_orders(environment,next_check_at);
create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.billing_orders(id),
  environment text not null check(environment in ('sandbox','production')),
  source text not null check(source in ('ipn','poll','checkout','admin')),
  digest text not null,
  payment_id text,
  provider_status text,
  outcome text not null,
  received_at timestamptz not null default now(),
  unique(environment,source,digest)
);
create index billing_events_order on public.billing_events(order_id,received_at desc);
create table public.billing_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  order_id uuid references public.billing_orders(id),
  reference_id uuid not null,
  kind text not null check(kind in ('purchase','usage','refund')),
  tokens bigint not null,
  created_at timestamptz not null default now(),
  unique(user_id,kind,reference_id)
);
create index billing_credit_ledger_order on public.billing_credit_ledger(order_id);
create table public.billing_subscription_periods (
  order_id uuid primary key references public.billing_orders(id),
  user_id uuid not null references public.profiles(id),
  plan_id text not null check(plan_id in ('starter','pro','studio')),
  billing_interval text not null check(billing_interval in ('monthly','yearly')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  revoked_at timestamptz,
  check(ends_at>starts_at)
);
create index billing_periods_owner on public.billing_subscription_periods(user_id,starts_at,ends_at);
create table public.billing_usage_receipts (
  id uuid primary key,
  user_id uuid not null references public.profiles(id),
  tokens bigint not null check(tokens>0),
  usage_date date not null,
  created_at timestamptz not null default now()
);
create index billing_usage_receipts_owner on public.billing_usage_receipts(user_id);
-- 独立 free_tokens_used 避免购买积分的用量被第二次从当天赠送额度扣除。
alter table public.ai_usage_daily add column free_tokens_used bigint not null default 0 check(free_tokens_used>=0);
update public.ai_usage_daily set free_tokens_used=total_tokens;

-- 升级窗口内旧 API 仍可记账；同步免费用量，避免切换新账本时重复赠送。
create or replace function public.increment_ai_usage_daily(p_user_id uuid,p_tokens bigint)
returns bigint language plpgsql security invoker set search_path=public as $$
declare v_total bigint; begin
  if (select auth.uid()) is distinct from p_user_id then raise exception 'forbidden' using errcode='42501'; end if;
  if p_tokens is null or p_tokens<0 then raise exception 'invalid_tokens'; end if;
  perform set_config('folune.ai_usage_mutation','on',true);
  insert into public.ai_usage_daily as u(user_id,usage_date,total_tokens,free_tokens_used)
    values(p_user_id,(now() at time zone 'utc')::date,p_tokens,p_tokens)
    on conflict(user_id,usage_date) do update set total_tokens=u.total_tokens+excluded.total_tokens,
      free_tokens_used=u.free_tokens_used+excluded.free_tokens_used returning total_tokens into v_total;
  return v_total;
end $$;

-- 用户只读；服务角色的授权限于这几张表，不能访问笔记、Auth 或 Storage。
do $$ declare t text; begin
  foreach t in array array['billing_wallets','billing_orders','billing_events','billing_credit_ledger','billing_subscription_periods','billing_usage_receipts'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
    execute format('grant select,insert,update on public.%I to folune_billing',t);
    execute format('create policy billing_service on public.%I to folune_billing using (true) with check (true)',t);
  end loop;
end $$;
-- 账本与用量收据只能追加；订单审计只允许更新处理结果。
revoke update on public.billing_credit_ledger,public.billing_usage_receipts from folune_billing;
grant select on public.billing_wallets,public.billing_credit_ledger,public.billing_subscription_periods to authenticated;
create policy owner_read on public.billing_wallets for select to authenticated using((select auth.uid())=user_id);
create policy owner_read on public.billing_credit_ledger for select to authenticated using((select auth.uid())=user_id);
create policy owner_read on public.billing_subscription_periods for select to authenticated using((select auth.uid())=user_id);
grant select(id,user_id,kind,sku,billing_interval,amount_cents,status,checkout_url,created_at,updated_at,fulfilled_at) on public.billing_orders to authenticated;
create policy owner_read on public.billing_orders for select to authenticated using((select auth.uid())=user_id);
grant select on public.billing_subscriptions to folune_billing;
create policy billing_service_read on public.billing_subscriptions for select to folune_billing using(true);
grant select,insert,update on public.ai_usage_daily to folune_billing;
create policy billing_usage_service on public.ai_usage_daily to folune_billing using(true) with check(true);

create function public.billing_prepare_order(p_user_id uuid,p_environment text,p_key uuid,p_kind text,p_sku text,p_interval text,p_amount bigint,p_tokens bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.billing_orders; begin
  insert into public.billing_wallets(user_id) values(p_user_id) on conflict do nothing;
  perform 1 from public.billing_wallets where user_id=p_user_id for update;
  select * into o from public.billing_orders where user_id=p_user_id and environment=p_environment and idempotency_key=p_key;
  if found then
    if (o.kind,o.sku,o.billing_interval,o.amount_cents,o.credit_tokens) is distinct from (p_kind,p_sku,p_interval,p_amount,p_tokens) then
      raise exception 'idempotency_conflict' using errcode='23505';
    end if;
    return to_jsonb(o);
  end if;
  -- 重载页面和多标签也复用同一个未完成订单；未知创建结果绝不自动重发。
  select * into o from public.billing_orders where user_id=p_user_id and environment=p_environment
    and kind=p_kind and sku=p_sku and billing_interval is not distinct from p_interval
    and status in ('created','creating','pending','confirming','partially_paid','review') order by created_at desc limit 1;
  if found then return to_jsonb(o); end if;
  insert into public.billing_orders(user_id,environment,idempotency_key,kind,sku,billing_interval,amount_cents,credit_tokens)
    values(p_user_id,p_environment,p_key,p_kind,p_sku,p_interval,p_amount,p_tokens) returning * into o;
  return to_jsonb(o);
end $$;

create function public.billing_claim_invoice(p_id uuid) returns boolean language plpgsql security invoker set search_path='' as $$
begin
  update public.billing_orders set status='creating',updated_at=now() where id=p_id and status='created';
  return found;
end $$;

create function public.billing_attach_invoice(p_id uuid,p_invoice text,p_url text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.billing_orders; begin
  select * into o from public.billing_orders where id=p_id for update;
  if o.id is null or (o.invoice_id is not null and o.invoice_id<>p_invoice) then raise exception 'invoice_mismatch'; end if;
  update public.billing_orders set invoice_id=p_invoice,checkout_url=p_url,
    status=case when status='creating' then 'pending' else status end,updated_at=now()
    where id=p_id returning * into o;
  return to_jsonb(o);
end $$;

create function public.billing_claim_due(p_environment text,p_lease uuid,p_limit integer default 10)
returns setof public.billing_orders language sql security invoker set search_path='' as $$
  update public.billing_orders set lease_id=p_lease,lease_until=now()+interval '5 minutes',next_check_at=now()+interval '5 minutes'
  where id in (select id from public.billing_orders where environment=p_environment
    and next_check_at<=now() and (lease_until is null or lease_until<now())
    and status not in ('created','refunded') order by next_check_at,id for update skip locked limit least(p_limit,20))
  returning *;
$$;

-- 发放和退款固定 wallet → order 锁顺序；唯一 order/reference 约束是第二道防线。
create function public.billing_apply_payment(p_id uuid,p_environment text,p_payment text,p_invoice text,p_status text,p_amount_cents bigint,p_paid numeric,p_expected numeric,p_updated timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.billing_orders; uid uuid; start_time timestamptz; end_time timestamptz; next_status text; begin
  select user_id into uid from public.billing_orders where id=p_id;
  if uid is null then raise exception 'order_missing' using errcode='22023'; end if;
  perform 1 from public.billing_wallets where user_id=uid for update;
  select * into o from public.billing_orders where id=p_id for update;
  if o.environment<>p_environment or o.amount_cents<>p_amount_cents or p_payment is null or p_invoice is null
    or (o.invoice_id is not null and o.invoice_id<>p_invoice) or (o.fulfilled_at is not null and o.payment_id is not null and o.payment_id<>p_payment) then
    raise exception 'payment_mismatch' using errcode='22023';
  end if;
  if p_updated is null or p_updated>now()+interval '5 minutes' then raise exception 'invalid_payment_date'; end if;
  if o.payment_id=p_payment and o.provider_updated_at is not null and p_updated<o.provider_updated_at then return to_jsonb(o); end if;
  if o.refunded_at is not null then return to_jsonb(o); end if;
  next_status := case p_status when 'finished' then 'paid' when 'refunded' then 'refunded'
    when 'partially_paid' then 'partially_paid' when 'failed' then 'failed' when 'expired' then 'expired'
    when 'waiting' then 'pending' when 'confirming' then 'confirming' when 'confirmed' then 'confirming' when 'sending' then 'confirming' else 'review' end;
  if p_status='finished' and (p_paid is null or p_expected is null or p_expected<=0 or p_paid<p_expected) then next_status:='review'; end if;
  if o.payment_id=p_payment and o.status in ('confirming','partially_paid') and next_status='pending' then next_status:=o.status; end if;
  if o.fulfilled_at is not null and next_status<>'refunded' then next_status:='paid'; end if;
  if next_status='paid' and o.fulfilled_at is null then
    if o.kind='credits' then
      insert into public.billing_credit_ledger(user_id,order_id,reference_id,kind,tokens) values(uid,o.id,o.id,'purchase',o.credit_tokens);
      update public.billing_wallets set balance_tokens=balance_tokens+o.credit_tokens,updated_at=now() where user_id=uid;
    else
      select greatest(now(),coalesce(max(ends_at),now())) into start_time from public.billing_subscription_periods where user_id=uid and revoked_at is null;
      select greatest(start_time,coalesce(max(current_period_end),start_time)) into start_time from public.billing_subscriptions where user_id=uid and status='active';
      end_time:=start_time+case o.billing_interval when 'yearly' then interval '1 year' else interval '1 month' end;
      insert into public.billing_subscription_periods(order_id,user_id,plan_id,billing_interval,starts_at,ends_at) values(o.id,uid,o.sku,o.billing_interval,start_time,end_time);
    end if;
    o.fulfilled_at:=now();
  end if;
  if next_status='refunded' and o.fulfilled_at is not null then
    if o.kind='credits' then
      insert into public.billing_credit_ledger(user_id,order_id,reference_id,kind,tokens) values(uid,o.id,o.id,'refund',-o.credit_tokens);
      -- 已消耗部分形成欠额，后续购买先抵扣；不能因退款凭空保留已花积分。
      update public.billing_wallets set balance_tokens=balance_tokens-o.credit_tokens,updated_at=now() where user_id=uid;
    else update public.billing_subscription_periods set revoked_at=now() where order_id=o.id; end if;
  end if;
  update public.billing_orders set status=next_status,payment_id=p_payment,invoice_id=p_invoice,provider_updated_at=p_updated,
    fulfilled_at=o.fulfilled_at,refunded_at=case when next_status='refunded' then now() end,
    error_code=case when next_status='review' then 'PAYMENT_REQUIRES_REVIEW' end,
    last_checked_at=now(),next_check_at=now()+case when next_status in ('paid','failed','expired') then interval '1 day' else interval '2 minutes' end,
    lease_until=null,lease_id=null,updated_at=now() where id=o.id returning * into o;
  return to_jsonb(o);
end $$;

create function public.billing_record_usage(p_user_id uuid,p_id uuid,p_tokens bigint,p_daily_limit bigint)
returns bigint language plpgsql security invoker set search_path='' as $$
declare d date:=(now() at time zone 'utc')::date; u public.ai_usage_daily; free_part bigint; r public.billing_usage_receipts; begin
  if p_tokens<=0 or p_tokens>100000000 or p_daily_limit<=0 then raise exception 'invalid_usage'; end if;
  insert into public.billing_wallets(user_id) values(p_user_id) on conflict do nothing;
  perform 1 from public.billing_wallets where user_id=p_user_id for update;
  select * into r from public.billing_usage_receipts where id=p_id;
  if found then
    if r.user_id<>p_user_id or r.tokens<>p_tokens then raise exception 'usage_conflict'; end if;
    return (select total_tokens from public.ai_usage_daily where user_id=p_user_id and usage_date=r.usage_date);
  end if;
  insert into public.ai_usage_daily(user_id,usage_date,total_tokens,free_tokens_used) values(p_user_id,d,0,0) on conflict do nothing;
  select * into u from public.ai_usage_daily where user_id=p_user_id and usage_date=d for update;
  free_part:=least(p_tokens,greatest(0,p_daily_limit-u.free_tokens_used));
  insert into public.billing_usage_receipts(id,user_id,tokens,usage_date) values(p_id,p_user_id,p_tokens,d);
  if p_tokens>free_part then
    insert into public.billing_credit_ledger(user_id,reference_id,kind,tokens) values(p_user_id,p_id,'usage',-(p_tokens-free_part));
    update public.billing_wallets set balance_tokens=balance_tokens-(p_tokens-free_part),updated_at=now() where user_id=p_user_id;
  end if;
  update public.ai_usage_daily set total_tokens=total_tokens+p_tokens,free_tokens_used=free_tokens_used+free_part where user_id=p_user_id and usage_date=d returning * into u;
  return u.total_tokens;
end $$;

-- 所有写 RPC 都是 INVOKER；不给 anon/authenticated/public 默认执行权。
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('billing_prepare_order','billing_attach_invoice','billing_claim_invoice','billing_claim_due','billing_apply_payment','billing_record_usage') loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
    execute format('grant execute on function %s to folune_billing',f.signature);
  end loop;
end $$;
commit;

-- 2026-10-03: Staging 已应用 20261003063924 / billing_payments，environment=production。
-- 本机新账本启用后另行撤销 authenticated 对 increment_ai_usage_daily(uuid,bigint) 的 execute；生产后续独立部署。

-- 2026-10-07: Production 已应用 20261006175849；不复制 Staging 订单、钱包或事件。
