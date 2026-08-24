-- [INPUT]: 依赖 knowledge-canvas.sql 建立的 public.canvases/canvas_nodes/canvas_edges/memo_relations、public.memo_nodes/public.memos 与 auth.uid()
-- [OUTPUT]: 提供 save_exploration_canvas 保存、read_canvas 单次往返读取、update_canvas_layout 视口与坐标、promote_canvas_node 原子晋升四个 SECURITY INVOKER RPC 及其显式 grants
-- [POS]: api/supabase 的知识画布受控写入口。表可以被 PostgREST 直接读、单行插入（如往画布上放一张卡片）也直接走 PostgREST，但凡是「多张表必须一起成立」的动作只走这里: 保存要么四张表齐备要么当没发生，晋升要么内容搬完且旧位置置空要么原样不动
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

set local lock_timeout = '5s';

-- --------------------------------------------------------------------------
-- 1. 保存探索结果
-- --------------------------------------------------------------------------

-- p_items 的每一项形如:
--   { "node_id": uuid, "revision": bigint, "reason": text, "confidence": numeric,
--     "excerpt": text, "matched_channels": [text], "x": numeric, "y": numeric }
-- 四张表在同一事务内落地: 树节点、画布、卡片与边、正式关联。任何一步失败则整次保存不存在。
create or replace function public.save_exploration_canvas(
  p_user_id uuid,
  p_title text,
  p_parent_id uuid default null,
  p_sort_order numeric default 1000,
  p_origin_node_id uuid default null,
  p_viewport jsonb default '{}'::jsonb,
  p_items jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  origin public.memo_nodes%rowtype;
  parent_type text;
  tree_node public.memo_nodes%rowtype;
  canvas_row public.canvases%rowtype;
  center_id uuid;
  item jsonb;
  target public.memo_nodes%rowtype;
  card_id uuid;
  saved integer := 0;
  skipped integer := 0;
begin
  if (select auth.uid()) is distinct from p_user_id then
    return jsonb_build_object('status', 'not_found');
  end if;

  if length(btrim(coalesce(p_title, ''))) = 0 then
    return jsonb_build_object(
      'status', 'invalid',
      'error_code', 'CANVAS_TITLE_EMPTY'
    );
  end if;

  -- 出处必须是本人的 active 笔记: 画布的中心卡片就是它
  select *
  into origin
  from public.memo_nodes
  where user_id = p_user_id
    and id = p_origin_node_id
    and node_type = 'memo'
    and deleted_at is null;

  if not found then
    return jsonb_build_object('status', 'origin_not_found');
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

  insert into public.memo_nodes (
    user_id, parent_id, node_type, title, sort_order
  )
  values (
    p_user_id, p_parent_id, 'canvas', btrim(p_title), coalesce(p_sort_order, 1000)
  )
  returning * into tree_node;

  insert into public.canvases (
    node_id, user_id, origin_node_id, origin_revision, viewport
  )
  values (
    tree_node.id, p_user_id, origin.id, origin.revision,
    coalesce(p_viewport, '{}'::jsonb)
  )
  returning * into canvas_row;

  -- 中心卡片就是那张纸自己，由用户的手势产生，故 created_by = 'user'
  insert into public.canvas_nodes (
    user_id, canvas_id, kind, target_node_id, anchored_rev, created_by,
    position_x, position_y
  )
  values (
    p_user_id, tree_node.id, 'memo_ref', origin.id, origin.revision, 'user', 0, 0
  )
  returning id into center_id;

  for item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    select *
    into target
    from public.memo_nodes
    where user_id = p_user_id
      and id = (item->>'node_id')::uuid
      and node_type = 'memo'
      and deleted_at is null;

    -- 探索到保存之间那一篇可能已被删除或就是中心自己；跳过并如实计数，
    -- 而不是让整次保存失败——用户已经看过那些卡片，保存不该因为一条失联而全废。
    if not found or target.id = origin.id then
      skipped := skipped + 1;
      continue;
    end if;

    insert into public.canvas_nodes (
      user_id, canvas_id, kind, target_node_id, anchored_rev, created_by,
      position_x, position_y
    )
    values (
      p_user_id, tree_node.id, 'memo_ref', target.id,
      coalesce((item->>'revision')::bigint, target.revision), 'ai',
      coalesce((item->>'x')::numeric, 0), coalesce((item->>'y')::numeric, 0)
    )
    returning id into card_id;

    insert into public.canvas_edges (
      user_id, canvas_id, source_id, target_id, rationale, created_by
    )
    values (
      p_user_id, tree_node.id, center_id, card_id,
      nullif(btrim(coalesce(item->>'reason', '')), ''), 'ai'
    );

    -- 用户按下保存的那一刻，AI 的推荐才成为正式关联
    insert into public.memo_relations (
      user_id, source_node_id, target_node_id, origin, confidence, reason, evidence
    )
    values (
      p_user_id, origin.id, target.id, 'explore',
      (item->>'confidence')::numeric,
      nullif(btrim(coalesce(item->>'reason', '')), ''),
      jsonb_strip_nulls(jsonb_build_object(
        'excerpt', item->>'excerpt',
        'matched_channels', item->'matched_channels',
        'anchored_rev', coalesce((item->>'revision')::bigint, target.revision)
      ))
    )
    on conflict (user_id, source_node_id, target_node_id) do update
    set confidence = excluded.confidence,
        reason = excluded.reason,
        evidence = excluded.evidence;

    saved := saved + 1;
  end loop;

  return jsonb_build_object(
    'status', 'created',
    'canvas', to_jsonb(canvas_row),
    'node', to_jsonb(tree_node),
    'card_count', saved,
    'skipped_count', skipped
  );
end;
$$;

-- --------------------------------------------------------------------------
-- 2. 读取画布
-- --------------------------------------------------------------------------

-- 一次往返取回整张画布。正文永不进入返回载荷: 引用卡片只带目标的标题与既有摘要，
-- 卡片自己的 text 只有摘录/原生卡片才有，那本来就是画布上的内容而不是笔记正文副本。
create or replace function public.read_canvas(
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
    'cards', coalesce((
      select jsonb_agg(card order by card_created_at)
      from (
        select
          cn.created_at as card_created_at,
          jsonb_build_object(
            'id', cn.id,
            'kind', cn.kind,
            'target_node_id', cn.target_node_id,
            'anchored_rev', cn.anchored_rev,
            'anchor', cn.anchor,
            'text', cn.text,
            'position_x', cn.position_x,
            'position_y', cn.position_y,
            'created_by', cn.created_by,
            'target', case
              when target_node.id is null then null
              else jsonb_build_object(
                'node_id', target_node.id,
                'title', target_node.title,
                'revision', target_node.revision,
                'deleted_at', target_node.deleted_at,
                'excerpt', target_memo.excerpt
              )
            end
          ) as card
        from public.canvas_nodes cn
        left join public.memo_nodes target_node
          on target_node.user_id = cn.user_id
         and target_node.id = cn.target_node_id
        left join public.memos target_memo
          on target_memo.user_id = cn.user_id
         and target_memo.node_id = cn.target_node_id
        where cn.user_id = p_user_id
          and cn.canvas_id = p_canvas_id
      ) as cards
    ), '[]'::jsonb),
    'edges', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ce.id,
        'source_id', ce.source_id,
        'target_id', ce.target_id,
        'rationale', ce.rationale,
        'created_by', ce.created_by
      ) order by ce.created_at)
      from public.canvas_edges ce
      where ce.user_id = p_user_id
        and ce.canvas_id = p_canvas_id
    ), '[]'::jsonb)
  );
