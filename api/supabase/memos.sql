-- [INPUT]: 依赖 public.profiles、Supabase auth.uid()、authenticated/service_role 角色与 pgcrypto 的 gen_random_uuid()
-- [OUTPUT]: 建立 public.memo_nodes/public.memos、统一 revision、删除批次、递归回收站 RPC、级联树外键、约束索引、owner-only RLS 与显式 grants
-- [POS]: api/supabase 的备忘录树数据库契约，以邻接表承载 active/回收站两态，以节点 revision 保护 AI 读取与写入的一致性
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

create table public.memo_nodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid,
  node_type text not null
    constraint memo_nodes_node_type_check
    check (node_type in ('folder', 'memo')),
  title text not null
    constraint memo_nodes_title_check
    check (length(btrim(title)) between 1 and 500),
  sort_order numeric(20, 8) not null default 1000,
  icon text,
  color text,
  metadata jsonb not null default '{}'::jsonb,
  revision bigint not null default 1
    constraint memo_nodes_revision_check
    check (revision > 0),
  deleted_at timestamptz,
  deleted_root_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memo_nodes_user_id_id_key unique (user_id, id),
  constraint memo_nodes_not_own_parent_check
    check (id is distinct from parent_id),
  constraint memo_nodes_deleted_state_check
    check (
      (deleted_at is null and deleted_root_id is null)
      or
      (deleted_at is not null and deleted_root_id is not null)
    ),
  constraint memo_nodes_user_parent_fkey
    foreign key (user_id, parent_id)
    references public.memo_nodes(user_id, id)
    on delete cascade
);

