-- [INPUT]: 依赖已部署 billing.sql、至少两条测试环境 profiles，以及可 SET ROLE 的运维连接
-- [OUTPUT]: 事务内验证本人可读、跨账户不可见、私有支付列不可读、三种用户 DML 和匿名读取被拒绝，最后回滚全部临时订阅
-- [POS]: 真实 PostgreSQL 订阅授权门禁，不创建测试账号、不修改现有资料、不保留伪造订阅；只在 staging 或本地测试库执行
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

begin;

do $$
declare
  v_owner uuid;
  v_other uuid;
  v_count integer;
  v_denied boolean;
begin
  select id into v_owner from public.profiles order by id limit 1;
  select id into v_other from public.profiles where id <> v_owner order by id limit 1;
  if v_other is null then raise exception 'billing test requires two test profiles'; end if;

  -- 只在事务私有快照里暂存验证记录；外部请求不会观察到这些未提交的付款事实。
  insert into public.billing_subscriptions (
    user_id, plan_id, status, billing_interval, current_period_start, current_period_end,
    provider, provider_subscription_id, last_verified_event_id, verified_at
  ) values
    (v_owner, 'pro', 'active', 'monthly', now(), now() + interval '1 month', 'rls-test', 'owner', 'test-owner', now()),
    (v_other, 'studio', 'active', 'monthly', now(), now() + interval '1 month', 'rls-test', 'other', 'test-other', now())
  on conflict (user_id) do nothing;

  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(user_id) into v_count from public.billing_subscriptions;
  if v_count <> 1 then raise exception 'owner select did not isolate one subscription'; end if;
  select count(user_id) into v_count from public.billing_subscriptions where user_id = v_other;
  if v_count <> 0 then raise exception 'other user subscription was visible'; end if;

  v_denied := false;
  begin
    perform provider_subscription_id from public.billing_subscriptions;
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'private provider fields were readable'; end if;

  v_denied := false;
  begin
    update public.billing_subscriptions set plan_id = 'studio' where user_id = v_owner;
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'user could upgrade own subscription'; end if;

  v_denied := false;
  begin
    delete from public.billing_subscriptions where user_id = v_owner;
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'user could delete payment facts'; end if;

  v_denied := false;
  begin
    insert into public.billing_subscriptions (user_id) values (v_owner);
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'user could insert payment facts'; end if;

  execute 'set local role anon';
  v_denied := false;
  begin
    perform user_id from public.billing_subscriptions;
  exception when insufficient_privilege then v_denied := true;
  end;
  if not v_denied then raise exception 'anonymous access was allowed'; end if;
  execute 'reset role';
end;
$$;

select 'billing owner isolation, private columns and write protection passed' as result;
rollback;
