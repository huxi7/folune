"""
[INPUT]: 依赖 Docker PostgreSQL 17 与计费 SQL，可选 PostgREST 14 和 Bun HTTP 门禁
[OUTPUT]: 验证真实事务/权限；--http 贯通 API、PostgREST 验签与发放，不接远端
[POS]: 支付持久化验收门禁；不使用远端数据库或真实凭据
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
"""
import concurrent.futures
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import uuid
ROOT=Path(__file__).resolve().parents[1]
NAME='folune-billing-test-'+uuid.uuid4().hex[:8]
REST_NAME=NAME+'-rest'
USER='11111111-1111-4111-8111-111111111111'
OTHER='22222222-2222-4222-8222-222222222222'
def run(*args,input=None):
 r=subprocess.run(args,input=input,text=True,capture_output=True)
 if r.returncode: raise RuntimeError(r.stderr)
 return r.stdout.strip()
def sql(query):return run('docker','exec','-i',NAME,'psql','-U','postgres','-XAtq','-v','ON_ERROR_STOP=1',input=query)
def service(query):return sql('set role folune_billing;'+query)
def rejected(query):
 try: sql(query)
 except RuntimeError:return
 raise AssertionError('Expected rejection')
def order(kind='credits',sku='credits_500',interval='null',tokens=5000000):
 return json.loads(service(f"select billing_prepare_order('{USER}','sandbox','{uuid.uuid4()}','{kind}','{sku}',{interval},500,{tokens});"))
def apply(o,status='finished',payment='123',invoice='456',amount=500,paid='1',expected='1',updated='now()'):
 return service(f"select billing_apply_payment('{o['id']}','sandbox','{payment}','{invoice}','{status}',{amount},{paid},{expected},{updated});")
