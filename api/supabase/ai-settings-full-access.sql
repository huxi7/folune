-- [INPUT]: 依赖 ai_user_settings 与已部署 create_ai_command；保留各环境现有 mutation GUC、RLS 与函数权限
-- [OUTPUT]: 默认完全访问；只迁移从未更新的旧 ask 默认值，明确选择不改，命令缺失设置时使用同一默认
-- [POS]: AI 账号权限的现有环境升级补丁，与 ai-v2.sql/ai-command.sql 的新环境定义保持一致
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

alter table public.ai_user_settings alter column permission_mode set default 'full_access';

update public.ai_user_settings
set permission_mode = 'full_access'
where permission_mode = 'ask' and created_at = updated_at;

-- 只替换默认值片段，避免覆盖环境已有的品牌 GUC 或其他函数修复。
do $patch$
declare
  definition text;
  old_default text := $old$permission_mode := coalesce(permission_mode, 'ask');$old$;
  new_default text := $new$permission_mode := coalesce(permission_mode, 'full_access');$new$;
begin
  definition := pg_get_functiondef(
    'public.create_ai_command(uuid,uuid,text,text,uuid,bigint,text,jsonb,text,text,text)'::regprocedure
  );
  if position(old_default in definition) > 0 then
    execute replace(definition, old_default, new_default);
  elsif position(new_default in definition) = 0 then
    raise exception 'AI command permission default anchor changed';
  end if;
end;
$patch$;
