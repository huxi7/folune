-- [INPUT]: 依赖 public.profiles、public.memo_nodes/public.memos、auth.uid()、pgcrypto 的 gen_random_uuid() 与 public.set_current_timestamp_updated_at()
-- [OUTPUT]: 把 memo_nodes.node_type 扩为含 'canvas'，建立 public.canvases/canvas_nodes/canvas_edges/memo_relations、校验触发器、克制索引、owner-only RLS 与表级 grants；四个受控 RPC 在同名 -rpc.sql 内
-- [POS]: api/supabase 的知识画布数据库契约，须先于 knowledge-canvas-rpc.sql 部署。画布不是第二套树: 它就是 node_type='canvas' 的 memo_nodes 行，因此侧边栏并列、软删除、递归恢复、sort_order 拖拽、owner-only RLS 与 revision 乐观锁全部白拿
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

set local lock_timeout = '5s';

-- --------------------------------------------------------------------------
-- 1. node_type 扩容（一次性、幂等）
-- --------------------------------------------------------------------------

-- 既有约束只允许 folder/memo。扩容而非新建表，是为了让画布沿用整棵树的既有能力。
alter table public.memo_nodes
  drop constraint if exists memo_nodes_node_type_check;

alter table public.memo_nodes
  add constraint memo_nodes_node_type_check
  check (node_type in ('folder', 'memo', 'canvas'));

-- --------------------------------------------------------------------------
-- 2. Tables
-- --------------------------------------------------------------------------

create table if not exists public.canvases (
  node_id uuid primary key
    references public.memo_nodes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- 这张画布是从哪一篇笔记探索出来的；那篇被硬删后只失去出处，画布自身仍然成立
  origin_node_id uuid references public.memo_nodes(id) on delete set null,
  origin_revision bigint
    constraint canvases_origin_revision_check
    check (origin_revision is null or origin_revision > 0),
  viewport jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint canvases_user_id_node_id_key unique (user_id, node_id),
  constraint canvases_user_node_fkey
    foreign key (user_id, node_id)
    references public.memo_nodes(user_id, id)
);

create table if not exists public.canvas_nodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  canvas_id uuid not null,
  kind text not null
    constraint canvas_nodes_kind_check
    check (kind in ('memo_ref', 'excerpt', 'native')),
  -- 简单外键而非复合: on delete set null 会把复合键的每一列都置空，连 user_id 一起，
  -- 那会撞上 not null。同租户校验因此交给 validate_canvas_node 触发器。
  target_node_id uuid references public.memo_nodes(id) on delete set null,
  -- 摘录/引用成立时目标的 revision；正文后来改了，前端据此判断锚点是否漂移
  anchored_rev bigint
    constraint canvas_nodes_anchored_rev_check
    check (anchored_rev is null or anchored_rev > 0),
  -- 段落锚点预留位（未来放 blockId）: 将来要段落级只加字段，不改表
  anchor jsonb not null default '{}'::jsonb,
  text text,
  position_x numeric(12, 4) not null default 0,
  position_y numeric(12, 4) not null default 0,
  created_by text not null
    constraint canvas_nodes_created_by_check
    check (created_by in ('user', 'ai')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint canvas_nodes_user_id_id_key unique (user_id, id),
  constraint canvas_nodes_user_canvas_fkey
    foreign key (user_id, canvas_id)
    references public.canvases(user_id, node_id)
    on delete cascade,
  -- memo_ref 的正文只能在被引用的那一篇里；晋升就是从 excerpt 走到这一行的过程。
  -- target 允许为空是给硬删留的墓碑，不是允许一开始就不指向。
  constraint canvas_nodes_shape_check check (
    (kind = 'memo_ref' and text is null)
    or (kind = 'excerpt' and text is not null)
    or (kind = 'native' and target_node_id is null and text is not null)
  )
);

create table if not exists public.canvas_edges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  canvas_id uuid not null,
  source_id uuid not null,
  target_id uuid not null,
  -- v1 只留一句人话理由，不做 relation 语义枚举: 让模型稳定判「支持还是延伸」太难，
  -- 判错用户一眼看出，信任当场归零。字段留空可加。
  rationale text,
  created_by text not null
    constraint canvas_edges_created_by_check
    check (created_by in ('user', 'ai')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint canvas_edges_user_id_id_key unique (user_id, id),
  constraint canvas_edges_not_self_check check (source_id is distinct from target_id),
  constraint canvas_edges_unique_pair unique (user_id, canvas_id, source_id, target_id),
  constraint canvas_edges_user_canvas_fkey
    foreign key (user_id, canvas_id)
    references public.canvases(user_id, node_id)
    on delete cascade,
  constraint canvas_edges_user_source_fkey
    foreign key (user_id, source_id)
    references public.canvas_nodes(user_id, id)
    on delete cascade,
  constraint canvas_edges_user_target_fkey
    foreign key (user_id, target_id)
    references public.canvas_nodes(user_id, id)
    on delete cascade
);

