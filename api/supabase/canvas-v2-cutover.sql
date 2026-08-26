-- [INPUT]: 依赖 knowledge-canvas-rpc.sql 中三个旧写函数仍保留定义，以及 Canvas V2 HTTP/SQL 路径已经通过验收
-- [OUTPUT]: 撤销 authenticated 对旧探索保存、独立布局与卡片晋升函数的执行权，只保留 V2 写入内核
-- [POS]: Canvas V2 上线切轨迁移；不删除函数和数据，紧急代码回滚时由 canvas-v2-rollback-grants.sql 显式恢复权限
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

begin;

revoke execute on function public.save_exploration_canvas(
  uuid, text, uuid, numeric, uuid, jsonb, jsonb
) from authenticated;

revoke execute on function public.update_canvas_layout(
  uuid, uuid, jsonb, jsonb
) from authenticated;

revoke execute on function public.promote_canvas_node(
  uuid, uuid, uuid, numeric, text, text, integer
) from authenticated;

commit;
