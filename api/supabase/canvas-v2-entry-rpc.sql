-- [INPUT]: 依赖 canvas-v2-schema.sql 扩展后的 Canvas 表、memo tree/RLS、extensions.pgcrypto 与 auth.uid()
-- [OUTPUT]: 提供默认/空白 Canvas 创建、V2 读取与可信 expansion context 四个 SECURITY INVOKER RPC
-- [POS]: api/supabase 的 Canvas V2 会话入口与只读投影层；创建只建立持久身份，后续人工/AI 修改统一交给 canvas-v2-mutation-rpc.sql
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

set local lock_timeout = '5s';

-- --------------------------------------------------------------------------
-- 1. 创建或进入持久 Canvas
-- --------------------------------------------------------------------------

create or replace function public.get_or_create_memo_canvas(
  p_user_id uuid,
  p_memo_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source public.memo_nodes%rowtype;
  tree_node public.memo_nodes%rowtype;
  canvas_row public.canvases%rowtype;
  root_node public.canvas_nodes%rowtype;
  next_order numeric;
  created boolean := false;
begin
  if (select auth.uid()) is distinct from p_user_id then
    return jsonb_build_object('status', 'not_found');
  end if;

  select *
  into source
  from public.memo_nodes
  where user_id = p_user_id
    and id = p_memo_id
    and node_type = 'memo'
    and deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('status', 'memo_not_found');
  end if;

  -- memo_nodes 与 memos 分两步写入；只在正文已经完整落库后创建默认 Canvas，
  -- 避免并发打开撞上半成品笔记，留下没有根引用的孤立 Canvas。
  perform 1
  from public.memos body
  where body.user_id = p_user_id
    and body.node_id = source.id
  for share;

  if not found then
    return jsonb_build_object('status', 'memo_not_found');
  end if;

  -- 已进回收站的旧默认 Canvas 保留自身，但脱离 origin，给新的 active 默认 Canvas 让出唯一位。
  update public.canvases c
  set canvas_kind = 'standalone',
      origin_node_id = null,
      origin_revision = null
  where c.user_id = p_user_id
    and c.canvas_kind = 'memo_default'
    and c.origin_node_id = source.id
    and exists (
      select 1
      from public.memo_nodes deleted_canvas
      where deleted_canvas.user_id = c.user_id
        and deleted_canvas.id = c.node_id
        and deleted_canvas.deleted_at is not null
    );

  select c.*
  into canvas_row
  from public.canvases c
  join public.memo_nodes n
    on n.user_id = c.user_id
   and n.id = c.node_id
  where c.user_id = p_user_id
    and c.canvas_kind = 'memo_default'
    and c.origin_node_id = source.id
    and n.deleted_at is null
  for update of c;

  if not found then
    select coalesce(max(sibling.sort_order) + 1000, 1000)
    into next_order
    from public.memo_nodes sibling
    where sibling.user_id = p_user_id
      and sibling.parent_id is not distinct from source.parent_id
      and sibling.deleted_at is null;

    insert into public.memo_nodes (
      user_id, parent_id, node_type, title, sort_order
    )
    values (
      p_user_id,
      source.parent_id,
      'canvas',
      left(source.title || ' · 画布', 500),
      next_order
    )
    returning * into tree_node;

    insert into public.canvases (
      node_id, user_id, canvas_kind, origin_node_id, origin_revision, version
    )
    values (
      tree_node.id, p_user_id, 'memo_default', source.id, source.revision, 1
    )
    returning * into canvas_row;

    insert into public.canvas_nodes (
      user_id, canvas_id, kind, target_node_id, anchored_rev,
      snapshot_title, snapshot_excerpt, snapshot_revision,
      position_x, position_y, created_by
    )
    select
      p_user_id, canvas_row.node_id, 'memo_ref', source.id, source.revision,
      source.title, body.excerpt, source.revision,
      0, 0, 'user'
    from public.memos body
    where body.user_id = p_user_id
      and body.node_id = source.id
    returning * into root_node;

    created := true;
  else
    select *
    into tree_node
    from public.memo_nodes
    where user_id = p_user_id
      and id = canvas_row.node_id;

    select *
    into root_node
    from public.canvas_nodes
    where user_id = p_user_id
      and canvas_id = canvas_row.node_id
      and target_node_id = source.id
    limit 1;

    if not found then
      insert into public.canvas_nodes (
        user_id, canvas_id, kind, target_node_id, anchored_rev,
        snapshot_title, snapshot_excerpt, snapshot_revision,
        position_x, position_y, created_by
      )
      select
        p_user_id, canvas_row.node_id, 'memo_ref', source.id, source.revision,
        source.title, body.excerpt, source.revision,
        0, 0, 'user'
      from public.memos body
      where body.user_id = p_user_id
        and body.node_id = source.id
      returning * into root_node;

      update public.canvases
      set version = version + 1
      where user_id = p_user_id
        and node_id = canvas_row.node_id
      returning * into canvas_row;
    end if;
  end if;

  return jsonb_build_object(
    'status', case when created then 'created' else 'existing' end,
    'canvas', to_jsonb(canvas_row),
    'node', to_jsonb(tree_node),
    'focus_node_id', root_node.id
  );
end;
$$;

create or replace function public.create_standalone_canvas(
  p_user_id uuid,
  p_title text,
  p_parent_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_type text;
  next_order numeric;
  tree_node public.memo_nodes%rowtype;
  canvas_row public.canvases%rowtype;
begin
  if (select auth.uid()) is distinct from p_user_id then
    return jsonb_build_object('status', 'not_found');
  end if;

  if length(btrim(coalesce(p_title, ''))) = 0
    or length(btrim(p_title)) > 500
  then
    return jsonb_build_object('status', 'invalid', 'error_code', 'CANVAS_TITLE_INVALID');
  end if;

  if p_parent_id is not null then
    select node_type
    into parent_type
    from public.memo_nodes
    where user_id = p_user_id
      and id = p_parent_id
      and deleted_at is null;

    if not found or parent_type <> 'folder' then
      return jsonb_build_object('status', 'parent_not_found');
    end if;
  end if;

  select coalesce(max(sort_order) + 1000, 1000)
  into next_order
  from public.memo_nodes
  where user_id = p_user_id
    and parent_id is not distinct from p_parent_id
    and deleted_at is null;

  insert into public.memo_nodes (
    user_id, parent_id, node_type, title, sort_order
  )
  values (
    p_user_id, p_parent_id, 'canvas', btrim(p_title), next_order
  )
  returning * into tree_node;

  insert into public.canvases (
    node_id, user_id, canvas_kind, origin_node_id, origin_revision, version
  )
  values (
    tree_node.id, p_user_id, 'standalone', null, null, 0
  )
  returning * into canvas_row;

  return jsonb_build_object(
    'status', 'created',
    'canvas', to_jsonb(canvas_row),
    'node', to_jsonb(tree_node),
    'focus_node_id', null
  );
end;
$$;

-- --------------------------------------------------------------------------
-- 2. V2 读取：正文永不进入 Canvas 载荷
-- --------------------------------------------------------------------------

create or replace function public.read_canvas_v2(
  p_user_id uuid,
  p_canvas_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  tree_node public.memo_nodes%rowtype;
  canvas_row public.canvases%rowtype;
begin
  if (select auth.uid()) is distinct from p_user_id then
    return jsonb_build_object('status', 'not_found');
  end if;

  select *
  into tree_node
  from public.memo_nodes
  where user_id = p_user_id
    and id = p_canvas_id
    and node_type = 'canvas'
    and deleted_at is null;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  select *
  into canvas_row
  from public.canvases
  where user_id = p_user_id
    and node_id = p_canvas_id;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'canvas', to_jsonb(canvas_row),
    'node', to_jsonb(tree_node),
    'nodes', coalesce((
      select jsonb_agg(node_payload order by created_at, id)
      from (
        select
          cn.created_at,
          cn.id,
          jsonb_build_object(
            'id', cn.id,
            'kind', case when cn.kind = 'excerpt' then 'native' else cn.kind end,
            'target_node_id', cn.target_node_id,
            'snapshot_title', coalesce(cn.snapshot_title, '已删除的笔记'),
            'snapshot_excerpt', cn.snapshot_excerpt,
            'snapshot_revision', cn.snapshot_revision,
            'discovered_from_id', cn.discovered_from_id,
            'text', cn.text,
            'x', cn.position_x,
            'y', cn.position_y,
            'width', case
              when cn.kind in ('native', 'excerpt') then coalesce(cn.width, 240)
              else null
            end,
            'height', case
              when cn.kind in ('native', 'excerpt') then coalesce(cn.height, 120)
              else null
            end,
            'created_by', cn.created_by,
            'target', case
              when target.id is null then null
              else jsonb_build_object(
                'node_id', target.id,
                'title', target.title,
                'revision', target.revision,
                'deleted_at', target.deleted_at,
                'excerpt', body.excerpt
              )
            end
          ) as node_payload
        from public.canvas_nodes cn
        left join public.memo_nodes target
          on target.user_id = cn.user_id
         and target.id = cn.target_node_id
        left join public.memos body
          on body.user_id = target.user_id
         and body.node_id = target.id
        where cn.user_id = p_user_id
          and cn.canvas_id = p_canvas_id
      ) payloads
    ), '[]'::jsonb),
    'edges', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', edge.id,
        'source_id', edge.source_id,
        'target_id', edge.target_id,
        'rationale', edge.rationale,
        'created_by', edge.created_by
      ) order by edge.created_at, edge.id)
      from public.canvas_edges edge
      where edge.user_id = p_user_id
        and edge.canvas_id = p_canvas_id
    ), '[]'::jsonb)
  );
