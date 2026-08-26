-- [INPUT]: 依赖 canvas-v2-schema.sql 与 canvas-v2-entry-rpc.sql、Canvas/memo 表、extensions.pgcrypto、RLS 与 auth.uid()
-- [OUTPUT]: 提供人工编辑与 AI expansion 共用的 apply_canvas_mutation 原子函数，统一 version、receipt、checkpoint、容量、快照与幂等回执
-- [POS]: api/supabase 的 Canvas V2 唯一 mutation 内核；业务 API 的 PATCH 与 expansion commit 只能调用此处，禁止再生第二套节点/边写入规则
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

set local lock_timeout = '5s';

-- --------------------------------------------------------------------------
-- 4. 唯一 mutation 内核：人工与 AI 共用
-- --------------------------------------------------------------------------

create or replace function public.apply_canvas_mutation(
  p_user_id uuid,
  p_canvas_id uuid,
  p_protocol_version integer,
  p_mutation_id uuid,
  p_base_version bigint,
  p_operations jsonb,
  p_expansion jsonb default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  canvas_row public.canvases%rowtype;
  receipt public.canvas_mutation_receipts%rowtype;
  op jsonb;
  op_type text;
  op_index bigint;
  candidate jsonb;
  memo_row public.memo_nodes%rowtype;
  memo_body public.memos%rowtype;
  node_row public.canvas_nodes%rowtype;
  source_node public.canvas_nodes%rowtype;
  edge_row public.canvas_edges%rowtype;
  intent_digest text;
  response jsonb;
  upserted_nodes jsonb := '[]'::jsonb;
  removed_node_ids jsonb := '[]'::jsonb;
  upserted_edges jsonb := '[]'::jsonb;
  removed_edge_ids jsonb := '[]'::jsonb;
  aliases jsonb := '[]'::jsonb;
  noops jsonb := '[]'::jsonb;
  dropped jsonb := '[]'::jsonb;
  client_node_id uuid;
  target_memo_id uuid;
  source_node_id uuid;
  requested_edge_id uuid;
  node_count integer;
  edge_count integer;
  capacity_limited boolean := false;
  skip_create boolean;
  skip_remove boolean;
  expansion_source_revision bigint;
  expansion_corpus_version bigint;
  expansion_source_node_id uuid;
  expansion_request_id uuid;
  expansion_status text;
  current_corpus_version bigint := 0;
begin
  if (select auth.uid()) is distinct from p_user_id then
    return jsonb_build_object('status', 'not_found');
  end if;

  if p_protocol_version <> 2 then
    return jsonb_build_object('status', 'invalid', 'error_code', 'CANVAS_PROTOCOL_UNSUPPORTED');
  end if;

  if jsonb_typeof(coalesce(p_operations, 'null'::jsonb)) <> 'array'
    or jsonb_array_length(p_operations) > 100
  then
    return jsonb_build_object('status', 'invalid', 'error_code', 'CANVAS_OPERATIONS_INVALID');
  end if;

  intent_digest := encode(
    extensions.digest(
      convert_to(jsonb_build_object(
        'protocol_version', p_protocol_version,
        'canvas_id', p_canvas_id,
        'operations', p_operations,
        'expansion', p_expansion
      )::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  select c.*
  into canvas_row
  from public.canvases c
  join public.memo_nodes n
    on n.user_id = c.user_id
   and n.id = c.node_id
  where c.user_id = p_user_id
    and c.node_id = p_canvas_id
    and n.deleted_at is null
  for update of c;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  select *
  into receipt
  from public.canvas_mutation_receipts
  where user_id = p_user_id
    and canvas_id = p_canvas_id
    and mutation_id = p_mutation_id;

  if found then
    if receipt.intent_digest = intent_digest then
      return receipt.response;
    end if;

    return jsonb_build_object(
      'status', 'mutation_id_reused',
      'mutation_id', p_mutation_id,
      'version', canvas_row.version
    );
  end if;

  if canvas_row.version <> p_base_version then
    return jsonb_build_object(
      'status', 'version_conflict',
      'mutation_id', p_mutation_id,
      'version', canvas_row.version
    );
  end if;

  -- Expansion 在任何节点/边写入前锁定并复核可信 revision。
  if p_expansion is not null then
    if jsonb_typeof(p_expansion) <> 'object' then
      return jsonb_build_object('status', 'invalid', 'error_code', 'CANVAS_EXPANSION_INVALID');
    end if;

    expansion_source_node_id := (p_expansion->>'source_canvas_node_id')::uuid;
    expansion_source_revision := (p_expansion->>'source_revision')::bigint;
    expansion_corpus_version := (p_expansion->>'corpus_version')::bigint;
    expansion_request_id := (p_expansion->>'request_id')::uuid;
    expansion_status := p_expansion->>'completion_status';

    if expansion_status not in ('complete', 'incomplete_due_to_capacity') then
      return jsonb_build_object('status', 'invalid', 'error_code', 'CANVAS_EXPANSION_STATUS_INVALID');
    end if;

    select *
    into source_node
    from public.canvas_nodes
    where user_id = p_user_id
      and canvas_id = p_canvas_id
      and id = expansion_source_node_id
      and kind = 'memo_ref'
      and target_node_id is not null
    for share;

    if not found then
      return jsonb_build_object('status', 'source_revision_conflict');
    end if;

    select *
    into memo_row
    from public.memo_nodes
    where user_id = p_user_id
      and id = source_node.target_node_id
      and node_type = 'memo'
      and deleted_at is null
    for share;

    if not found or memo_row.revision <> expansion_source_revision then
      return jsonb_build_object('status', 'source_revision_conflict');
    end if;

    for candidate in
      select value from jsonb_array_elements(coalesce(p_expansion->'candidate_revisions', '[]'::jsonb))
    loop
      select *
      into memo_row
      from public.memo_nodes
      where user_id = p_user_id
        and id = (candidate->>'memo_id')::uuid
        and node_type = 'memo'
        and deleted_at is null
      for share;

      if not found or memo_row.revision <> (candidate->>'revision')::bigint then
        return jsonb_build_object(
          'status', 'candidate_revision_conflict',
          'memo_id', candidate->>'memo_id'
        );
      end if;
    end loop;
  end if;

  for op, op_index in
    select value, ordinality
    from jsonb_array_elements(p_operations) with ordinality
  loop
    op_type := op->>'type';

    -- 同批 create + remove 归一为 no-op，避免制造无意义实体与回执噪音。
    skip_create := false;
    skip_remove := false;

    if op_type in ('create_text', 'add_memo') and op ? 'node_id' then
      select exists (
        select 1
        from jsonb_array_elements(p_operations) with ordinality as later(value, position)
        where position > op_index
          and value->>'type' = 'remove_node'
          and value->>'node_id' = op->>'node_id'
      ) into skip_create;
    elsif op_type = 'remove_node' then
      select exists (
        select 1
        from jsonb_array_elements(p_operations) with ordinality as earlier(value, position)
        where position < op_index
          and value->>'type' in ('create_text', 'add_memo')
          and value->>'node_id' = op->>'node_id'
      ) into skip_remove;
    end if;

    if skip_create or skip_remove then
      noops := noops || jsonb_build_array(jsonb_build_object(
        'index', op_index - 1,
        'type', op_type,
        'reason', '同批创建后移除'
      ));
      continue;
    end if;

    if op_type = 'add_memo' then
      client_node_id := (op->>'node_id')::uuid;
      target_memo_id := (op->>'target_node_id')::uuid;

      select *
      into memo_row
      from public.memo_nodes
      where user_id = p_user_id
        and id = target_memo_id
        and node_type = 'memo'
        and deleted_at is null;

      if not found then
        dropped := dropped || jsonb_build_array(jsonb_build_object(
          'index', op_index - 1,
          'type', op_type,
          'reason', '笔记不存在或已在回收站'
        ));
        continue;
      end if;

      select *
      into memo_body
      from public.memos
      where user_id = p_user_id
        and node_id = target_memo_id;

      if not found then
        dropped := dropped || jsonb_build_array(jsonb_build_object(
          'index', op_index - 1,
          'type', op_type,
          'reason', '笔记正文尚未完成创建'
        ));
        continue;
      end if;

      select *
      into node_row
      from public.canvas_nodes
      where user_id = p_user_id
        and canvas_id = p_canvas_id
        and target_node_id = target_memo_id;

      if not found then
        select count(*) into node_count
        from public.canvas_nodes
        where user_id = p_user_id and canvas_id = p_canvas_id;

        if node_count >= 50 then
          capacity_limited := true;
          dropped := dropped || jsonb_build_array(jsonb_build_object(
            'index', op_index - 1,
            'type', op_type,
            'reason', 'Canvas 已达到 50 个节点上限'
          ));
          continue;
        end if;

        source_node_id := nullif(op->>'discovered_from_id', '')::uuid;
        if source_node_id is not null then
          perform 1 from public.canvas_nodes
          where user_id = p_user_id
            and canvas_id = p_canvas_id
            and id = source_node_id
            and kind = 'memo_ref';
          if not found then
            raise exception 'discovered_from_id must be a memo node in this canvas'
              using errcode = '23514';
          end if;
        end if;

        insert into public.canvas_nodes (
          id, user_id, canvas_id, kind, target_node_id, anchored_rev,
          snapshot_title, snapshot_excerpt, snapshot_revision,
          discovered_from_id, position_x, position_y, created_by
        )
        values (
          client_node_id, p_user_id, p_canvas_id, 'memo_ref', target_memo_id,
          memo_row.revision, memo_row.title, memo_body.excerpt, memo_row.revision,
          source_node_id,
          coalesce((op->>'x')::numeric, 0),
          coalesce((op->>'y')::numeric, 0),
          case when p_expansion is null then 'user' else 'ai' end
        )
        returning * into node_row;

        upserted_nodes := upserted_nodes || jsonb_build_array(to_jsonb(node_row));
      else
        noops := noops || jsonb_build_array(jsonb_build_object(
          'index', op_index - 1,
          'type', op_type,
          'reason', '笔记已在 Canvas 中',
          'node_id', node_row.id
        ));
      end if;

      aliases := aliases || jsonb_build_array(jsonb_build_object(
        'client_id', client_node_id,
        'node_id', node_row.id
      ));

      source_node_id := nullif(op->>'source_node_id', '')::uuid;
      if source_node_id is not null and source_node_id <> node_row.id then
        select *
        into source_node
        from public.canvas_nodes
        where user_id = p_user_id
          and canvas_id = p_canvas_id
          and id = source_node_id
          and kind = 'memo_ref';

        if not found then
          raise exception 'edge source must be a memo node in this canvas'
            using errcode = '23514';
        end if;

        select *
        into edge_row
        from public.canvas_edges
        where user_id = p_user_id
          and canvas_id = p_canvas_id
          and endpoint_low = least(source_node_id, node_row.id)
          and endpoint_high = greatest(source_node_id, node_row.id);

        if not found then
          select count(*) into edge_count
          from public.canvas_edges
          where user_id = p_user_id and canvas_id = p_canvas_id;

          if edge_count >= 200 then
            capacity_limited := true;
            dropped := dropped || jsonb_build_array(jsonb_build_object(
              'index', op_index - 1,
              'type', 'upsert_edge',
              'reason', 'Canvas 已达到 200 条边上限'
            ));
          else
            requested_edge_id := coalesce(nullif(op->>'edge_id', '')::uuid, gen_random_uuid());
            insert into public.canvas_edges (
              id, user_id, canvas_id, source_id, target_id, rationale, created_by
            )
            values (
              requested_edge_id, p_user_id, p_canvas_id, source_node_id, node_row.id,
              nullif(btrim(coalesce(op->>'rationale', '')), ''),
              case when p_expansion is null then 'user' else 'ai' end
            )
            returning * into edge_row;
            upserted_edges := upserted_edges || jsonb_build_array(to_jsonb(edge_row));
          end if;
        end if;
      end if;

    elsif op_type = 'create_text' then
      client_node_id := (op->>'node_id')::uuid;

      if length(coalesce(op->>'text', '')) < 1
        or length(op->>'text') > 5000
        or coalesce((op->>'width')::numeric, 240) not between 120 and 720
        or coalesce((op->>'height')::numeric, 120) not between 48 and 480
      then
        raise exception 'native canvas node shape is invalid'
          using errcode = '23514';
      end if;

      select *
      into node_row
      from public.canvas_nodes
      where user_id = p_user_id
        and canvas_id = p_canvas_id
        and id = client_node_id;

      if found then
        noops := noops || jsonb_build_array(jsonb_build_object(
          'index', op_index - 1,
          'type', op_type,
          'reason', '文字节点已存在',
          'node_id', node_row.id
        ));
      else
        select count(*) into node_count
        from public.canvas_nodes
        where user_id = p_user_id and canvas_id = p_canvas_id;

        if node_count >= 50 then
          capacity_limited := true;
          dropped := dropped || jsonb_build_array(jsonb_build_object(
            'index', op_index - 1,
            'type', op_type,
            'reason', 'Canvas 已达到 50 个节点上限'
          ));
          continue;
        end if;

        insert into public.canvas_nodes (
          id, user_id, canvas_id, kind, text, position_x, position_y,
          width, height, created_by
        )
        values (
          client_node_id, p_user_id, p_canvas_id, 'native', op->>'text',
          coalesce((op->>'x')::numeric, 0),
          coalesce((op->>'y')::numeric, 0),
          coalesce((op->>'width')::numeric, 240),
          coalesce((op->>'height')::numeric, 120),
          'user'
        )
        returning * into node_row;
        upserted_nodes := upserted_nodes || jsonb_build_array(to_jsonb(node_row));
      end if;

      aliases := aliases || jsonb_build_array(jsonb_build_object(
        'client_id', client_node_id,
        'node_id', node_row.id
      ));

    elsif op_type = 'update_node' then
      select *
      into node_row
      from public.canvas_nodes
      where user_id = p_user_id
        and canvas_id = p_canvas_id
        and id = (op->>'node_id')::uuid
      for update;

      if not found then
        dropped := dropped || jsonb_build_array(jsonb_build_object(
          'index', op_index - 1,
          'type', op_type,
          'reason', '节点已被远端删除'
        ));
        continue;
      end if;

      if node_row.kind in ('native', 'excerpt') and op ? 'text' then
        if length(coalesce(op->>'text', '')) < 1 or length(op->>'text') > 5000 then
          raise exception 'native canvas text is invalid' using errcode = '23514';
        end if;
      elsif node_row.kind = 'memo_ref' and (op ? 'text' or op ? 'width' or op ? 'height') then
        raise exception 'memo_ref content and dimensions are immutable' using errcode = '23514';
      end if;

      if op ? 'width' and (op->>'width')::numeric not between 120 and 720 then
        raise exception 'native canvas width is invalid' using errcode = '23514';
      end if;
      if op ? 'height' and (op->>'height')::numeric not between 48 and 480 then
        raise exception 'native canvas height is invalid' using errcode = '23514';
      end if;

      update public.canvas_nodes
      set position_x = case when op ? 'x' then (op->>'x')::numeric else position_x end,
          position_y = case when op ? 'y' then (op->>'y')::numeric else position_y end,
          text = case when op ? 'text' then op->>'text' else text end,
          width = case when op ? 'width' then (op->>'width')::numeric else width end,
          height = case when op ? 'height' then (op->>'height')::numeric else height end
      where user_id = p_user_id
        and canvas_id = p_canvas_id
        and id = node_row.id
      returning * into node_row;

      upserted_nodes := upserted_nodes || jsonb_build_array(to_jsonb(node_row));

    elsif op_type = 'remove_node' then
      select *
      into node_row
      from public.canvas_nodes
      where user_id = p_user_id
        and canvas_id = p_canvas_id
        and id = (op->>'node_id')::uuid
      for update;

      if not found then
        noops := noops || jsonb_build_array(jsonb_build_object(
          'index', op_index - 1,
          'type', op_type,
          'reason', '节点已经不在 Canvas 中'
        ));
        continue;
      end if;

      select coalesce(jsonb_agg(id), '[]'::jsonb)
      into candidate
      from public.canvas_edges
      where user_id = p_user_id
        and canvas_id = p_canvas_id
        and node_row.id in (source_id, target_id);

      removed_edge_ids := removed_edge_ids || candidate;

      if canvas_row.canvas_kind = 'memo_default'
        and node_row.target_node_id = canvas_row.origin_node_id
      then
        update public.canvases
        set canvas_kind = 'standalone',
            origin_node_id = null,
            origin_revision = null
        where user_id = p_user_id
          and node_id = p_canvas_id;
      end if;

      delete from public.canvas_nodes
      where user_id = p_user_id
        and canvas_id = p_canvas_id
        and id = node_row.id;

      removed_node_ids := removed_node_ids || jsonb_build_array(node_row.id);

    elsif op_type = 'upsert_edge' then
      source_node_id := (op->>'source_id')::uuid;
      target_memo_id := (op->>'target_id')::uuid;

      if source_node_id = target_memo_id then
        raise exception 'canvas edge cannot connect a node to itself' using errcode = '23514';
      end if;

      perform 1
      from public.canvas_nodes
      where user_id = p_user_id
        and canvas_id = p_canvas_id
        and id in (source_node_id, target_memo_id)
        and kind = 'memo_ref'
      group by canvas_id
      having count(*) = 2;

      if not found then
        raise exception 'canvas edges can only connect memo nodes in one canvas'
          using errcode = '23514';
      end if;

      select *
      into edge_row
      from public.canvas_edges
      where user_id = p_user_id
        and canvas_id = p_canvas_id
        and endpoint_low = least(source_node_id, target_memo_id)
        and endpoint_high = greatest(source_node_id, target_memo_id)
      for update;

      if found then
        if op ? 'rationale' then
          update public.canvas_edges
          set rationale = nullif(btrim(coalesce(op->>'rationale', '')), '')
          where user_id = p_user_id and id = edge_row.id
          returning * into edge_row;
          upserted_edges := upserted_edges || jsonb_build_array(to_jsonb(edge_row));
        else
          noops := noops || jsonb_build_array(jsonb_build_object(
            'index', op_index - 1,
            'type', op_type,
            'reason', '关系已存在',
            'edge_id', edge_row.id
          ));
        end if;
      else
        select count(*) into edge_count
        from public.canvas_edges
        where user_id = p_user_id and canvas_id = p_canvas_id;

        if edge_count >= 200 then
          capacity_limited := true;
          dropped := dropped || jsonb_build_array(jsonb_build_object(
            'index', op_index - 1,
            'type', op_type,
            'reason', 'Canvas 已达到 200 条边上限'
          ));
          continue;
        end if;

        requested_edge_id := (op->>'edge_id')::uuid;
        insert into public.canvas_edges (
          id, user_id, canvas_id, source_id, target_id, rationale, created_by
        )
        values (
          requested_edge_id, p_user_id, p_canvas_id, source_node_id, target_memo_id,
          nullif(btrim(coalesce(op->>'rationale', '')), ''),
          case when p_expansion is null then 'user' else 'ai' end
        )
        returning * into edge_row;
        upserted_edges := upserted_edges || jsonb_build_array(to_jsonb(edge_row));
      end if;

    elsif op_type = 'remove_edge' then
      delete from public.canvas_edges
      where user_id = p_user_id
        and canvas_id = p_canvas_id
        and id = (op->>'edge_id')::uuid
      returning * into edge_row;

      if found then
        removed_edge_ids := removed_edge_ids || jsonb_build_array(edge_row.id);
      else
        noops := noops || jsonb_build_array(jsonb_build_object(
          'index', op_index - 1,
          'type', op_type,
          'reason', '关系已经不存在'
        ));
      end if;

    elsif op_type = 'set_viewport' then
      if jsonb_typeof(op->'viewport') <> 'object' then
        raise exception 'canvas viewport must be an object' using errcode = '23514';
      end if;

      update public.canvases
      set viewport = op->'viewport'
      where user_id = p_user_id
        and node_id = p_canvas_id;

    else
      raise exception 'unsupported canvas operation: %', coalesce(op_type, '<missing>')
        using errcode = '23514';
    end if;
  end loop;

  update public.canvases
  set version = version + 1
  where user_id = p_user_id
    and node_id = p_canvas_id
  returning * into canvas_row;

  if p_expansion is not null then
    select coalesce(version, 0)
    into current_corpus_version
    from public.memo_corpus_versions
    where user_id = p_user_id;

    if capacity_limited then
      expansion_status := 'incomplete_due_to_capacity';
    end if;

    insert into public.canvas_expansions (
      user_id, canvas_id, source_canvas_node_id, source_revision,
      corpus_version, request_id, completion_status, completed_at
    )
    values (
      p_user_id, p_canvas_id, expansion_source_node_id, expansion_source_revision,
      expansion_corpus_version, expansion_request_id, expansion_status, now()
    )
    on conflict (canvas_id, source_canvas_node_id) do update
    set source_revision = excluded.source_revision,
        corpus_version = excluded.corpus_version,
        request_id = excluded.request_id,
        completion_status = excluded.completion_status,
        completed_at = excluded.completed_at
    where excluded.corpus_version > public.canvas_expansions.corpus_version
       or (
         excluded.corpus_version = public.canvas_expansions.corpus_version
         and excluded.source_revision >= public.canvas_expansions.source_revision
       );
  end if;

  response := jsonb_build_object(
    'status', 'applied',
    'mutation_id', p_mutation_id,
    'intent_digest', intent_digest,
    'version', canvas_row.version,
    'upserted_nodes', upserted_nodes,
    'removed_node_ids', removed_node_ids,
    'upserted_edges', upserted_edges,
    'removed_edge_ids', removed_edge_ids,
    'aliases', aliases,
    'noops', noops,
    'dropped', dropped,
    'expansion_status', case when p_expansion is null then null else expansion_status end
  );

  delete from public.canvas_mutation_receipts
  where user_id = p_user_id
    and expires_at < now();

  insert into public.canvas_mutation_receipts (
    user_id, canvas_id, mutation_id, intent_digest,
    base_version, new_version, response
  )
  values (
    p_user_id, p_canvas_id, p_mutation_id, intent_digest,
    p_base_version, canvas_row.version, response
  );

  return response;
end;
$$;

-- --------------------------------------------------------------------------
-- 5. 显式函数权限
-- --------------------------------------------------------------------------

revoke all on function public.apply_canvas_mutation(uuid, uuid, integer, uuid, bigint, jsonb, jsonb)
from public, anon, authenticated, service_role;

grant execute on function public.apply_canvas_mutation(uuid, uuid, integer, uuid, bigint, jsonb, jsonb)
to authenticated;
