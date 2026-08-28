-- [INPUT]: 依赖现有 memo_nodes/memos、Knowledge Canvas 三表、profiles、auth.uid() 与 extensions.pgcrypto
-- [OUTPUT]: 把旧画布数据就地扩展为 Canvas V2：唯一身份/版本、快照、空间文字尺寸/缩放、无向边约束、语料版本、AI checkpoint、mutation receipt、RLS/grants 与删除前快照冻结
-- [POS]: api/supabase 的 Canvas V2 加法 Schema 迁移；保留旧列与旧 RPC 供稳定切轨/回滚，任何 V2 写入规则由 canvas-v2-rpc.sql 的统一 mutation 内核承载
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

set local lock_timeout = '5s';

-- --------------------------------------------------------------------------
-- 1. Canvas 唯一身份与版本
-- --------------------------------------------------------------------------

alter table public.canvases
  add column canvas_kind text,
  add column version bigint;

update public.canvases
set canvas_kind = case
      when origin_node_id is null then 'standalone'
      else 'memo_default'
    end,
    version = 1;

alter table public.canvases
  alter column canvas_kind set not null,
  alter column canvas_kind set default 'standalone',
  alter column version set not null,
  alter column version set default 0,
  add constraint canvases_canvas_kind_check
    check (canvas_kind in ('memo_default', 'standalone')),
  add constraint canvases_version_check
    check (version >= 0),
  add constraint canvases_kind_origin_check
    check (
      (canvas_kind = 'memo_default' and origin_node_id is not null)
      or (canvas_kind = 'standalone' and origin_node_id is null)
    );

create unique index canvases_default_origin_unique
  on public.canvases (user_id, origin_node_id)
  where canvas_kind = 'memo_default' and origin_node_id is not null;

create index canvases_origin_lookup_idx
  on public.canvases (user_id, origin_node_id)
  where origin_node_id is not null;

create or replace function public.normalize_canvas_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.origin_node_id is null then
    new.canvas_kind := 'standalone';
    new.origin_revision := null;
  elsif new.canvas_kind = 'standalone' then
    raise exception 'standalone canvas cannot keep an origin memo'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger canvases_normalize_identity
before insert or update of canvas_kind, origin_node_id
on public.canvases
for each row
execute function public.normalize_canvas_identity();

-- --------------------------------------------------------------------------
-- 2. 节点快照、文字尺寸与同 Canvas 引用
-- --------------------------------------------------------------------------

alter table public.canvas_nodes
  add column snapshot_title text,
  add column snapshot_excerpt text,
  add column snapshot_revision bigint,
  add column discovered_from_id uuid,
  add column width numeric(12, 4),
  add column height numeric(12, 4);

update public.canvas_nodes cn
set snapshot_title = coalesce(target.title, '已删除的笔记'),
    snapshot_excerpt = body.excerpt,
    snapshot_revision = coalesce(target.revision, cn.anchored_rev)
from public.memo_nodes target
left join public.memos body
  on body.user_id = target.user_id
 and body.node_id = target.id
where target.user_id = cn.user_id
  and target.id = cn.target_node_id
  and cn.kind = 'memo_ref';

update public.canvas_nodes
set width = 240,
    height = 120
where kind in ('native', 'excerpt');

alter table public.canvas_nodes
  add constraint canvas_nodes_snapshot_revision_check
    check (snapshot_revision is null or snapshot_revision > 0),
  add constraint canvas_nodes_dimensions_check
    check (
      (width is null and height is null)
      or (
        width between 20 and 2880
        and height between 24 and 3840
      )
    ),
  add constraint canvas_nodes_text_scale_check
    check (
      not (metadata ? 'text_scale')
      or (
        jsonb_typeof(metadata->'text_scale') = 'number'
        and (metadata->>'text_scale')::numeric between 0.25 and 8
      )
    ),
  add constraint canvas_nodes_canvas_id_id_key unique (canvas_id, id);

create unique index canvas_nodes_memo_projection_unique
  on public.canvas_nodes (canvas_id, target_node_id)
  where target_node_id is not null;

alter table public.canvas_nodes
  add constraint canvas_nodes_discovered_from_fkey
  foreign key (canvas_id, discovered_from_id)
  references public.canvas_nodes(canvas_id, id)
  on delete set null (discovered_from_id);