-- 正式关联唯一的家。AI 的临时推荐永不进这张表；用户确认后才写，反向链接反查同一张表。
create table if not exists public.memo_relations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_node_id uuid not null,
  target_node_id uuid not null,
  -- explore = AI 发现、用户确认；user = 手工建立；未来 [[双链]] 只多一种取值，不重写图模型
  origin text not null
    constraint memo_relations_origin_check
    check (origin in ('explore', 'user')),
  confidence numeric(4, 3)
    constraint memo_relations_confidence_check
    check (confidence is null or (confidence >= 0 and confidence <= 1)),
  reason text,
  -- 证据：引文、命中通道、成立时的 revision。不含正文
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memo_relations_user_id_id_key unique (user_id, id),
  constraint memo_relations_not_self_check
    check (source_node_id is distinct from target_node_id),
  constraint memo_relations_unique_pair
    unique (user_id, source_node_id, target_node_id),
  constraint memo_relations_user_source_fkey
    foreign key (user_id, source_node_id)
    references public.memo_nodes(user_id, id)
    on delete cascade,
  constraint memo_relations_user_target_fkey
    foreign key (user_id, target_node_id)
    references public.memo_nodes(user_id, id)
    on delete cascade
);

-- --------------------------------------------------------------------------
-- 3. Indexes
-- --------------------------------------------------------------------------

create index if not exists canvas_nodes_canvas_idx
  on public.canvas_nodes (user_id, canvas_id, created_at);

-- 反向链接的索引顺手就在这里: 「哪些画布引用了这一篇」
create index if not exists canvas_nodes_target_idx
  on public.canvas_nodes (user_id, target_node_id)
  where target_node_id is not null;

create index if not exists canvas_edges_canvas_idx
  on public.canvas_edges (user_id, canvas_id);

create index if not exists memo_relations_source_idx
  on public.memo_relations (user_id, source_node_id);

-- 反查方向单独建索引: 反向链接与正向链接读的是同一张表的两个方向
create index if not exists memo_relations_target_idx
  on public.memo_relations (user_id, target_node_id);

-- --------------------------------------------------------------------------
-- 4. Validators
-- --------------------------------------------------------------------------

-- 照 validate_memo_content_node 的形状: 表自己不能表达「引用的必须是本人的 canvas 节点」，
-- 因为复合外键已经被 on delete set null 的墓碑需求排除。
create or replace function public.validate_canvas_root()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  root_node_type text;
  origin_node_type text;
begin
  select node_type
  into root_node_type
  from public.memo_nodes
  where user_id = new.user_id
    and id = new.node_id;

  if not found then
    raise exception 'canvas node does not exist for this user'
      using errcode = '23503';
  end if;

  if root_node_type <> 'canvas' then
    raise exception 'canvas must reference a canvas node'
      using errcode = '23514';
  end if;

  if new.origin_node_id is not null then
    select node_type
    into origin_node_type
    from public.memo_nodes
    where user_id = new.user_id
      and id = new.origin_node_id;

    if not found then
      raise exception 'canvas origin node does not exist for this user'
        using errcode = '23503';
    end if;

    if origin_node_type <> 'memo' then
      raise exception 'canvas origin must be a memo node'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.validate_canvas_node()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_type text;
begin
  if new.target_node_id is null then
    return new;
  end if;

  select node_type
  into target_type
  from public.memo_nodes
  where user_id = new.user_id
    and id = new.target_node_id;

  if not found then
    raise exception 'canvas card target does not exist for this user'
      using errcode = '23503';
  end if;

  -- 卡片只引用笔记。画布引用画布是嵌套，而画布卡片永不原地展开、只跳转，深度恒为 1。
  if target_type <> 'memo' then
    raise exception 'canvas card target must be a memo node'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.validate_memo_relation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  endpoint_count integer;
begin
  select count(*)
  into endpoint_count
  from public.memo_nodes
  where user_id = new.user_id
    and id in (new.source_node_id, new.target_node_id)
    and node_type = 'memo';

  if endpoint_count <> 2 then
    raise exception 'memo relation endpoints must both be memo nodes of this user'
      using errcode = '23503';
  end if;

  return new;
