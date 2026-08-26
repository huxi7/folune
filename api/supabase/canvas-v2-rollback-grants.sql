-- [INPUT]: 依赖三个旧 Canvas 写函数定义仍在数据库；仅在代码回滚到 4c89827 一类旧 checkpoint 时人工执行
-- [OUTPUT]: 恢复 authenticated 对旧探索保存、独立布局与卡片晋升函数的执行权
-- [POS]: Canvas V2 代码回滚的显式权限配套脚本；正常 V2 部署绝不执行，且不改变任何业务数据
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

begin;

grant execute on function public.save_exploration_canvas(
  uuid, text, uuid, numeric, uuid, jsonb, jsonb
) to authenticated;

grant execute on function public.update_canvas_layout(
  uuid, uuid, jsonb, jsonb
) to authenticated;

grant execute on function public.promote_canvas_node(
  uuid, uuid, uuid, numeric, text, text, integer
) to authenticated;

commit;