create table public.memos (
  node_id uuid primary key
    references public.memo_nodes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content_mdx text not null default '',
  excerpt text,
  word_count integer not null default 0
    constraint memos_word_count_check
    check (word_count >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memos_user_id_node_id_key unique (user_id, node_id),
  constraint memos_user_node_fkey
    foreign key (user_id, node_id)
    references public.memo_nodes(user_id, id)
);

create index memo_nodes_active_siblings_idx
on public.memo_nodes (user_id, parent_id, sort_order, id)
where deleted_at is null;

create index memo_nodes_active_roots_idx
on public.memo_nodes (user_id, sort_order, id)
where parent_id is null and deleted_at is null;

create index memo_nodes_user_type_idx
on public.memo_nodes (user_id, node_type);

create index memo_nodes_parent_id_idx
on public.memo_nodes (parent_id);

create index memo_nodes_trash_roots_idx
on public.memo_nodes (user_id, deleted_at desc, id)
where deleted_at is not null and deleted_root_id = id;

create index memo_nodes_deleted_batch_idx
on public.memo_nodes (user_id, deleted_root_id, id)
where deleted_root_id is not null;

create index memos_user_updated_at_idx
on public.memos (user_id, updated_at desc);

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.bump_memo_node_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.title is distinct from old.title
    or new.parent_id is distinct from old.parent_id
    or new.sort_order is distinct from old.sort_order
    or new.deleted_at is distinct from old.deleted_at
    or current_setting('folune.memo_content_revision', true) = 'on'
  then
    new.revision = old.revision + 1;
  else
    new.revision = old.revision;
  end if;

  return new;
end;
$$;

create or replace function public.bump_memo_revision_from_content()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.content_mdx is distinct from old.content_mdx then
    perform set_config('folune.memo_content_revision', 'on', true);

    update public.memo_nodes
    set revision = revision + 1
    where user_id = new.user_id
      and id = new.node_id;

    perform set_config('folune.memo_content_revision', 'off', true);
  end if;

  return new;
end;
$$;

create or replace function public.validate_memo_node_tree()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_node_type text;
begin
  if tg_op = 'UPDATE' and new.node_type is distinct from old.node_type then
    raise exception 'memo node type cannot be changed'
      using errcode = '23514';
  end if;

  if new.parent_id is null then
    return new;
  end if;

  select node_type
  into parent_node_type
  from public.memo_nodes
  where user_id = new.user_id
    and id = new.parent_id
    and deleted_at is null;

  if not found then
    raise exception 'memo parent node does not exist for this user'
      using errcode = '23503';
  end if;

  if parent_node_type <> 'folder' then
    raise exception 'memo parent node must be a folder'
      using errcode = '23514';
  end if;

  if exists (
    with recursive ancestors as (
      select id, parent_id
      from public.memo_nodes
      where user_id = new.user_id
        and id = new.parent_id

      union

      select candidate.id, candidate.parent_id
      from public.memo_nodes as candidate
      join ancestors
        on candidate.id = ancestors.parent_id
       and candidate.user_id = new.user_id
    )
    select 1
    from ancestors
    where id = new.id
  ) then
    raise exception 'memo node tree cannot contain a cycle'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.validate_memo_content_node()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  content_node_type text;
begin
  select node_type
  into content_node_type
  from public.memo_nodes
  where user_id = new.user_id
    and id = new.node_id;

  if not found then
    raise exception 'memo content node does not exist for this user'
      using errcode = '23503';
  end if;

  if content_node_type <> 'memo' then
    raise exception 'memo content must reference a memo node'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.soft_delete_memo_node(
  p_user_id uuid,
  p_node_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target public.memo_nodes%rowtype;
  deleted_node public.memo_nodes%rowtype;
  deleted_time timestamptz := statement_timestamp();
begin
  perform 1
  from public.memo_nodes
  where user_id = p_user_id
  order by id
  for update;

  select *
  into target
  from public.memo_nodes
  where user_id = p_user_id
    and id = p_node_id;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if target.deleted_at is not null then
    return jsonb_build_object('status', 'already_deleted');
  end if;

  with recursive subtree as (
    select id
    from public.memo_nodes
    where user_id = p_user_id
      and id = p_node_id

    union

    select child.id
    from public.memo_nodes as child
    join subtree as parent
      on child.parent_id = parent.id
    where child.user_id = p_user_id
  )
  update public.memo_nodes as node
  set
    deleted_at = deleted_time,
    deleted_root_id = p_node_id
  where node.user_id = p_user_id
    and node.id in (select id from subtree)
    and node.deleted_at is null;

  select *
  into deleted_node
  from public.memo_nodes
  where user_id = p_user_id
    and id = p_node_id;

  return jsonb_build_object(
    'status', 'deleted',
    'node', to_jsonb(deleted_node)
  );
end;
$$;

create or replace function public.restore_memo_node(
  p_user_id uuid,
  p_node_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target public.memo_nodes%rowtype;
  has_deleted_ancestor boolean;
  result jsonb;
begin
  perform 1
  from public.memo_nodes
  where user_id = p_user_id
  order by id
  for update;

  select *
  into target
  from public.memo_nodes
  where user_id = p_user_id
    and id = p_node_id;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if target.deleted_at is null then
    return jsonb_build_object('status', 'already_active');
  end if;

  if target.deleted_root_id is distinct from target.id then
    return jsonb_build_object('status', 'not_root');
  end if;

  with recursive ancestors as (
    select id, parent_id, deleted_at
    from public.memo_nodes
    where user_id = p_user_id
      and id = target.parent_id

    union

    select parent.id, parent.parent_id, parent.deleted_at
    from public.memo_nodes as parent
    join ancestors as child
      on parent.id = child.parent_id
    where parent.user_id = p_user_id
  )
  select exists (
    select 1
    from ancestors
    where deleted_at is not null
  )
  into has_deleted_ancestor;

  if has_deleted_ancestor then
    return jsonb_build_object('status', 'blocked_by_deleted_ancestor');
  end if;

  with restored_nodes as (
    update public.memo_nodes as node
    set
      deleted_at = null,
      deleted_root_id = null
    where node.user_id = p_user_id
      and node.deleted_root_id = p_node_id
    returning node.*
  )
  select jsonb_build_object(
    'status', 'restored',
    'nodes', coalesce(
      (
        select jsonb_agg(to_jsonb(restored) order by restored.sort_order, restored.id)
        from restored_nodes as restored
      ),
      '[]'::jsonb
    ),
    'contents', coalesce(
      (
        select jsonb_agg(to_jsonb(content) order by content.node_id)
        from public.memos as content
        join restored_nodes as restored
          on restored.id = content.node_id
        where content.user_id = p_user_id
      ),
      '[]'::jsonb
    )
  )
  into result;

  return result;
end;
$$;

create or replace function public.permanently_delete_memo_node(
  p_user_id uuid,
  p_node_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target public.memo_nodes%rowtype;
  has_deleted_ancestor boolean;
begin
  perform 1
  from public.memo_nodes
  where user_id = p_user_id
  order by id
  for update;

  select *
  into target
  from public.memo_nodes
  where user_id = p_user_id
    and id = p_node_id;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if target.deleted_at is null then
    return jsonb_build_object('status', 'active_node');
  end if;

  if target.deleted_root_id is distinct from target.id then
    return jsonb_build_object('status', 'not_root');
  end if;

  with recursive ancestors as (
    select id, parent_id, deleted_at
    from public.memo_nodes
    where user_id = p_user_id
      and id = target.parent_id

    union

    select parent.id, parent.parent_id, parent.deleted_at
    from public.memo_nodes as parent
    join ancestors as child
      on parent.id = child.parent_id
    where parent.user_id = p_user_id
  )
  select exists (
    select 1
    from ancestors
    where deleted_at is not null
  )
  into has_deleted_ancestor;

  if has_deleted_ancestor then
    return jsonb_build_object('status', 'blocked_by_deleted_ancestor');
  end if;

  delete from public.memo_nodes
  where user_id = p_user_id
    and id = p_node_id;

  return jsonb_build_object('status', 'deleted', 'deleted_count', 1);
end;
$$;

create or replace function public.empty_memo_trash(p_user_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  perform 1
  from public.memo_nodes
  where user_id = p_user_id
  order by id
  for update;

  delete from public.memo_nodes
  where user_id = p_user_id
    and deleted_at is not null
    and deleted_root_id = id;

  get diagnostics deleted_count = row_count;

  return jsonb_build_object(
    'status', 'emptied',
    'deleted_count', deleted_count
  );
end;
$$;

create trigger memo_nodes_set_updated_at
before update on public.memo_nodes
for each row
execute function public.set_current_timestamp_updated_at();

create trigger memo_nodes_bump_revision
before update on public.memo_nodes
for each row
execute function public.bump_memo_node_revision();

create trigger memo_nodes_validate_tree
before insert or update of user_id, parent_id, node_type
on public.memo_nodes
for each row
execute function public.validate_memo_node_tree();

create trigger memos_set_updated_at
before update on public.memos
for each row
execute function public.set_current_timestamp_updated_at();

create trigger memos_validate_node
before insert or update of user_id, node_id
on public.memos
for each row
execute function public.validate_memo_content_node();

create trigger memos_bump_node_revision
after update of content_mdx on public.memos
for each row
execute function public.bump_memo_revision_from_content();

alter table public.memo_nodes enable row level security;
alter table public.memos enable row level security;

create policy "memo_nodes_select_own"
on public.memo_nodes
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "memo_nodes_insert_own"
on public.memo_nodes
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "memo_nodes_update_own"
on public.memo_nodes
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "memo_nodes_delete_own"
on public.memo_nodes
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "memos_select_own"
on public.memos
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "memos_insert_own"
on public.memos
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "memos_update_own"
on public.memos
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "memos_delete_own"
on public.memos
for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all privileges on table public.memo_nodes
from public, anon, authenticated, service_role;

revoke all privileges on table public.memos
from public, anon, authenticated, service_role;

revoke all on function public.set_current_timestamp_updated_at()
from public, anon, authenticated, service_role;

revoke all on function public.bump_memo_node_revision()
from public, anon, authenticated, service_role;

revoke all on function public.bump_memo_revision_from_content()
from public, anon, authenticated, service_role;

revoke all on function public.validate_memo_node_tree()
from public, anon, authenticated, service_role;

revoke all on function public.validate_memo_content_node()
from public, anon, authenticated, service_role;

revoke all on function public.soft_delete_memo_node(uuid, uuid)
from public, anon, authenticated, service_role;

revoke all on function public.restore_memo_node(uuid, uuid)
from public, anon, authenticated, service_role;

revoke all on function public.permanently_delete_memo_node(uuid, uuid)
from public, anon, authenticated, service_role;

revoke all on function public.empty_memo_trash(uuid)
from public, anon, authenticated, service_role;

grant usage on schema public
to authenticated, service_role;

grant select, insert, update, delete on public.memo_nodes
to authenticated;

grant select, insert, update, delete on public.memos
to authenticated;

grant select, insert, update, delete on public.memo_nodes
to service_role;

grant select, insert, update, delete on public.memos
to service_role;

grant execute on function public.soft_delete_memo_node(uuid, uuid)
to authenticated;

grant execute on function public.restore_memo_node(uuid, uuid)
to authenticated;

grant execute on function public.permanently_delete_memo_node(uuid, uuid)
to authenticated;

grant execute on function public.empty_memo_trash(uuid)
to authenticated;
