"""
[INPUT]: 依赖 Docker PostgreSQL 17、仓库 memos/ai-v2/ai-command SQL 与 Python 标准库
[OUTPUT]: 在隔离数据库验证八条并发删除、撤销、幂等、revision/owner 和权限默认迁移；可传旧 SQL 重现死锁
[POS]: API 真实数据库并发门禁，补足内存 RPC mock 无法验证事务锁的边界，不连接远端或读取真实数据
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
"""
import concurrent.futures
import json
from pathlib import Path
import subprocess
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
CONTAINER = f"folune-command-test-{uuid.uuid4().hex[:8]}"
OWNER = "00000000-0000-4000-8000-000000000001"
OTHER = "00000000-0000-4000-8000-000000000002"


def run(*args, **kwargs):
    result = subprocess.run(args, capture_output=True, text=True, **kwargs)
    if result.returncode:
        raise RuntimeError(result.stderr.strip())
    return result.stdout.strip()


def sql(query):
    return run("docker", "exec", "-i", CONTAINER, "psql", "-h", "127.0.0.1", "-U", "postgres", "-XAtq", "-v", "ON_ERROR_STOP=1", input=query)


def owned(query, owner=OWNER):
    return sql(f"set role authenticated; set request.jwt.claim.sub='{owner}'; {query}")


def parallel(queries):
    started = time.monotonic()
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        result = list(pool.map(owned, queries))
    return result, round((time.monotonic() - started) * 1000)


def seed():
    sql("truncate public.ai_commands, public.memos, public.memo_nodes cascade;")
    ids = [str(uuid.uuid4()) for _ in range(8)]
    for index, node_id in enumerate(ids):
        sql(f"insert into public.memo_nodes(id,user_id,node_type,title) values ('{node_id}','{OWNER}','memo','测试笔记 {index}');")
    return ids


def deletion(node_id, key, revision=1):
    return f"select public.create_ai_command('{OWNER}',null,'{key}','trash_node','{node_id}',{revision},'{key}','{{}}','full_access','high','并发回归')->>'status';"


def batch(label, definition, expected_failures):
    sql(definition)
    ids = seed()
    queries = [deletion(node, f"delete-{index}") for index, node in enumerate(ids)]
    results, elapsed = parallel(queries)
    failures = results.count("failed")
    assert failures == expected_failures, (label, results)
    assert results.count("succeeded") == 8 - failures, results
    print(json.dumps({"case": label, "succeeded": 8-failures, "failed": failures, "elapsed_ms": elapsed}))
    return ids, queries