create index canvas_nodes_discovered_from_idx
  on public.canvas_nodes (canvas_id, discovered_from_id)
  where discovered_from_id is not null;

-- --------------------------------------------------------------------------
-- 3. 无向边唯一性与端点归属
-- --------------------------------------------------------------------------

alter table public.canvas_edges
  drop constraint canvas_edges_unique_pair,
  add column endpoint_low uuid generated always as (least(source_id, target_id)) stored,
  add column endpoint_high uuid generated always as (greatest(source_id, target_id)) stored,
  add constraint canvas_edges_undirected_unique
    unique (canvas_id, endpoint_low, endpoint_high),
  add constraint canvas_edges_source_canvas_fkey
    foreign key (canvas_id, source_id)
    references public.canvas_nodes(canvas_id, id)
    on delete cascade,
  add constraint canvas_edges_target_canvas_fkey
    foreign key (canvas_id, target_id)
    references public.canvas_nodes(canvas_id, id)
    on delete cascade;

create index canvas_edges_user_source_idx
  on public.canvas_edges (user_id, source_id);

create index canvas_edges_user_target_idx
  on public.canvas_edges (user_id, target_id);

-- --------------------------------------------------------------------------
-- 4. 语料版本、Expansion checkpoint 与 Mutation receipt
-- --------------------------------------------------------------------------

create table public.memo_corpus_versions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  version bigint not null default 0 check (version >= 0),
  updated_at timestamptz not null default now()
);

insert into public.memo_corpus_versions (user_id, version)
select distinct user_id, 1
from public.memos
on conflict (user_id) do nothing;

create table public.canvas_expansions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  canvas_id uuid not null,
  source_canvas_node_id uuid not null,
  source_revision bigint not null check (source_revision > 0),
  corpus_version bigint not null check (corpus_version >= 0),
  request_id uuid not null,
  completion_status text not null
    check (completion_status in ('complete', 'incomplete_due_to_capacity')),
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (canvas_id, source_canvas_node_id),
  constraint canvas_expansions_user_canvas_fkey
    foreign key (user_id, canvas_id)
    references public.canvases(user_id, node_id)
    on delete cascade,
  constraint canvas_expansions_source_canvas_fkey
    foreign key (canvas_id, source_canvas_node_id)
    references public.canvas_nodes(canvas_id, id)
    on delete cascade
);

create index canvas_expansions_user_canvas_idx
  on public.canvas_expansions (user_id, canvas_id);

create table public.canvas_mutation_receipts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  canvas_id uuid not null,
  mutation_id uuid not null,
  intent_digest text not null check (intent_digest ~ '^[0-9a-f]{64}$'),
  base_version bigint not null check (base_version >= 0),
  new_version bigint not null check (new_version > base_version),
  response jsonb not null check (jsonb_typeof(response) = 'object'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  primary key (canvas_id, mutation_id),
  constraint canvas_mutation_receipts_user_canvas_fkey
    foreign key (user_id, canvas_id)
    references public.canvases(user_id, node_id)
    on delete cascade,
  constraint canvas_mutation_receipts_expiry_check
    check (expires_at >= created_at + interval '30 days')
);

create index canvas_mutation_receipts_expiry_idx
  on public.canvas_mutation_receipts (expires_at);

-- --------------------------------------------------------------------------
-- 5. 语料版本只跟随完整 memo 事实推进
-- --------------------------------------------------------------------------

create or replace function public.bump_corpus_after_memo_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
    or (tg_op = 'UPDATE' and new.content_mdx is distinct from old.content_mdx)
  then
    insert into public.memo_corpus_versions (user_id, version)
    values (new.user_id, 1)
    on conflict (user_id) do update
    set version = public.memo_corpus_versions.version + 1,
        updated_at = now();
  end if;

  return new;
end;
$$;