end;
$$;

-- --------------------------------------------------------------------------
-- 3. AI 只读可信上下文
-- --------------------------------------------------------------------------

create or replace function public.read_canvas_expansion_context(
  p_user_id uuid,
  p_canvas_id uuid,
  p_source_canvas_node_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  canvas_row public.canvases%rowtype;
  source_card public.canvas_nodes%rowtype;
  source_memo public.memo_nodes%rowtype;
  source_body public.memos%rowtype;
  checkpoint public.canvas_expansions%rowtype;
  corpus_version bigint := 0;
begin
  if (select auth.uid()) is distinct from p_user_id then
    return jsonb_build_object('status', 'not_found');
  end if;

  select c.*
  into canvas_row
  from public.canvases c
  join public.memo_nodes n
    on n.user_id = c.user_id
   and n.id = c.node_id
  where c.user_id = p_user_id
    and c.node_id = p_canvas_id
    and n.deleted_at is null;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  select *
  into source_card
  from public.canvas_nodes
  where user_id = p_user_id
    and canvas_id = p_canvas_id
    and id = p_source_canvas_node_id
    and kind = 'memo_ref'
    and target_node_id is not null;

  if not found then
    return jsonb_build_object('status', 'invalid_source');
  end if;

  select n.*
  into source_memo
  from public.memo_nodes n
  where n.user_id = p_user_id
    and n.id = source_card.target_node_id
    and n.node_type = 'memo'
    and n.deleted_at is null;

  if not found then
    return jsonb_build_object('status', 'invalid_source');
  end if;

  select *
  into source_body
  from public.memos
  where user_id = p_user_id
    and node_id = source_memo.id;

  if not found then
    return jsonb_build_object('status', 'invalid_source');
  end if;

  select coalesce(version, 0)
  into corpus_version
  from public.memo_corpus_versions
  where user_id = p_user_id;

  select *
  into checkpoint
  from public.canvas_expansions
  where user_id = p_user_id
    and canvas_id = p_canvas_id
    and source_canvas_node_id = p_source_canvas_node_id;

  return jsonb_build_object(
    'status', 'ok',
    'canvas_version', canvas_row.version,
    'corpus_version', coalesce(corpus_version, 0),
    'source', jsonb_build_object(
      'canvas_node_id', source_card.id,
      'memo_id', source_memo.id,
      'title', source_memo.title,
      'excerpt', source_body.excerpt,
      'revision', source_memo.revision
    ),
    'checkpoint', case when checkpoint.canvas_id is null then null else to_jsonb(checkpoint) end,
    'neighbor_memo_ids', coalesce((
      select jsonb_agg(distinct neighbor.target_node_id)
      from public.canvas_edges edge
      join public.canvas_nodes neighbor
        on neighbor.user_id = edge.user_id
       and neighbor.canvas_id = edge.canvas_id
       and neighbor.id = case
         when edge.source_id = p_source_canvas_node_id then edge.target_id
         else edge.source_id
       end
      where edge.user_id = p_user_id
        and edge.canvas_id = p_canvas_id
        and p_source_canvas_node_id in (edge.source_id, edge.target_id)
        and neighbor.target_node_id is not null
    ), '[]'::jsonb)
  );
end;
$$;

-- --------------------------------------------------------------------------
-- 4. 显式函数权限
-- --------------------------------------------------------------------------

revoke all on function public.get_or_create_memo_canvas(uuid, uuid)
from public, anon, authenticated, service_role;
revoke all on function public.create_standalone_canvas(uuid, text, uuid)
from public, anon, authenticated, service_role;
revoke all on function public.read_canvas_v2(uuid, uuid)
from public, anon, authenticated, service_role;
revoke all on function public.read_canvas_expansion_context(uuid, uuid, uuid)
from public, anon, authenticated, service_role;

grant execute on function public.get_or_create_memo_canvas(uuid, uuid)
to authenticated;
grant execute on function public.create_standalone_canvas(uuid, text, uuid)
to authenticated;
grant execute on function public.read_canvas_v2(uuid, uuid)
to authenticated;
grant execute on function public.read_canvas_expansion_context(uuid, uuid, uuid)
to authenticated;