try:
    run("docker", "run", "-d", "--rm", "--name", CONTAINER,
        "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:17-alpine")
    for attempt in range(60):
        try:
            sql("select 1;")
            break
        except RuntimeError:
            time.sleep(0.2)
    sql("""
      create role authenticated; create role anon; create role service_role;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated;
      create table public.profiles(id uuid primary key);
      create table public.ai_threads(id uuid primary key, user_id uuid, unique(user_id,id));
    """)
    sql((ROOT / "supabase/memos.sql").read_text())
    sql((ROOT / "supabase/ai-v2.sql").read_text())
    sql(f"insert into public.profiles values ('{OWNER}'),('{OTHER}'); insert into public.ai_user_settings(user_id,permission_mode) values ('{OWNER}','full_access');")
    # 在真实函数树锁前制造重叠窗口，稳定重现旧版先锁目标的交叉等待。
    memo_sql = (ROOT / "supabase/memos.sql").read_text()
    soft_delete = memo_sql[memo_sql.index('create or replace function public.soft_delete_memo_node'):memo_sql.index('create or replace function public.restore_memo_node')]
    sql(soft_delete.replace('begin\n  perform 1', 'begin\n  perform pg_sleep(0.15);\n  perform 1'))
    if len(sys.argv) > 1:
        batch("before_forced_overlap", Path(sys.argv[1]).read_text(), 7)
    if len(sys.argv) > 1:
        sql((ROOT / "supabase/ai-command-lock-order.sql").read_text())
        sql((ROOT / "supabase/ai-command-lock-order.sql").read_text())
        patched = sql("select pg_get_functiondef('public.apply_ai_command(uuid,uuid)'::regprocedure);")
        assert 'AI_COMMAND_DEADLOCK' in patched
        batch("incremental_patch", "select 1;", 0)
    fixed = (ROOT / "supabase/ai-command.sql").read_text()
    batch("fixed_forced_overlap", fixed, 0)
    sql(soft_delete)
    ids, queries = batch("fixed_normal", fixed, 0)
    repeated, _ = parallel(queries)
    assert repeated == ['succeeded'] * 8, repeated
    assert sql('select count(*) from public.ai_commands;') == '8'
    commands = sql('select id from public.ai_commands order by id;').splitlines()
    results, elapsed = parallel([f"select public.undo_ai_command('{OWNER}','{command}')->>'status';" for command in commands])
    assert results == ['undone'] * 8, results
    assert sql('select count(*) from public.memo_nodes where deleted_at is null;') == '8'
    print(json.dumps({"case": "parallel_undo", "undone": 8, "elapsed_ms": elapsed}))
    assert owned(deletion(ids[0], 'stale-version')) == 'stale'
    assert owned(deletion(ids[1], 'wrong-owner'), OTHER) == 'not_found'
    print('idempotency, revision and owner guards: passed')

    # 用旧默认及明确选择验证增量迁移，不接触真实账号。
    explicit_ask = '00000000-0000-4000-8000-000000000003'
    explicit_auto = '00000000-0000-4000-8000-000000000004'
    sql(f"""
      alter table public.ai_user_settings alter column permission_mode set default 'ask';
      insert into public.profiles values ('{explicit_ask}'), ('{explicit_auto}');
      insert into public.ai_user_settings(user_id) values ('{OTHER}');
      insert into public.ai_user_settings(user_id,permission_mode,created_at,updated_at) values
        ('{explicit_ask}','ask','2026-01-01','2026-01-02'),
        ('{explicit_auto}','auto_approve','2026-01-01','2026-01-02');
    """)
    original_command = sql("select pg_get_functiondef('public.create_ai_command(uuid,uuid,text,text,uuid,bigint,text,jsonb,text,text,text)'::regprocedure);")
    sql(original_command.replace("coalesce(permission_mode, 'full_access')", "coalesce(permission_mode, 'ask')"))
    permission_patch = (ROOT / 'supabase/ai-settings-full-access.sql').read_text()
    sql(permission_patch)
    sql(permission_patch)
    assert sql(f"select permission_mode from public.ai_user_settings where user_id='{OTHER}';") == 'full_access'
    assert sql(f"select permission_mode from public.ai_user_settings where user_id='{explicit_ask}';") == 'ask'
    assert sql(f"select permission_mode from public.ai_user_settings where user_id='{explicit_auto}';") == 'auto_approve'
    assert sql("select pg_get_functiondef('public.create_ai_command(uuid,uuid,text,text,uuid,bigint,text,jsonb,text,text,text)'::regprocedure);") == original_command
    sql(f"delete from public.ai_user_settings where user_id='{OWNER}';")
    assert owned(deletion(ids[0], 'default-access', revision=3)) == 'succeeded'
    assert sql(f"insert into public.ai_user_settings(user_id) values ('{OWNER}') returning permission_mode;") == 'full_access'
    sql(f"update public.ai_user_settings set permission_mode='ask' where user_id='{OWNER}';")
    assert owned(deletion(ids[1], 'explicit-ask', revision=3)) == 'pending_approval'
    print('full access defaults, explicit choices, incremental migration and repeatability: passed')
finally:
    subprocess.run(["docker", "rm", "-f", CONTAINER], capture_output=True)
