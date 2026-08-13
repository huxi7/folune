-- [INPUT]: 依赖 ai-organize.sql 已创建的六个 SECURITY INVOKER Run 状态机函数与 authenticated 角色
-- [OUTPUT]: 撤销默认函数权限，仅向 authenticated 授予整理 Run 创建、规划、应用、拒绝、失败和撤销执行权
-- [POS]: api/supabase 的 AI 整理权限清单，将 800 行以内的状态机定义与最小执行授权解耦且保持显式可审计
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

revoke all on function public.apply_ai_organize_run(uuid, uuid)
from public, anon, authenticated, service_role;
revoke all on function public.undo_ai_organize_run(uuid, uuid)
from public, anon, authenticated, service_role;
revoke all on function public.create_ai_organize_run(uuid, uuid, uuid, text)
from public, anon, authenticated, service_role;
revoke all on function public.record_ai_organize_plan(uuid, uuid, jsonb, boolean)
from public, anon, authenticated, service_role;
revoke all on function public.reject_ai_organize_run(uuid, uuid)
from public, anon, authenticated, service_role;
revoke all on function public.fail_ai_organize_run(uuid, uuid, text)
from public, anon, authenticated, service_role;

grant execute on function public.apply_ai_organize_run(uuid, uuid)
to authenticated;
grant execute on function public.undo_ai_organize_run(uuid, uuid)
to authenticated;
grant execute on function public.create_ai_organize_run(uuid, uuid, uuid, text)
to authenticated;
grant execute on function public.record_ai_organize_plan(uuid, uuid, jsonb, boolean)
to authenticated;
grant execute on function public.reject_ai_organize_run(uuid, uuid)
to authenticated;
grant execute on function public.fail_ai_organize_run(uuid, uuid, text)
to authenticated;