create or replace function public.bump_corpus_after_memo_node_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.node_type = 'memo' then
      insert into public.memo_corpus_versions (user_id, version)
      values (old.user_id, 1)
      on conflict (user_id) do update
      set version = public.memo_corpus_versions.version + 1,
          updated_at = now();
    end if;
    return old;
  end if;

  if new.node_type = 'memo' and (
    new.title is distinct from old.title
    or new.parent_id is distinct from old.parent_id
    or new.deleted_at is distinct from old.deleted_at
  ) then
    insert into public.memo_corpus_versions (user_id, version)
    values (new.user_id, 1)
    on conflict (user_id) do update
    set version = public.memo_corpus_versions.version + 1,
        updated_at = now();
  end if;

  return new;
end;
$$;

create trigger memos_bump_corpus_version
after insert or update of content_mdx
on public.memos
for each row
execute function public.bump_corpus_after_memo_write();

create trigger memo_nodes_bump_corpus_version
after update of title, parent_id, deleted_at or delete
on public.memo_nodes
for each row
execute function public.bump_corpus_after_memo_node_change();

-- 硬删前冻结最后可见标题/摘要/revision；随后 FK 只清 target，不清解释信息。
create or replace function public.freeze_canvas_snapshot_before_memo_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.node_type = 'memo' then
    update public.canvas_nodes cn
    set snapshot_title = old.title,
        snapshot_excerpt = body.excerpt,
        snapshot_revision = old.revision
    from public.memos body
    where body.user_id = old.user_id
      and body.node_id = old.id
      and cn.user_id = old.user_id
      and cn.target_node_id = old.id;
  end if;

  return old;
end;
$$;

create trigger memo_nodes_freeze_canvas_snapshot
before delete on public.memo_nodes
for each row
execute function public.freeze_canvas_snapshot_before_memo_delete();

create trigger memo_corpus_versions_set_updated_at
before update on public.memo_corpus_versions
for each row
execute function public.set_current_timestamp_updated_at();

create trigger canvas_expansions_set_updated_at
before update on public.canvas_expansions
for each row
execute function public.set_current_timestamp_updated_at();

-- --------------------------------------------------------------------------
-- 6. RLS、显式 grants 与内部函数权限
-- --------------------------------------------------------------------------

alter table public.memo_corpus_versions enable row level security;
alter table public.canvas_expansions enable row level security;
alter table public.canvas_mutation_receipts enable row level security;

create policy "memo_corpus_versions_select_own"
on public.memo_corpus_versions for select to authenticated
using ((select auth.uid()) = user_id);

create policy "memo_corpus_versions_insert_own"
on public.memo_corpus_versions for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "memo_corpus_versions_update_own"
on public.memo_corpus_versions for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "canvas_expansions_select_own"
on public.canvas_expansions for select to authenticated
using ((select auth.uid()) = user_id);

create policy "canvas_expansions_insert_own"
on public.canvas_expansions for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "canvas_expansions_update_own"
on public.canvas_expansions for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "canvas_expansions_delete_own"
on public.canvas_expansions for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "canvas_mutation_receipts_select_own"
on public.canvas_mutation_receipts for select to authenticated
using ((select auth.uid()) = user_id);

create policy "canvas_mutation_receipts_insert_own"
on public.canvas_mutation_receipts for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "canvas_mutation_receipts_delete_own"
on public.canvas_mutation_receipts for delete to authenticated
using ((select auth.uid()) = user_id);

revoke all privileges on table public.memo_corpus_versions
from public, anon, authenticated, service_role;
revoke all privileges on table public.canvas_expansions
from public, anon, authenticated, service_role;
revoke all privileges on table public.canvas_mutation_receipts
from public, anon, authenticated, service_role;

grant select, insert, update on public.memo_corpus_versions to authenticated;
grant select, insert, update, delete on public.canvas_expansions to authenticated;
grant select, insert, delete on public.canvas_mutation_receipts to authenticated;

grant select, insert, update, delete on public.memo_corpus_versions to service_role;
grant select, insert, update, delete on public.canvas_expansions to service_role;
grant select, insert, update, delete on public.canvas_mutation_receipts to service_role;

revoke all on function public.normalize_canvas_identity()
from public, anon, authenticated, service_role;
revoke all on function public.bump_corpus_after_memo_write()
from public, anon, authenticated, service_role;
revoke all on function public.bump_corpus_after_memo_node_change()
from public, anon, authenticated, service_role;
revoke all on function public.freeze_canvas_snapshot_before_memo_delete()
from public, anon, authenticated, service_role;
