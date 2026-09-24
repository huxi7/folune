-- [INPUT]: 依赖已部署 apply_ai_command/undo_ai_command 定义；保留环境现有 mutation GUC、RLS 和其他逻辑
-- [OUTPUT]: 增量修复回收站命令树锁顺序，并把并发 SQLSTATE 映射为稳定错误码
-- [POS]: ai-command.sql 的现有环境升级脚本；只替换已核实片段，不覆盖远端品牌迁移差异
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

do $patch$
declare
  definition text;
  anchor text;
  lock_prefix text := $lock$  -- 删除/恢复会锁整棵树，必须先按相同顺序取得树锁，再锁目标。
  -- 否则并发命令各持一个目标锁，进入回收站 RPC 后形成交叉等待。
  if command_record.operation = 'trash_node' then
    perform 1 from public.memo_nodes
    where user_id = p_user_id
    order by id
    for update;
  end if;

$lock$;
begin
  definition := pg_get_functiondef('public.apply_ai_command(uuid,uuid)'::regprocedure);
  anchor := $anchor$  if command_record.operation <> 'create_node' then$anchor$;
  if position(lock_prefix in definition) = 0 then
    if position(anchor in definition) = 0 then raise exception 'apply lock anchor changed'; end if;
    definition := replace(definition, anchor, lock_prefix || anchor);
    definition := replace(definition, $old$set status = 'failed', error_code = 'AI_COMMAND_FAILED'$old$, $new$set status = 'failed',
      before_state = coalesce(command_before_state, jsonb_build_object('node', to_jsonb(target))),
      error_code = case SQLSTATE
        when '40P01' then 'AI_COMMAND_DEADLOCK'
        when '40001' then 'AI_COMMAND_SERIALIZATION_FAILURE'
        when '55P03' then 'AI_COMMAND_LOCK_TIMEOUT'
        else 'AI_COMMAND_FAILED'
      end$new$);
    execute definition;
  end if;
  definition := pg_get_functiondef('public.undo_ai_command(uuid,uuid)'::regprocedure);
  anchor := '  after_revision :=';
  if position(lock_prefix in definition) = 0 then
    if position(anchor in definition) = 0 then raise exception 'undo lock anchor changed'; end if;
    execute replace(definition, anchor, lock_prefix || anchor);
  end if;
end;
$patch$;

-- 2026-09-24: Folune-staging 已应用 migration 20260924040636；远端 SECURITY INVOKER/原有 mutation GUC 保持不变。
