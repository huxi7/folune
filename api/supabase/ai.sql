-- [INPUT]: 依赖 public.profiles/public.memo_nodes、Supabase auth.uid()、authenticated 角色与 pgcrypto UUID
-- [OUTPUT]: 建立不含归档状态的 AI threads/messages/refs/runs/actions、V1 include_active_memo 兼容列、引用约束触发器、索引、updated_at、owner-only RLS 与显式 grants
-- [POS]: api/supabase 的 AI 持久化契约，保存会话原始 parts、上下文引用、整理运行与可逆动作，不承载模型推理
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

create table public.ai_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default '新会话'
    constraint ai_threads_title_check
    check (length(btrim(title)) between 1 and 500),
  -- 兼容既有 V1 数据；V2 前端不再把它作为上下文入口或发送依据。
  include_active_memo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  constraint ai_threads_user_id_id_key unique (user_id, id)
);

create table public.ai_messages (
  id text not null
    constraint ai_messages_id_check
    check (length(btrim(id)) between 1 and 200),
  thread_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null
    constraint ai_messages_role_check
    check (role in ('user', 'assistant')),
  parts jsonb not null
    constraint ai_messages_parts_check
    check (jsonb_typeof(parts) = 'array'),
  position bigint not null
    constraint ai_messages_position_check
    check (position >= 0),
  status text not null default 'complete'
    constraint ai_messages_status_check
    check (status in ('in_progress', 'complete', 'aborted', 'error')),
  context_snapshot jsonb
    constraint ai_messages_context_snapshot_check
    check (
      context_snapshot is null
      or jsonb_typeof(context_snapshot) = 'object'
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (thread_id, id),
  constraint ai_messages_user_thread_fkey
    foreign key (user_id, thread_id)
    references public.ai_threads(user_id, id)
    on delete cascade
);

create table public.ai_thread_refs (
  thread_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  memo_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (thread_id, memo_id),
  constraint ai_thread_refs_user_thread_fkey
    foreign key (user_id, thread_id)
    references public.ai_threads(user_id, id)
    on delete cascade,
  constraint ai_thread_refs_user_memo_fkey
    foreign key (user_id, memo_id)
    references public.memo_nodes(user_id, id)
    on delete cascade
);

create table public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  thread_id uuid,
  run_type text not null default 'organize_memo'
    constraint ai_runs_type_check
    check (run_type = 'organize_memo'),
  memo_id uuid not null,
  source_revision bigint not null
    constraint ai_runs_source_revision_check
    check (source_revision > 0),
  status text not null default 'planning'
    constraint ai_runs_status_check
    check (
      status in (
        'planning',
        'awaiting_confirmation',
        'applying',
        'succeeded',
        'rejected',
        'failed',
        'stale',
        'undone'
      )
    ),
  idempotency_key text not null
    constraint ai_runs_idempotency_key_check
    check (length(btrim(idempotency_key)) between 1 and 200),
  plan jsonb
    constraint ai_runs_plan_check
    check (plan is null or jsonb_typeof(plan) = 'object'),
  result jsonb
    constraint ai_runs_result_check
    check (result is null or jsonb_typeof(result) = 'object'),
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  applied_at timestamptz,
  undone_at timestamptz,
  constraint ai_runs_user_id_id_key unique (user_id, id),
  constraint ai_runs_user_idempotency_key_key
    unique (user_id, idempotency_key),
  constraint ai_runs_user_thread_fkey
    foreign key (user_id, thread_id)
    references public.ai_threads(user_id, id)
    on delete set null (thread_id),
  constraint ai_runs_user_memo_fkey
    foreign key (user_id, memo_id)
    references public.memo_nodes(user_id, id)
    on delete cascade
);

