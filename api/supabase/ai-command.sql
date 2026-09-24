-- [INPUT]: 依赖 public.ai_commands/public.memo_nodes/public.memos、auth.uid()、memo 软删除/恢复 RPC 与 revision triggers
-- [OUTPUT]: 提供默认 ask 的命令创建、批准、拒绝、执行和撤销 RPC，以统一树锁顺序、owner、幂等与 expected_revision 保护全部 AI 写操作
-- [POS]: api/supabase 的 AI Native V2 可信执行核心；模型只提交意图，数据库在原子事务内决定能否改变真实备忘录状态
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

create or replace function public.apply_ai_command(
  p_user_id uuid,
  p_command_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  command_record public.ai_commands%rowtype;
  target public.memo_nodes%rowtype;
  reference_node public.memo_nodes%rowtype;
  changed_node public.memo_nodes%rowtype;
  created_content public.memos%rowtype;
  destination_parent_id uuid;
  reference_id uuid;
  normalized_title text;
  placement text;
  next_sort_order numeric(20, 8);
  previous_sort_order numeric(20, 8);
  following_sort_order numeric(20, 8);
  command_before_state jsonb;
  command_after_state jsonb;
  delete_result jsonb;
  content_text text;
  content_plain_text text;
  content_excerpt text;
  content_word_count integer;
begin
  if (select auth.uid()) is distinct from p_user_id then
    return jsonb_build_object('status', 'not_found');
  end if;

  perform set_config('folune.ai_command_mutation', 'on', true);

  select *
  into command_record
  from public.ai_commands
  where user_id = p_user_id
    and id = p_command_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if command_record.status in ('succeeded', 'stale', 'failed', 'rejected', 'undone') then
    return jsonb_build_object(
      'status', command_record.status,
      'command', to_jsonb(command_record)
    );
  end if;

  if command_record.status not in ('approved', 'executing') then
    return jsonb_build_object(
      'status', 'pending_approval',
      'command', to_jsonb(command_record)
    );
  end if;

  update public.ai_commands
  set status = 'executing', error_code = null
  where user_id = p_user_id and id = p_command_id
  returning * into command_record;

  -- 删除/恢复会锁整棵树，必须先按相同顺序取得树锁，再锁目标。
  -- 否则并发命令各持一个目标锁，进入回收站 RPC 后形成交叉等待。
  if command_record.operation = 'trash_node' then
    perform 1 from public.memo_nodes
    where user_id = p_user_id
    order by id
    for update;
  end if;

  if command_record.operation <> 'create_node' then
    select *
    into target
    from public.memo_nodes
    where user_id = p_user_id
      and id = command_record.target_node_id
    for update;

    if not found then
      update public.ai_commands
      set status = 'failed', error_code = 'AI_TARGET_NOT_FOUND'
      where user_id = p_user_id and id = p_command_id
      returning * into command_record;

      return jsonb_build_object('status', 'failed', 'command', to_jsonb(command_record));
    end if;

    if target.revision <> command_record.expected_revision then
      update public.ai_commands
      set
        status = 'stale',
        error_code = 'AI_REVISION_CONFLICT',
        before_state = jsonb_build_object('node', to_jsonb(target))
      where user_id = p_user_id and id = p_command_id
      returning * into command_record;

      return jsonb_build_object('status', 'stale', 'command', to_jsonb(command_record));
    end if;

    if target.deleted_at is not null and command_record.operation <> 'trash_node' then
      update public.ai_commands
      set status = 'failed', error_code = 'AI_TARGET_IN_TRASH'
      where user_id = p_user_id and id = p_command_id
      returning * into command_record;

      return jsonb_build_object('status', 'failed', 'command', to_jsonb(command_record));
    end if;
  end if;

  begin
    if command_record.operation = 'create_node' then
      normalized_title := btrim(command_record.input ->> 'title');
      destination_parent_id := (command_record.input ->> 'parent_id')::uuid;

      if normalized_title is null or length(normalized_title) not between 1 and 500 then
        raise exception 'invalid title' using errcode = '22023';
      end if;

      if command_record.input ->> 'node_type' not in ('folder', 'memo') then
        raise exception 'invalid node type' using errcode = '22023';
      end if;

      if destination_parent_id is not null then
        perform 1
        from public.memo_nodes
        where user_id = p_user_id
          and id = destination_parent_id
          and node_type = 'folder'
          and deleted_at is null;

        if not found then
          raise exception 'invalid parent' using errcode = '23503';
        end if;
      end if;

      select coalesce(max(sort_order), 0) + 1000
      into next_sort_order
      from public.memo_nodes sibling
      where user_id = p_user_id
        and sibling.parent_id is not distinct from destination_parent_id
        and deleted_at is null;

      insert into public.memo_nodes (
        user_id, parent_id, node_type, title, sort_order
      ) values (
        p_user_id,
        destination_parent_id,
        command_record.input ->> 'node_type',
        normalized_title,
        next_sort_order
      ) returning * into changed_node;

      if changed_node.node_type = 'memo' then
        content_text := coalesce(command_record.input ->> 'content_mdx', '');
        content_plain_text := btrim(regexp_replace(content_text, '\s+', ' ', 'g'));
        content_excerpt := nullif(left(content_plain_text, 200), '');
        content_word_count := coalesce(
          array_length(
            regexp_split_to_array(content_plain_text, '\s+'),
            1
          ),
          0
        );
        if content_plain_text = '' then content_word_count := 0; end if;

        insert into public.memos (
          node_id, user_id, content_mdx, excerpt, word_count
        )
        values (
          changed_node.id,
          p_user_id,
          content_text,
          content_excerpt,
          content_word_count
        ) returning * into created_content;
      end if;

      command_before_state := null;
      command_after_state := jsonb_build_object(
        'node', to_jsonb(changed_node),
        'content', case
          when changed_node.node_type = 'memo' then to_jsonb(created_content)
          else 'null'::jsonb
        end
      );

      update public.ai_commands
      set target_node_id = changed_node.id
      where user_id = p_user_id and id = p_command_id;

    elsif command_record.operation = 'rename_node' then
      normalized_title := btrim(command_record.input ->> 'title');
      if normalized_title is null or length(normalized_title) not between 1 and 500 then
        raise exception 'invalid title' using errcode = '22023';
      end if;

      command_before_state := jsonb_build_object('node', to_jsonb(target));
      update public.memo_nodes
      set title = normalized_title
      where user_id = p_user_id and id = target.id
      returning * into changed_node;
      command_after_state := jsonb_build_object('node', to_jsonb(changed_node));

    elsif command_record.operation = 'move_node' then
      destination_parent_id := (command_record.input ->> 'parent_id')::uuid;
      if destination_parent_id = target.id then
        raise exception 'node cannot be its own parent' using errcode = '23514';
      end if;

      if destination_parent_id is not null then
        perform 1
        from public.memo_nodes
        where user_id = p_user_id
          and id = destination_parent_id
          and node_type = 'folder'
          and deleted_at is null;
        if not found then
          raise exception 'invalid parent' using errcode = '23503';
        end if;

        if exists (
          with recursive subtree as (
            select id from public.memo_nodes
            where user_id = p_user_id and id = target.id
            union all
            select child.id
            from public.memo_nodes child
            join subtree parent on child.parent_id = parent.id
            where child.user_id = p_user_id
          )
          select 1 from subtree where id = destination_parent_id
        ) then
          raise exception 'cannot move into own subtree' using errcode = '23514';
        end if;
      end if;

      select coalesce(max(sort_order), 0) + 1000
      into next_sort_order
      from public.memo_nodes sibling
      where sibling.user_id = p_user_id
        and sibling.parent_id is not distinct from destination_parent_id
        and sibling.deleted_at is null
        and sibling.id <> target.id;

      command_before_state := jsonb_build_object('node', to_jsonb(target));
      update public.memo_nodes
      set parent_id = destination_parent_id, sort_order = next_sort_order
      where user_id = p_user_id and id = target.id
      returning * into changed_node;
      command_after_state := jsonb_build_object('node', to_jsonb(changed_node));

    elsif command_record.operation = 'reorder_node' then
      reference_id := (command_record.input ->> 'reference_node_id')::uuid;
      placement := command_record.input ->> 'placement';

      select *
      into reference_node
      from public.memo_nodes
      where user_id = p_user_id
        and id = reference_id
        and deleted_at is null
      for update;

      if not found
        or reference_node.id = target.id
        or reference_node.parent_id is distinct from target.parent_id
        or placement not in ('before', 'after')
      then
        raise exception 'invalid reorder reference' using errcode = '22023';
      end if;

      if placement = 'before' then
        select max(sort_order)
        into previous_sort_order
        from public.memo_nodes
        where user_id = p_user_id
          and parent_id is not distinct from target.parent_id
          and deleted_at is null
          and id <> target.id
          and sort_order < reference_node.sort_order;
        next_sort_order := case
          when previous_sort_order is null then reference_node.sort_order - 1000
          else (previous_sort_order + reference_node.sort_order) / 2
        end;
      else
        select min(sort_order)
        into following_sort_order
        from public.memo_nodes
        where user_id = p_user_id
          and parent_id is not distinct from target.parent_id
          and deleted_at is null
          and id <> target.id
          and sort_order > reference_node.sort_order;
        next_sort_order := case
          when following_sort_order is null then reference_node.sort_order + 1000
          else (following_sort_order + reference_node.sort_order) / 2
        end;
      end if;

      command_before_state := jsonb_build_object('node', to_jsonb(target));
      update public.memo_nodes
      set sort_order = next_sort_order
      where user_id = p_user_id and id = target.id
      returning * into changed_node;
      command_after_state := jsonb_build_object('node', to_jsonb(changed_node));

    elsif command_record.operation = 'trash_node' then
      command_before_state := jsonb_build_object('node', to_jsonb(target));
      delete_result := public.soft_delete_memo_node(p_user_id, target.id);
      if delete_result ->> 'status' <> 'deleted' then
        raise exception 'soft delete failed' using errcode = 'P0001';
      end if;
      command_after_state := jsonb_build_object('node', delete_result -> 'node');

    elsif command_record.operation = 'edit_memo' then
      if target.node_type <> 'memo' then
        raise exception 'target is not a memo' using errcode = '23514';
      end if;

      select jsonb_build_object(
        'node', to_jsonb(target),
        'content', to_jsonb(content)
      )
      into command_before_state
      from public.memos content
      where content.user_id = p_user_id and content.node_id = target.id
      for update;

      if command_before_state is null then
        raise exception 'memo content not found' using errcode = '23503';
      end if;

      content_text := coalesce(command_record.input ->> 'content_mdx', '');
      content_plain_text := btrim(regexp_replace(content_text, '\s+', ' ', 'g'));
      content_excerpt := nullif(left(content_plain_text, 200), '');
      content_word_count := coalesce(
        array_length(
          regexp_split_to_array(content_plain_text, '\s+'),
          1
        ),
        0
      );
      if content_plain_text = '' then content_word_count := 0; end if;

      update public.memos
      set
        content_mdx = content_text,
        excerpt = content_excerpt,
        word_count = content_word_count
      where user_id = p_user_id and node_id = target.id
      returning * into created_content;

      select * into changed_node
      from public.memo_nodes
      where user_id = p_user_id and id = target.id;

      command_after_state := jsonb_build_object(
        'node', to_jsonb(changed_node),
        'content', to_jsonb(created_content)
      );
    end if;

    update public.ai_commands
    set
      status = 'succeeded',
      before_state = command_before_state,
      after_state = command_after_state,
      error_code = null,
      applied_at = now()
    where user_id = p_user_id and id = p_command_id
    returning * into command_record;
  exception when others then
    update public.ai_commands
    set status = 'failed',
      before_state = coalesce(command_before_state, jsonb_build_object('node', to_jsonb(target))),
      error_code = case SQLSTATE
        when '40P01' then 'AI_COMMAND_DEADLOCK'
        when '40001' then 'AI_COMMAND_SERIALIZATION_FAILURE'
        when '55P03' then 'AI_COMMAND_LOCK_TIMEOUT'
        else 'AI_COMMAND_FAILED'
      end
    where user_id = p_user_id and id = p_command_id
    returning * into command_record;
  end;

  return jsonb_build_object(
    'status', command_record.status,
    'command', to_jsonb(command_record)
  );
end;
$$;

create or replace function public.create_ai_command(
  p_user_id uuid,
  p_thread_id uuid,
  p_tool_call_id text,
  p_operation text,
  p_target_node_id uuid,
  p_expected_revision bigint,
  p_idempotency_key text,
  p_input jsonb,
  p_approval_source text,
  p_risk text,
  p_approval_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  command_record public.ai_commands%rowtype;
  permission_mode text;
  effective_approval_source text;
begin
  if (select auth.uid()) is distinct from p_user_id then
    return jsonb_build_object('status', 'not_found');
  end if;

  perform set_config('folune.ai_command_mutation', 'on', true);

  select settings.permission_mode
  into permission_mode
  from public.ai_user_settings settings
  where settings.user_id = p_user_id;

  permission_mode := coalesce(permission_mode, 'ask');
  effective_approval_source := case
    when permission_mode = 'ask' and p_approval_source = 'manual' then 'manual'
    when permission_mode = 'auto_approve'
      and p_approval_source in ('manual', 'approval_agent') then p_approval_source
    when permission_mode = 'full_access'
      and p_approval_source in ('manual', 'full_access') then p_approval_source
    else null
  end;

  insert into public.ai_commands (
    user_id,
    thread_id,
    tool_call_id,
    operation,
    target_node_id,
    expected_revision,
    idempotency_key,
    input,
    status,
    approval_source,
    risk,
    approval_reason
  ) values (
    p_user_id,
    p_thread_id,
    nullif(btrim(p_tool_call_id), ''),
    p_operation,
    p_target_node_id,
    p_expected_revision,
    btrim(p_idempotency_key),
    coalesce(p_input, '{}'::jsonb),
    case when effective_approval_source is null then 'pending_approval' else 'approved' end,
    effective_approval_source,
    p_risk,
    p_approval_reason
  )
  on conflict (user_id, idempotency_key) do nothing
  returning * into command_record;

  if not found then
    select * into command_record
    from public.ai_commands
    where user_id = p_user_id and idempotency_key = btrim(p_idempotency_key);
  end if;

  if command_record.status = 'approved' then
    return public.apply_ai_command(p_user_id, command_record.id);
  end if;

  return jsonb_build_object(
    'status', command_record.status,
    'command', to_jsonb(command_record)
  );
end;
$$;

create or replace function public.approve_ai_command(
  p_user_id uuid,
  p_command_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  command_record public.ai_commands%rowtype;
begin
  if (select auth.uid()) is distinct from p_user_id then
    return jsonb_build_object('status', 'not_found');
  end if;

  perform set_config('folune.ai_command_mutation', 'on', true);

  update public.ai_commands
  set status = 'approved', approval_source = 'manual'
  where user_id = p_user_id
    and id = p_command_id
    and status = 'pending_approval'
  returning * into command_record;

  if found then
    return public.apply_ai_command(p_user_id, p_command_id);
  end if;

  select * into command_record
  from public.ai_commands
  where user_id = p_user_id and id = p_command_id;

  if not found then return jsonb_build_object('status', 'not_found'); end if;
  return jsonb_build_object('status', command_record.status, 'command', to_jsonb(command_record));
end;
$$;

create or replace function public.reject_ai_command(
  p_user_id uuid,
  p_command_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  command_record public.ai_commands%rowtype;
begin
  if (select auth.uid()) is distinct from p_user_id then
    return jsonb_build_object('status', 'not_found');
  end if;

  perform set_config('folune.ai_command_mutation', 'on', true);

  update public.ai_commands
  set status = 'rejected', approval_source = 'manual'
  where user_id = p_user_id
    and id = p_command_id
    and status = 'pending_approval'
  returning * into command_record;

  if not found then
    select * into command_record
    from public.ai_commands
    where user_id = p_user_id and id = p_command_id;
  end if;

  if command_record.id is null then return jsonb_build_object('status', 'not_found'); end if;
  return jsonb_build_object('status', command_record.status, 'command', to_jsonb(command_record));
end;
$$;

create or replace function public.undo_ai_command(
  p_user_id uuid,
  p_command_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  command_record public.ai_commands%rowtype;
  current_node public.memo_nodes%rowtype;
  restored_node public.memo_nodes%rowtype;
  restored_content public.memos%rowtype;
  after_revision bigint;
  undo_payload jsonb;
begin
  if (select auth.uid()) is distinct from p_user_id then
    return jsonb_build_object('status', 'not_found');
  end if;

  perform set_config('folune.ai_command_mutation', 'on', true);

  select * into command_record
  from public.ai_commands
  where user_id = p_user_id and id = p_command_id
  for update;

  if not found then return jsonb_build_object('status', 'not_found'); end if;
  if command_record.status = 'undone' then
    return jsonb_build_object('status', 'undone', 'command', to_jsonb(command_record));
  end if;
  if command_record.status <> 'succeeded' then
    return jsonb_build_object('status', 'invalid_status', 'command', to_jsonb(command_record));
  end if;

  -- 删除/恢复会锁整棵树，必须先按相同顺序取得树锁，再锁目标。
  -- 否则并发命令各持一个目标锁，进入回收站 RPC 后形成交叉等待。
  if command_record.operation = 'trash_node' then
    perform 1 from public.memo_nodes
    where user_id = p_user_id
    order by id
    for update;
  end if;

  after_revision := (command_record.after_state #>> '{node,revision}')::bigint;
  select * into current_node
  from public.memo_nodes
  where user_id = p_user_id and id = command_record.target_node_id
  for update;

  if not found or current_node.revision <> after_revision then
    update public.ai_commands
    set error_code = 'AI_UNDO_CONFLICT'
    where user_id = p_user_id and id = p_command_id
    returning * into command_record;
    return jsonb_build_object('status', 'conflict', 'command', to_jsonb(command_record));
  end if;

  if command_record.operation = 'create_node' then
    if exists (
      select 1 from public.memo_nodes
      where user_id = p_user_id and parent_id = current_node.id
    ) then
      update public.ai_commands
      set error_code = 'AI_UNDO_CONFLICT'
      where user_id = p_user_id and id = p_command_id
      returning * into command_record;
      return jsonb_build_object('status', 'conflict', 'command', to_jsonb(command_record));
    end if;

    delete from public.memo_nodes
    where user_id = p_user_id and id = current_node.id;
    undo_payload := jsonb_build_object('removed_node_id', current_node.id);

  elsif command_record.operation = 'trash_node' then
    undo_payload := public.restore_memo_node(p_user_id, current_node.id);
    if undo_payload ->> 'status' <> 'restored' then
      return jsonb_build_object('status', 'conflict', 'command', to_jsonb(command_record));
    end if;

  else
    if command_record.operation = 'edit_memo' then
      update public.memos
      set content_mdx = command_record.before_state #>> '{content,content_mdx}'
      where user_id = p_user_id and node_id = current_node.id
      returning * into restored_content;
    else
      update public.memo_nodes
      set
        title = command_record.before_state #>> '{node,title}',
        parent_id = (command_record.before_state #>> '{node,parent_id}')::uuid,
        sort_order = (command_record.before_state #>> '{node,sort_order}')::numeric
      where user_id = p_user_id and id = current_node.id;
    end if;

    select * into restored_node
    from public.memo_nodes
    where user_id = p_user_id and id = current_node.id;
    undo_payload := jsonb_build_object(
      'node', to_jsonb(restored_node),
      'content', case
        when command_record.operation = 'edit_memo' then to_jsonb(restored_content)
        else 'null'::jsonb
      end
    );
  end if;

  update public.ai_commands
  set
    status = 'undone',
    undo_result = undo_payload,
    error_code = null,
    undone_at = now()
  where user_id = p_user_id and id = p_command_id
  returning * into command_record;

  return jsonb_build_object('status', 'undone', 'command', to_jsonb(command_record));
end;
$$;

revoke all on function public.apply_ai_command(uuid, uuid) from public, anon;
revoke all on function public.create_ai_command(uuid, uuid, text, text, uuid, bigint, text, jsonb, text, text, text) from public, anon;
revoke all on function public.approve_ai_command(uuid, uuid) from public, anon;
revoke all on function public.reject_ai_command(uuid, uuid) from public, anon;
revoke all on function public.undo_ai_command(uuid, uuid) from public, anon;

grant execute on function public.create_ai_command(uuid, uuid, text, text, uuid, bigint, text, jsonb, text, text, text) to authenticated;
grant execute on function public.apply_ai_command(uuid, uuid) to authenticated;
grant execute on function public.approve_ai_command(uuid, uuid) to authenticated;
grant execute on function public.reject_ai_command(uuid, uuid) to authenticated;
grant execute on function public.undo_ai_command(uuid, uuid) to authenticated;