end;
$$;

-- --------------------------------------------------------------------------
-- 3. 画布布局
-- --------------------------------------------------------------------------

-- 视口与卡片坐标是同一次拖拽的两半，故一起提交。p_cards: [{ "id": uuid, "x": num, "y": num }]
create or replace function public.update_canvas_layout(
  p_user_id uuid,
  p_canvas_id uuid,
  p_viewport jsonb default null,
  p_cards jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  canvas_row public.canvases%rowtype;
  moved integer := 0;
begin
  if (select auth.uid()) is distinct from p_user_id then
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

  if p_viewport is not null then
    update public.canvases
    set viewport = p_viewport
    where user_id = p_user_id
      and node_id = p_canvas_id
    returning * into canvas_row;
  end if;

  with moves as (
    select
      (card->>'id')::uuid as id,
      (card->>'x')::numeric as x,
      (card->>'y')::numeric as y
    from jsonb_array_elements(coalesce(p_cards, '[]'::jsonb)) as card
  )
  update public.canvas_nodes cn
  set position_x = moves.x,
      position_y = moves.y
  from moves
  where cn.user_id = p_user_id
    and cn.canvas_id = p_canvas_id
    and cn.id = moves.id;

  get diagnostics moved = row_count;

  return jsonb_build_object(
    'status', 'updated',
    'canvas', to_jsonb(canvas_row),
    'moved_count', moved
  );
end;
$$;

-- --------------------------------------------------------------------------
-- 4. 晋升: 画布节点 → 真正的笔记
-- --------------------------------------------------------------------------

-- 这是本文件的灵魂。正文从 canvas_nodes.text 搬进 public.memos，同一事务内把 text 置空
-- 并把卡片改成 memo_ref: 内容只剩一份，结构上不允许存在第二份。
-- 摘要/字数由 service 从同一段正文派生后传入（那条规则的所有者在 service，不在这里复制一份）。
create or replace function public.promote_canvas_node(
  p_user_id uuid,
  p_canvas_node_id uuid,
  p_parent_id uuid default null,
  p_sort_order numeric default 1000,
  p_title text default null,
  p_excerpt text default null,
  p_word_count integer default 0
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  card public.canvas_nodes%rowtype;
  parent_type text;
  promoted_title text;
  tree_node public.memo_nodes%rowtype;
  memo_row public.memos%rowtype;
begin
  if (select auth.uid()) is distinct from p_user_id then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- 行锁使并发的两次晋升串行: 后到的那次会看到 kind 已是 memo_ref，于是幂等返回
  select *
  into card
  from public.canvas_nodes
  where user_id = p_user_id
    and id = p_canvas_node_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- 幂等重放: 这张卡片已经是笔记了。连同目标一起回传，调用方无需再查一次；
  -- 目标被永久删除时两者皆为 null，那是墓碑而不是错误。
  if card.kind = 'memo_ref' then
    return jsonb_build_object(
      'status', 'already_promoted',
      'card', to_jsonb(card),
      'node', (
        select to_jsonb(node)
        from public.memo_nodes node
        where node.user_id = p_user_id
          and node.id = card.target_node_id
      ),
      'memo', (
        select to_jsonb(memo)
        from public.memos memo
        where memo.user_id = p_user_id
          and memo.node_id = card.target_node_id
      )
    );
  end if;

  if card.text is null or length(btrim(card.text)) = 0 then
    return jsonb_build_object(
      'status', 'invalid',
      'error_code', 'CANVAS_CARD_EMPTY'
    );
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

  -- 标题优先用调用方给的；缺省时退到正文首行（剥掉 Markdown 标题记号），仍空则用默认名
  promoted_title := nullif(btrim(coalesce(p_title, '')), '');

  if promoted_title is null then
    promoted_title := nullif(
      btrim(regexp_replace(split_part(card.text, E'\n', 1), '^#+[[:space:]]*', '')),
      ''
    );
  end if;

  promoted_title := left(coalesce(promoted_title, '未命名备忘录'), 500);

  insert into public.memo_nodes (
    user_id, parent_id, node_type, title, sort_order
  )
  values (
    p_user_id, p_parent_id, 'memo', promoted_title, coalesce(p_sort_order, 1000)
  )
  returning * into tree_node;

  insert into public.memos (
    node_id, user_id, content_mdx, excerpt, word_count
  )
  values (
    tree_node.id, p_user_id, card.text, p_excerpt,
    greatest(coalesce(p_word_count, 0), 0)
  )
  returning * into memo_row;

  update public.canvas_nodes
  set kind = 'memo_ref',
      target_node_id = tree_node.id,
      anchored_rev = tree_node.revision,
      text = null,
      anchor = '{}'::jsonb
  where user_id = p_user_id
    and id = card.id
  returning * into card;

  return jsonb_build_object(
    'status', 'promoted',
    'card', to_jsonb(card),
    'node', to_jsonb(tree_node),
    'memo', to_jsonb(memo_row)
  );
end;
$$;

-- --------------------------------------------------------------------------
-- Grants
-- --------------------------------------------------------------------------

revoke all on function public.validate_canvas_root()
from public, anon, authenticated, service_role;

revoke all on function public.validate_canvas_node()
from public, anon, authenticated, service_role;

revoke all on function public.validate_memo_relation()
from public, anon, authenticated, service_role;

revoke all on function public.save_exploration_canvas(uuid, text, uuid, numeric, uuid, jsonb, jsonb)
from public, anon, authenticated, service_role;

revoke all on function public.read_canvas(uuid, uuid)
from public, anon, authenticated, service_role;

revoke all on function public.update_canvas_layout(uuid, uuid, jsonb, jsonb)
from public, anon, authenticated, service_role;

revoke all on function public.promote_canvas_node(uuid, uuid, uuid, numeric, text, text, integer)
from public, anon, authenticated, service_role;

grant execute on function public.save_exploration_canvas(uuid, text, uuid, numeric, uuid, jsonb, jsonb)
to authenticated;

grant execute on function public.read_canvas(uuid, uuid)
to authenticated;

grant execute on function public.update_canvas_layout(uuid, uuid, jsonb, jsonb)
to authenticated;

grant execute on function public.promote_canvas_node(uuid, uuid, uuid, numeric, text, text, integer)
to authenticated;