create table public.ai_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  run_id uuid not null,
  sequence integer not null
    constraint ai_actions_sequence_check
    check (sequence > 0),
  action_type text not null
    constraint ai_actions_type_check
    check (action_type in ('rename', 'move', 'create_folder')),
  target_node_id uuid not null,
  before_state jsonb not null,
  after_state jsonb not null,
  undone_at timestamptz,
  constraint ai_actions_user_run_sequence_key
    unique (user_id, run_id, sequence),
  constraint ai_actions_user_run_fkey
    foreign key (user_id, run_id)
    references public.ai_runs(user_id, id)
    on delete cascade
);

create index ai_threads_user_activity_idx
on public.ai_threads (user_id, last_message_at desc, id);

create index ai_messages_user_thread_position_idx
on public.ai_messages (user_id, thread_id, position, created_at, id);

create index ai_thread_refs_user_thread_created_idx
on public.ai_thread_refs (user_id, thread_id, created_at, memo_id);

create index ai_thread_refs_user_memo_idx
on public.ai_thread_refs (user_id, memo_id);

create index ai_runs_user_status_created_idx
on public.ai_runs (user_id, status, created_at desc, id);

create index ai_runs_user_memo_created_idx
on public.ai_runs (user_id, memo_id, created_at desc, id);

create index ai_runs_user_thread_created_idx
on public.ai_runs (user_id, thread_id, created_at desc, id)
where thread_id is not null;

create index ai_actions_user_run_sequence_idx
on public.ai_actions (user_id, run_id, sequence desc);

create or replace function public.validate_ai_thread_reference()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  reference_count integer;
begin
  perform 1
  from public.ai_threads
  where user_id = new.user_id
    and id = new.thread_id
  for update;

  if not found then
    raise exception 'AI thread does not exist for this user'
      using errcode = '23503';
  end if;

  perform 1
  from public.memo_nodes
  where user_id = new.user_id
    and id = new.memo_id
    and node_type = 'memo'
    and deleted_at is null;

  if not found then
    raise exception 'AI reference must point to an active memo owned by the user'
      using errcode = '23503';
  end if;

  select count(*)
  into reference_count
  from public.ai_thread_refs
  where user_id = new.user_id
    and thread_id = new.thread_id
    and memo_id is distinct from new.memo_id;

  if reference_count >= 5 then
    raise exception 'AI thread cannot contain more than five memo references'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger ai_thread_refs_validate
before insert or update of user_id, thread_id, memo_id
on public.ai_thread_refs
for each row
execute function public.validate_ai_thread_reference();

create trigger ai_threads_set_updated_at
before update on public.ai_threads
for each row
execute function public.set_current_timestamp_updated_at();

create trigger ai_messages_set_updated_at
before update on public.ai_messages
for each row
execute function public.set_current_timestamp_updated_at();

create trigger ai_runs_set_updated_at
before update on public.ai_runs
for each row
execute function public.set_current_timestamp_updated_at();

