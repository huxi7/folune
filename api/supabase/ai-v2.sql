-- [INPUT]: 依赖 public.profiles/public.ai_threads/public.memo_nodes、auth.uid()、authenticated 角色与统一 updated_at trigger
-- [OUTPUT]: 建立默认 ask 的账号级 AI 权限设置与通用原子命令台账，提供 owner-only RLS、状态约束、幂等索引和显式 grants
-- [POS]: api/supabase 的 AI Native V2 持久化契约，将用户审批偏好与可审计写命令分离，不在表策略中信任模型判断
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

create table public.ai_user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  permission_mode text not null default 'ask'
    constraint ai_user_settings_permission_mode_check
    check (permission_mode in ('ask', 'auto_approve', 'full_access')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_commands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  thread_id uuid,
  tool_call_id text
    constraint ai_commands_tool_call_id_check
    check (tool_call_id is null or length(btrim(tool_call_id)) between 1 and 200),
  operation text not null
    constraint ai_commands_operation_check
    check (
      operation in (
        'create_node',
        'rename_node',
        'move_node',
        'reorder_node',
        'trash_node',
        'edit_memo'
      )
    ),
  target_node_id uuid,
  expected_revision bigint
    constraint ai_commands_expected_revision_check
    check (expected_revision is null or expected_revision > 0),
  idempotency_key text not null
    constraint ai_commands_idempotency_key_check
    check (length(btrim(idempotency_key)) between 1 and 200),
  input jsonb not null default '{}'::jsonb
    constraint ai_commands_input_check
    check (jsonb_typeof(input) = 'object'),
  before_state jsonb,
  after_state jsonb,
  undo_result jsonb,
  status text not null default 'pending_approval'
    constraint ai_commands_status_check
    check (
      status in (
        'pending_approval',
        'approved',
        'executing',
        'succeeded',
        'rejected',
        'failed',
        'stale',
        'undone'
      )
    ),
  approval_source text
    constraint ai_commands_approval_source_check
    check (
      approval_source is null
      or approval_source in ('manual', 'approval_agent', 'full_access')
    ),
  risk text
    constraint ai_commands_risk_check
    check (risk is null or risk in ('low', 'medium', 'high')),
  approval_reason text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  applied_at timestamptz,
  undone_at timestamptz,
  constraint ai_commands_user_id_id_key unique (user_id, id),
  constraint ai_commands_user_idempotency_key_key
    unique (user_id, idempotency_key),
  constraint ai_commands_user_thread_fkey
    foreign key (user_id, thread_id)
    references public.ai_threads(user_id, id)
    on delete set null (thread_id),
  constraint ai_commands_revision_contract_check
    check (
      (operation = 'create_node' and expected_revision is null)
      or
      (operation <> 'create_node' and target_node_id is not null and expected_revision is not null)
    )
);

create index ai_commands_user_status_created_idx
on public.ai_commands (user_id, status, created_at desc, id);

create index ai_commands_user_thread_created_idx
on public.ai_commands (user_id, thread_id, created_at desc, id);

create index ai_commands_user_target_created_idx
on public.ai_commands (user_id, target_node_id, created_at desc, id);

create trigger set_ai_user_settings_updated_at
before update on public.ai_user_settings
for each row execute function public.set_current_timestamp_updated_at();

create trigger set_ai_commands_updated_at
before update on public.ai_commands
for each row execute function public.set_current_timestamp_updated_at();

alter table public.ai_user_settings enable row level security;
alter table public.ai_commands enable row level security;

create policy "Users can select own AI settings"
on public.ai_user_settings
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert own AI settings"
on public.ai_user_settings
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own AI settings"
on public.ai_user_settings
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can select own AI commands"
on public.ai_commands
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "AI command RPC can insert owned commands"
on public.ai_commands
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and current_setting('supernote.ai_command_mutation', true) = 'on'
);

create policy "AI command RPC can update owned commands"
on public.ai_commands
for update
to authenticated
using (
  (select auth.uid()) = user_id
  and current_setting('supernote.ai_command_mutation', true) = 'on'
)
with check (
  (select auth.uid()) = user_id
  and current_setting('supernote.ai_command_mutation', true) = 'on'
);

revoke all on table public.ai_user_settings from anon, authenticated;
revoke all on table public.ai_commands from anon, authenticated;

grant select, insert, update on table public.ai_user_settings to authenticated;
-- SECURITY INVOKER 命令 RPC 仍使用调用者权限，因此必须授予底层 DML；
-- 直接 REST 写会因 mutation GUC 未开启而被 RLS 拒绝，只有受控 RPC 可落账。
grant select, insert, update on table public.ai_commands to authenticated;