end;
$$;

create or replace trigger canvases_set_updated_at
before update on public.canvases
for each row
execute function public.set_current_timestamp_updated_at();

create or replace trigger canvases_validate_root
before insert or update of user_id, node_id, origin_node_id
on public.canvases
for each row
execute function public.validate_canvas_root();

create or replace trigger canvas_nodes_set_updated_at
before update on public.canvas_nodes
for each row
execute function public.set_current_timestamp_updated_at();

create or replace trigger canvas_nodes_validate_target
before insert or update of user_id, target_node_id
on public.canvas_nodes
for each row
execute function public.validate_canvas_node();

create or replace trigger canvas_edges_set_updated_at
before update on public.canvas_edges
for each row
execute function public.set_current_timestamp_updated_at();

create or replace trigger memo_relations_set_updated_at
before update on public.memo_relations
for each row
execute function public.set_current_timestamp_updated_at();

create or replace trigger memo_relations_validate_endpoints
before insert or update of user_id, source_node_id, target_node_id
on public.memo_relations
for each row
execute function public.validate_memo_relation();

-- --------------------------------------------------------------------------
-- 5. RLS
-- --------------------------------------------------------------------------

alter table public.canvases enable row level security;
alter table public.canvas_nodes enable row level security;
alter table public.canvas_edges enable row level security;
alter table public.memo_relations enable row level security;

-- --------------------------------------------------------------------------
-- Policies: 每张表四条 <table>_<verb>_own，判据统一是 (select auth.uid()) = user_id
-- --------------------------------------------------------------------------

drop policy if exists "canvases_select_own" on public.canvases;
create policy "canvases_select_own"
on public.canvases
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "canvases_insert_own" on public.canvases;
create policy "canvases_insert_own"
on public.canvases
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "canvases_update_own" on public.canvases;
create policy "canvases_update_own"
on public.canvases
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "canvases_delete_own" on public.canvases;
create policy "canvases_delete_own"
on public.canvases
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "canvas_nodes_select_own" on public.canvas_nodes;
create policy "canvas_nodes_select_own"
on public.canvas_nodes
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "canvas_nodes_insert_own" on public.canvas_nodes;
create policy "canvas_nodes_insert_own"
on public.canvas_nodes
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "canvas_nodes_update_own" on public.canvas_nodes;
create policy "canvas_nodes_update_own"
on public.canvas_nodes
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "canvas_nodes_delete_own" on public.canvas_nodes;
create policy "canvas_nodes_delete_own"
on public.canvas_nodes
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "canvas_edges_select_own" on public.canvas_edges;
create policy "canvas_edges_select_own"
on public.canvas_edges
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "canvas_edges_insert_own" on public.canvas_edges;
create policy "canvas_edges_insert_own"
on public.canvas_edges
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "canvas_edges_update_own" on public.canvas_edges;
create policy "canvas_edges_update_own"
on public.canvas_edges
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "canvas_edges_delete_own" on public.canvas_edges;
create policy "canvas_edges_delete_own"
on public.canvas_edges
for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "memo_relations_select_own" on public.memo_relations;
create policy "memo_relations_select_own"
on public.memo_relations
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "memo_relations_insert_own" on public.memo_relations;
create policy "memo_relations_insert_own"
on public.memo_relations
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "memo_relations_update_own" on public.memo_relations;
create policy "memo_relations_update_own"
on public.memo_relations
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "memo_relations_delete_own" on public.memo_relations;
create policy "memo_relations_delete_own"
on public.memo_relations
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- --------------------------------------------------------------------------
-- 6. Grants
-- --------------------------------------------------------------------------

revoke all privileges on table public.canvases
from public, anon, authenticated, service_role;

revoke all privileges on table public.canvas_nodes
from public, anon, authenticated, service_role;

revoke all privileges on table public.canvas_edges
from public, anon, authenticated, service_role;

revoke all privileges on table public.memo_relations
from public, anon, authenticated, service_role;

grant select, insert, update, delete on public.canvases
to authenticated;

grant select, insert, update, delete on public.canvas_nodes
to authenticated;

grant select, insert, update, delete on public.canvas_edges
to authenticated;

grant select, insert, update, delete on public.memo_relations
to authenticated;

grant select, insert, update, delete on public.canvases
to service_role;

grant select, insert, update, delete on public.canvas_nodes
to service_role;

grant select, insert, update, delete on public.canvas_edges
to service_role;

grant select, insert, update, delete on public.memo_relations
to service_role;