create or replace function public.replace_ai_thread_references(
  p_user_id uuid,
  p_thread_id uuid,
  p_memo_ids uuid[]
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_memo_ids uuid[];
  invalid_count integer;
  result jsonb;
begin
  if (select auth.uid()) is distinct from p_user_id then
    return jsonb_build_object('status', 'not_found');
  end if;

  perform 1
  from public.ai_threads
  where user_id = p_user_id
    and id = p_thread_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  select coalesce(array_agg(memo_id order by first_position), '{}'::uuid[])
  into normalized_memo_ids
  from (
    select memo_id, min(position) as first_position
    from unnest(coalesce(p_memo_ids, '{}'::uuid[]))
      with ordinality as requested(memo_id, position)
    group by memo_id
  ) as unique_requested;

  if cardinality(normalized_memo_ids) > 5 then
    return jsonb_build_object('status', 'too_many_references');
  end if;

  select count(*)
  into invalid_count
  from unnest(normalized_memo_ids) as requested(memo_id)
  left join public.memo_nodes as memo
    on memo.user_id = p_user_id
   and memo.id = requested.memo_id
   and memo.node_type = 'memo'
   and memo.deleted_at is null
  where memo.id is null;

  if invalid_count > 0 then
    return jsonb_build_object('status', 'invalid_reference');
  end if;

  delete from public.ai_thread_refs
  where user_id = p_user_id
    and thread_id = p_thread_id;

  insert into public.ai_thread_refs (
    user_id,
    thread_id,
    memo_id,
    created_at
  )
  select
    p_user_id,
    p_thread_id,
    requested.memo_id,
    statement_timestamp() + ((requested.position - 1) * interval '1 microsecond')
  from unnest(normalized_memo_ids)
    with ordinality as requested(memo_id, position);

  select jsonb_build_object(
    'status', 'replaced',
    'references', coalesce(
      jsonb_agg(to_jsonb(reference) order by reference.created_at, reference.memo_id),
      '[]'::jsonb
    )
  )
  into result
  from public.ai_thread_refs as reference
  where reference.user_id = p_user_id
    and reference.thread_id = p_thread_id;

  return result;
end;
$$;

alter table public.ai_threads enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_thread_refs enable row level security;
alter table public.ai_runs enable row level security;
alter table public.ai_actions enable row level security;

create policy "ai_threads_select_own" on public.ai_threads
for select to authenticated using ((select auth.uid()) = user_id);
create policy "ai_threads_insert_own" on public.ai_threads
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "ai_threads_update_own" on public.ai_threads
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "ai_threads_delete_own" on public.ai_threads
for delete to authenticated using ((select auth.uid()) = user_id);

create policy "ai_messages_select_own" on public.ai_messages
for select to authenticated using ((select auth.uid()) = user_id);
create policy "ai_messages_insert_own" on public.ai_messages
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "ai_messages_update_own" on public.ai_messages
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "ai_messages_delete_own" on public.ai_messages
for delete to authenticated using ((select auth.uid()) = user_id);

create policy "ai_thread_refs_select_own" on public.ai_thread_refs
for select to authenticated using ((select auth.uid()) = user_id);
create policy "ai_thread_refs_insert_own" on public.ai_thread_refs
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "ai_thread_refs_update_own" on public.ai_thread_refs
for update to authenticated using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy "ai_thread_refs_delete_own" on public.ai_thread_refs
for delete to authenticated using ((select auth.uid()) = user_id);

create policy "ai_runs_select_own" on public.ai_runs
for select to authenticated using ((select auth.uid()) = user_id);
create policy "ai_runs_insert_from_executor" on public.ai_runs
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and (select current_setting('folune.ai_run_mutation', true)) = 'on'
);
create policy "ai_runs_update_from_executor" on public.ai_runs
for update to authenticated
using (
  (select auth.uid()) = user_id
  and (select current_setting('folune.ai_run_mutation', true)) = 'on'
)
with check (
  (select auth.uid()) = user_id
  and (select current_setting('folune.ai_run_mutation', true)) = 'on'
);

create policy "ai_actions_select_own" on public.ai_actions
for select to authenticated using ((select auth.uid()) = user_id);
create policy "ai_actions_insert_from_executor" on public.ai_actions
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and (select current_setting('folune.ai_executor', true)) = 'on'
);
create policy "ai_actions_update_from_executor" on public.ai_actions
for update to authenticated
using (
  (select auth.uid()) = user_id
  and (select current_setting('folune.ai_executor', true)) = 'on'
)
with check (
  (select auth.uid()) = user_id
  and (select current_setting('folune.ai_executor', true)) = 'on'
);

revoke all privileges on table public.ai_threads, public.ai_messages,
public.ai_thread_refs, public.ai_runs, public.ai_actions
from public, anon, authenticated, service_role;

revoke all on function public.validate_ai_thread_reference()
from public, anon, authenticated, service_role;

revoke all on function public.replace_ai_thread_references(uuid, uuid, uuid[])
from public, anon, authenticated, service_role;

grant select, insert, update, delete
on public.ai_threads, public.ai_messages, public.ai_thread_refs
to authenticated;

grant select, insert, update on public.ai_runs to authenticated;
grant select, insert, update on public.ai_actions to authenticated;

grant execute on function public.replace_ai_thread_references(uuid, uuid, uuid[])
to authenticated;
