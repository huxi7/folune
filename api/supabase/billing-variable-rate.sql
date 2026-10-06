-- [INPUT]: 依赖 billing-payments.sql 的订单和统一 prepare RPC
-- [OUTPUT]: 保存汇率策略快照；新购买不复用旧固定汇率 Invoice，旧付款仍可核对/发放
-- [POS]: 小额支付普通汇率切换补丁，不删除订单、不伪造过期或改变已付权益
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
begin;
alter table public.billing_orders add column if not exists is_fixed_rate boolean not null default true;
alter table public.billing_orders alter column is_fixed_rate set default false;
-- 尚未开始创建的订单可以直接使用新策略，已发出的 Invoice 保留原事实。
update public.billing_orders set is_fixed_rate=false where status='created' and invoice_id is null;
create or replace function public.billing_prepare_order(p_user_id uuid,p_environment text,p_key uuid,p_kind text,p_sku text,p_interval text,p_amount bigint,p_tokens bigint)
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
    and not is_fixed_rate
    and status in ('created','creating','pending','confirming','partially_paid','review') order by created_at desc limit 1;
  if found then return to_jsonb(o); end if;
  insert into public.billing_orders(user_id,environment,idempotency_key,kind,sku,billing_interval,amount_cents,credit_tokens)
    values(p_user_id,p_environment,p_key,p_kind,p_sku,p_interval,p_amount,p_tokens) returning * into o;
  return to_jsonb(o);
end $$;

notify pgrst, 'reload schema';
commit;

-- 2026-10-03: Staging 已应用 20261003092113 / billing_variable_rate；生产后续独立部署。

-- 2026-10-07: Production 已应用 20261006175933；不复制 Staging 订单、钱包或事件。
