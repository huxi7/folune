-- [INPUT]: 依赖 public.ai_runs/public.ai_actions/public.memo_nodes/public.memos、节点 revision 与 authenticated RLS 身份
-- [OUTPUT]: 对外提供 Run 创建/规划/失败/拒绝状态机及 apply/undo 两个 SECURITY INVOKER 原子 RPC
-- [POS]: api/supabase 的 AI 整理安全执行器，以受控状态机锁定真实 Run 与树状态后应用已保存方案，并以动作日志和版本门禁提供幂等撤销
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

create or replace function public.create_ai_organize_run(
  p_user_id uuid,
  p_memo_id uuid,
  p_thread_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_memo public.memo_nodes%rowtype;
  existing_run public.ai_runs%rowtype;
begin
  if (select auth.uid()) is distinct from p_user_id then
    return jsonb_build_object('status', 'not_found');
  end if;

  if length(btrim(p_idempotency_key)) not between 1 and 200 then
    return jsonb_build_object(
      'status', 'invalid',
      'error_code', 'AI_IDEMPOTENCY_KEY_INVALID'
    );
  end if;

  select *
  into existing_run
  from public.ai_runs
  where user_id = p_user_id
    and idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object('status', 'existing', 'run', to_jsonb(existing_run));
  end if;

  select *
  into source_memo
  from public.memo_nodes
  where user_id = p_user_id
    and id = p_memo_id
    and node_type = 'memo'
    and deleted_at is null;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if p_thread_id is not null and not exists (
    select 1
    from public.ai_threads
    where user_id = p_user_id
      and id = p_thread_id
  ) then
    return jsonb_build_object('status', 'thread_not_found');
  end if;

  perform set_config('folune.ai_run_mutation', 'on', true);

  insert into public.ai_runs (
    user_id,
    thread_id,
    memo_id,
    source_revision,
    idempotency_key
  )
  values (
    p_user_id,
    p_thread_id,
    p_memo_id,
    source_memo.revision,
    btrim(p_idempotency_key)
  )
  on conflict (user_id, idempotency_key) do nothing
  returning * into existing_run;

  if not found then
    select *
    into existing_run
    from public.ai_runs
    where user_id = p_user_id
      and idempotency_key = btrim(p_idempotency_key);

    return jsonb_build_object('status', 'existing', 'run', to_jsonb(existing_run));
  end if;

  return jsonb_build_object('status', 'created', 'run', to_jsonb(existing_run));
end;
$$;

create or replace function public.record_ai_organize_plan(
  p_user_id uuid,
  p_run_id uuid,
  p_plan jsonb,
  p_requires_confirmation boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_run public.ai_runs%rowtype;
begin
  if (select auth.uid()) is distinct from p_user_id then
    return jsonb_build_object('status', 'not_found');
  end if;

  if p_plan is null or jsonb_typeof(p_plan) <> 'object' then
    return jsonb_build_object(
      'status', 'invalid',
      'error_code', 'AI_PLAN_INVALID'
    );
  end if;

  perform set_config('folune.ai_run_mutation', 'on', true);

  select *
  into target_run
  from public.ai_runs
  where user_id = p_user_id
    and id = p_run_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if target_run.status <> 'planning' then
    return jsonb_build_object(
      'status', 'invalid_status',
      'run_status', target_run.status
    );
  end if;

  update public.ai_runs
  set
    plan = p_plan,
    status = case
      when p_requires_confirmation then 'awaiting_confirmation'
      else 'planning'
    end,
    error_code = null
  where user_id = p_user_id
    and id = p_run_id
  returning * into target_run;

  return jsonb_build_object('status', target_run.status, 'run', to_jsonb(target_run));
end;
$$;

create or replace function public.reject_ai_organize_run(
  p_user_id uuid,
  p_run_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_run public.ai_runs%rowtype;
begin
  if (select auth.uid()) is distinct from p_user_id then
    return jsonb_build_object('status', 'not_found');
  end if;

  perform set_config('folune.ai_run_mutation', 'on', true);

  select *
  into target_run
  from public.ai_runs
  where user_id = p_user_id
    and id = p_run_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if target_run.status = 'rejected' then
    return jsonb_build_object('status', 'rejected', 'run', to_jsonb(target_run));
  end if;

  if target_run.status <> 'awaiting_confirmation' then
    return jsonb_build_object(
      'status', 'invalid_status',
      'run_status', target_run.status
    );
  end if;

  update public.ai_runs
  set status = 'rejected'
  where user_id = p_user_id
    and id = p_run_id
  returning * into target_run;

  return jsonb_build_object('status', 'rejected', 'run', to_jsonb(target_run));
end;
$$;

create or replace function public.fail_ai_organize_run(
  p_user_id uuid,
  p_run_id uuid,
  p_error_code text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_run public.ai_runs%rowtype;
  normalized_error_code text := left(btrim(p_error_code), 100);
begin
  if (select auth.uid()) is distinct from p_user_id then
    return jsonb_build_object('status', 'not_found');
  end if;

  if normalized_error_code is null or normalized_error_code = '' then
    normalized_error_code := 'AI_RUN_FAILED';
  end if;

  perform set_config('folune.ai_run_mutation', 'on', true);

  update public.ai_runs
  set
    status = 'failed',
    error_code = normalized_error_code
  where user_id = p_user_id
    and id = p_run_id
    and status in ('planning', 'awaiting_confirmation', 'applying')
  returning * into target_run;

  if found then
    return jsonb_build_object('status', 'failed', 'run', to_jsonb(target_run));
  end if;

  select *
  into target_run
  from public.ai_runs
  where user_id = p_user_id
    and id = p_run_id;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  return jsonb_build_object(
    'status', 'invalid_status',
    'run_status', target_run.status
  );
end;
$$;

create or replace function public.apply_ai_organize_run(
  p_user_id uuid,
  p_run_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_run public.ai_runs%rowtype;
  source_memo public.memo_nodes%rowtype;
  updated_memo public.memo_nodes%rowtype;
  destination_folder public.memo_nodes%rowtype;
  created_folder public.memo_nodes%rowtype;
  destination jsonb;
  destination_kind text;
  suggested_title text;
  folder_title text;
  destination_parent_id uuid;
  target_parent_id uuid;
  next_sort_order numeric(20, 8);
  action_sequence integer := 0;
  target_path text;
  run_result jsonb;
begin
  if (select auth.uid()) is distinct from p_user_id then
    return jsonb_build_object('status', 'not_found');
  end if;

  perform set_config('folune.ai_executor', 'on', true);
  perform set_config('folune.ai_run_mutation', 'on', true);

  select *
  into target_run
  from public.ai_runs
  where user_id = p_user_id
    and id = p_run_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if target_run.status = 'succeeded' then
    return jsonb_build_object(
      'status', 'succeeded',
      'run', to_jsonb(target_run)
    );
  end if;

  if target_run.status not in (
    'planning',
    'awaiting_confirmation',
    'applying'
  ) then
    return jsonb_build_object(
      'status', 'invalid_status',
      'run_status', target_run.status
    );
  end if;

  perform 1
  from public.memo_nodes
  where user_id = p_user_id
  order by id
  for update;

  select *
  into source_memo
  from public.memo_nodes
  where user_id = p_user_id
    and id = target_run.memo_id
    and node_type = 'memo'
    and deleted_at is null;

  if not found then
    update public.ai_runs
    set
      status = 'failed',
      error_code = 'AI_MEMO_NOT_FOUND'
    where user_id = p_user_id
      and id = p_run_id
    returning * into target_run;

    return jsonb_build_object('status', 'failed', 'run', to_jsonb(target_run));
  end if;

  if source_memo.revision <> target_run.source_revision then
    update public.ai_runs
    set
      status = 'stale',
      error_code = 'AI_RUN_STALE'
    where user_id = p_user_id
      and id = p_run_id
    returning * into target_run;

    return jsonb_build_object('status', 'stale', 'run', to_jsonb(target_run));
  end if;

  if target_run.plan is null
    or jsonb_typeof(target_run.plan) <> 'object'
    or jsonb_typeof(target_run.plan -> 'destination') <> 'object'
  then
    update public.ai_runs
    set
      status = 'failed',
      error_code = 'AI_PLAN_INVALID'
    where user_id = p_user_id
      and id = p_run_id
    returning * into target_run;

    return jsonb_build_object('status', 'failed', 'run', to_jsonb(target_run));
  end if;

  suggested_title := btrim(target_run.plan ->> 'suggested_title');
  destination := target_run.plan -> 'destination';
  destination_kind := destination ->> 'kind';

  if suggested_title is null
    or length(suggested_title) not between 1 and 500
    or destination_kind is null
    or destination_kind not in ('keep_current', 'existing_folder', 'new_folder')
  then
    update public.ai_runs
    set
      status = 'failed',
      error_code = 'AI_PLAN_INVALID'
    where user_id = p_user_id
      and id = p_run_id
    returning * into target_run;

    return jsonb_build_object('status', 'failed', 'run', to_jsonb(target_run));
  end if;

  if destination_kind = 'keep_current' then
    target_parent_id := source_memo.parent_id;
  elsif destination_kind = 'existing_folder' then
    begin
      target_parent_id := (destination ->> 'folder_id')::uuid;
    exception when invalid_text_representation then
      target_parent_id := null;
    end;

    select *
    into destination_folder
    from public.memo_nodes
    where user_id = p_user_id
      and id = target_parent_id
      and node_type = 'folder'
      and deleted_at is null;

    if not found then
      update public.ai_runs
      set
        status = 'failed',
        error_code = 'AI_DESTINATION_INVALID'
      where user_id = p_user_id
        and id = p_run_id
      returning * into target_run;

      return jsonb_build_object('status', 'failed', 'run', to_jsonb(target_run));
    end if;
  else
    folder_title := btrim(destination ->> 'folder_title');

    begin
      destination_parent_id := case
        when destination ->> 'parent_id' is null then null
        else (destination ->> 'parent_id')::uuid
      end;
    exception when invalid_text_representation then
      destination_parent_id := null;
      folder_title := null;
    end;

    if folder_title is null or length(folder_title) not between 1 and 500 then
      update public.ai_runs
      set
        status = 'failed',
        error_code = 'AI_PLAN_INVALID'
      where user_id = p_user_id
        and id = p_run_id
      returning * into target_run;

      return jsonb_build_object('status', 'failed', 'run', to_jsonb(target_run));
    end if;

    if destination_parent_id is not null then
      perform 1
      from public.memo_nodes
      where user_id = p_user_id
        and id = destination_parent_id
        and node_type = 'folder'
        and deleted_at is null;

      if not found then
        update public.ai_runs
        set
          status = 'failed',
          error_code = 'AI_DESTINATION_INVALID'
        where user_id = p_user_id
          and id = p_run_id
        returning * into target_run;

        return jsonb_build_object('status', 'failed', 'run', to_jsonb(target_run));
      end if;
    end if;

    select coalesce(max(sort_order), 0) + 1000
    into next_sort_order
    from public.memo_nodes
    where user_id = p_user_id
      and parent_id is not distinct from destination_parent_id
      and deleted_at is null;

    insert into public.memo_nodes (
      user_id,
      parent_id,
      node_type,
      title,
      sort_order
    )
    values (
      p_user_id,
      destination_parent_id,
      'folder',
      folder_title,
      next_sort_order
    )
    returning * into created_folder;

    action_sequence := action_sequence + 1;
    insert into public.ai_actions (
      user_id,
      run_id,
      sequence,
      action_type,
      target_node_id,
      before_state,
      after_state
    )
    values (
      p_user_id,
      p_run_id,
      action_sequence,
      'create_folder',
      created_folder.id,
      '{}'::jsonb,
      to_jsonb(created_folder)
    );

    target_parent_id := created_folder.id;
  end if;

  if suggested_title is distinct from source_memo.title then
    action_sequence := action_sequence + 1;
    insert into public.ai_actions (
      user_id,
      run_id,
      sequence,
      action_type,
      target_node_id,
      before_state,
      after_state
    )
    values (
      p_user_id,
      p_run_id,
      action_sequence,
      'rename',
      source_memo.id,
      jsonb_build_object('title', source_memo.title),
      jsonb_build_object('title', suggested_title)
    );
  end if;

  if target_parent_id is distinct from source_memo.parent_id then
    select coalesce(max(sort_order), 0) + 1000
    into next_sort_order
    from public.memo_nodes
    where user_id = p_user_id
      and parent_id is not distinct from target_parent_id
      and deleted_at is null
      and id <> source_memo.id;

    action_sequence := action_sequence + 1;
    insert into public.ai_actions (
      user_id,
      run_id,
      sequence,
      action_type,
      target_node_id,
      before_state,
      after_state
    )
    values (
      p_user_id,
      p_run_id,
      action_sequence,
      'move',
      source_memo.id,
      jsonb_build_object(
        'parent_id', source_memo.parent_id,
        'sort_order', source_memo.sort_order
      ),
      jsonb_build_object(
        'parent_id', target_parent_id,
        'sort_order', next_sort_order
      )
    );
  else
    next_sort_order := source_memo.sort_order;
  end if;

  update public.memo_nodes
  set
    title = suggested_title,
    parent_id = target_parent_id,
    sort_order = next_sort_order
  where user_id = p_user_id
    and id = source_memo.id
  returning * into updated_memo;

  if target_parent_id is null then
    target_path := '/';
  else
    with recursive ancestors as (
      select id, parent_id, title, 1 as depth
      from public.memo_nodes
      where user_id = p_user_id
        and id = target_parent_id

      union all

      select parent.id, parent.parent_id, parent.title, child.depth + 1
      from public.memo_nodes as parent
      join ancestors as child
        on parent.id = child.parent_id
      where parent.user_id = p_user_id
    )
    select '/' || string_agg(title, '/' order by depth desc)
    into target_path
    from ancestors;
  end if;

  run_result := jsonb_build_object(
    'result_revision', updated_memo.revision,
    'memo', to_jsonb(updated_memo),
    'created_folder', case
      when created_folder.id is null then 'null'::jsonb
      else to_jsonb(created_folder)
    end,
    'target_path', target_path
  );

  update public.ai_runs
  set
    status = 'succeeded',
    result = run_result,
    error_code = null,
    applied_at = coalesce(applied_at, now())
  where user_id = p_user_id
    and id = p_run_id
  returning * into target_run;

  return jsonb_build_object('status', 'succeeded', 'run', to_jsonb(target_run));
end;
$$;

create or replace function public.undo_ai_organize_run(
  p_user_id uuid,
  p_run_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_run public.ai_runs%rowtype;
  current_memo public.memo_nodes%rowtype;
  restored_memo public.memo_nodes%rowtype;
  action_record public.ai_actions%rowtype;
  result_revision bigint;
  removed_folder_id uuid;
  folder_retained boolean := false;
  folder_after_state jsonb;
  undo_result jsonb;
begin
  if (select auth.uid()) is distinct from p_user_id then
    return jsonb_build_object('status', 'not_found');
  end if;

  perform set_config('folune.ai_executor', 'on', true);
  perform set_config('folune.ai_run_mutation', 'on', true);

  select *
  into target_run
  from public.ai_runs
  where user_id = p_user_id
    and id = p_run_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  if target_run.status = 'undone' then
    return jsonb_build_object('status', 'undone', 'run', to_jsonb(target_run));
  end if;

  if target_run.status <> 'succeeded' then
    return jsonb_build_object(
      'status', 'invalid_status',
      'run_status', target_run.status
    );
  end if;

  perform 1
  from public.memo_nodes
  where user_id = p_user_id
  order by id
  for update;

  begin
    result_revision := (target_run.result ->> 'result_revision')::bigint;
  exception when invalid_text_representation or null_value_not_allowed then
    result_revision := null;
  end;

  select *
  into current_memo
  from public.memo_nodes
  where user_id = p_user_id
    and id = target_run.memo_id
    and node_type = 'memo'
    and deleted_at is null;

  if not found or result_revision is null then
    return jsonb_build_object(
      'status', 'conflict',
      'error_code', 'AI_UNDO_CONFLICT'
    );
  end if;

  if current_memo.revision <> result_revision then
    return jsonb_build_object(
      'status', 'conflict',
      'error_code', 'AI_UNDO_CONFLICT'
    );
  end if;

  for action_record in
    select *
    from public.ai_actions
    where user_id = p_user_id
      and run_id = p_run_id
    order by sequence desc
  loop
    if action_record.action_type = 'move' then
      update public.memo_nodes
      set
        parent_id = (action_record.before_state ->> 'parent_id')::uuid,
        sort_order = (action_record.before_state ->> 'sort_order')::numeric
      where user_id = p_user_id
        and id = action_record.target_node_id;
    elsif action_record.action_type = 'rename' then
      update public.memo_nodes
      set title = action_record.before_state ->> 'title'
      where user_id = p_user_id
        and id = action_record.target_node_id;
    elsif action_record.action_type = 'create_folder' then
      folder_after_state := action_record.after_state;

      if exists (
        select 1
        from public.memo_nodes
        where user_id = p_user_id
          and parent_id = action_record.target_node_id
      ) or not exists (
        select 1
        from public.memo_nodes
        where user_id = p_user_id
          and id = action_record.target_node_id
          and node_type = 'folder'
          and deleted_at is null
          and title = folder_after_state ->> 'title'
          and parent_id is not distinct from
            (folder_after_state ->> 'parent_id')::uuid
          and revision = (folder_after_state ->> 'revision')::bigint
      ) then
        folder_retained := true;
      else
        delete from public.memo_nodes
        where user_id = p_user_id
          and id = action_record.target_node_id;

        removed_folder_id := action_record.target_node_id;
      end if;
    end if;
  end loop;

  select *
  into restored_memo
  from public.memo_nodes
  where user_id = p_user_id
    and id = target_run.memo_id;

  undo_result := jsonb_build_object(
    'memo', to_jsonb(restored_memo),
    'removed_folder_id', removed_folder_id,
    'folder_retained', folder_retained
  );

  update public.ai_actions
  set undone_at = coalesce(undone_at, now())
  where user_id = p_user_id
    and run_id = p_run_id;

  update public.ai_runs
  set
    status = 'undone',
    result = coalesce(result, '{}'::jsonb)
      || jsonb_build_object('undo', undo_result),
    undone_at = coalesce(undone_at, now())
  where user_id = p_user_id
    and id = p_run_id
  returning * into target_run;

  return jsonb_build_object('status', 'undone', 'run', to_jsonb(target_run));
end;
$$;