try:
 run('docker','run','-d','--name',NAME,'-p','127.0.0.1::3000','-e','POSTGRES_PASSWORD=local-test-only','postgres:17-alpine')
 for _ in range(50):
  try: sql('select 1');break
  except RuntimeError:time.sleep(.2)
 sql("create role anon;create role authenticated;create role service_role;create role authenticator;create schema auth;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;create table public.profiles(id uuid primary key);create function public.set_current_timestamp_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;"+f"insert into profiles values('{USER}'),('{OTHER}');")
 for file in ['billing.sql','ai-usage.sql','billing-payments.sql','billing-variable-rate.sql']:sql((ROOT/'supabase'/file).read_text())
 o=order()
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:list(pool.map(lambda _:apply(o),range(8)))
 assert sql('select count(*) from billing_credit_ledger')=='1'
 service(f"select billing_attach_invoice('{o['id']}','456','https://sandbox.nowpayments.io/payment/?iid=456');")
 assert service(f"select status from billing_orders where id='{o['id']}'")=='paid'
 assert service(f"select balance_tokens from billing_wallets where user_id='{USER}'")=='5000000'
 apply(o,'waiting')
 assert service(f"select status from billing_orders where id='{o['id']}'")=='paid'
 before=service('select sum(balance_tokens) from billing_wallets')
 rejected(f"set role folune_billing;select billing_apply_payment('{o['id']}','sandbox','123','456','finished',499,1,1,now());")
 assert service('select sum(balance_tokens) from billing_wallets')==before
 usage=str(uuid.uuid4())
 with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:list(pool.map(lambda _:service(f"select billing_record_usage('{USER}','{usage}',100100,100000);"),range(8)))
 assert service(f"select balance_tokens from billing_wallets where user_id='{USER}'")=='4999900'
 assert sql('select total_tokens from ai_usage_daily')=='100100'
 assert sql('select free_tokens_used from ai_usage_daily')=='100000'
 apply(o,'refunded')
 apply(o,'refunded')
 apply(o,'finished')
 assert service(f"select balance_tokens from billing_wallets where user_id='{USER}'")=='-100'
 assert sql("select count(*) from billing_credit_ledger where kind='refund'")=='1'
 sub=order('subscription','pro',"'monthly'",0);apply(sub,payment='124',invoice='457')
 sub2=order('subscription','starter',"'yearly'",0);apply(sub2,payment='125',invoice='458')
 assert sql('select count(*) from billing_subscription_periods')=='2'
 assert sql('select count(*) from billing_subscription_periods a join billing_subscription_periods b on a.ends_at=b.starts_at')=='1'
 under=order();apply(under,payment='126',invoice='459',paid='0.9999999999999999999999999')
 assert service(f"select status from billing_orders where id='{under['id']}'")=='review'
 assert service(f"select fulfilled_at is null from billing_orders where id='{under['id']}'")=='t'
 for role in ['authenticated','anon','service_role']:
  rejected(f"set role {role};select billing_claim_invoice('{under['id']}');")
  rejected(f"set role {role};update billing_wallets set balance_tokens=999999;")
 rejected('set role authenticated;select * from billing_events;')
 rejected('set role folune_billing;select * from profiles;')
 assert sql(f"set role authenticated;set request.jwt.claim.sub='{OTHER}';select count(id) from billing_orders;")=='0'
 rejected(f"set role authenticated;set request.jwt.claim.sub='{USER}';select invoice_id from billing_orders;")
 legacy=order(sku='credits_8000',tokens=80000000)
 service(f"update billing_orders set is_fixed_rate=true,status='pending',invoice_id='901',checkout_url='https://nowpayments.io/payment/?iid=901' where id='{legacy['id']}';")
 fresh=order(sku='credits_8000',tokens=80000000)
 assert fresh['id']!=legacy['id'] and fresh['is_fixed_rate'] is False
 duplicate=json.loads(service(f"select billing_prepare_order('{USER}','sandbox','{legacy['idempotency_key']}','credits','credits_8000',null,500,80000000);"))
 assert duplicate['id']==legacy['id']
 apply(legacy,payment='902',invoice='901')
 assert service(f"select status from billing_orders where id='{legacy['id']}'")=='paid'
 print('PASS: real PostgreSQL concurrent fulfillment/usage, exact amount, refund, subscription queue, rate-policy replacement and role/RLS isolation')
 if '--http' in sys.argv:
  sql("""
   insert into profiles values('33333333-3333-4333-8333-333333333333'),('44444444-4444-4444-8444-444444444444');
   insert into billing_environment(environment) values('production');
   alter role authenticator login noinherit password 'local-test-only';
   grant anon,authenticated to authenticator;
   grant usage on schema public to anon,authenticated;
   create or replace function auth.uid() returns uuid language sql as $$
     select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
       nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
   $$;
  """)
  run('docker','run','-d','--name',REST_NAME,'--network','container:'+NAME,
      '-e','PGRST_DB_URI=postgres://authenticator:local-test-only@127.0.0.1:5432/postgres',
      '-e','PGRST_DB_ANON_ROLE=anon','-e','PGRST_DB_SCHEMAS=public',
      '-e','PGRST_JWT_SECRET=folune-isolated-payment-test-secret-only','postgrest/postgrest:v14.1')
  endpoint='http://'+run('docker','port',NAME,'3000/tcp')
  import urllib.request
  for attempt in range(50):
   try:
    with urllib.request.urlopen(endpoint,timeout=1):break
   except Exception:
    if attempt==49:raise RuntimeError('Local PostgREST did not become ready')
    time.sleep(.2)
  result=subprocess.run(['bun','run',str(ROOT/'test'/'payment-http.ts')],
    env={**os.environ,'PAYMENT_TEST_REST_URL':endpoint},cwd=ROOT)
  if result.returncode:raise RuntimeError('HTTP payment integration failed')
finally:
 subprocess.run(['docker','rm','-f',REST_NAME],capture_output=True)
 subprocess.run(['docker','rm','-f',NAME],capture_output=True)
