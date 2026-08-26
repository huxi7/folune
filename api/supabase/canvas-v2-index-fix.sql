-- [INPUT]: 依赖 canvas-v2-schema.sql 已建立的同 Canvas 外键、receipt 与现有单列目标外键
-- [OUTPUT]: 为 Canvas V2 的每条外键查询路径补齐前导列完全匹配的覆盖索引
-- [POS]: api/supabase 的 Canvas V2 性能收口迁移；只补索引，不改变数据、约束或函数语义
-- [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

set local lock_timeout = '5s';

create index canvas_edges_canvas_source_idx
  on public.canvas_edges (canvas_id, source_id);

create index canvas_edges_canvas_target_idx
  on public.canvas_edges (canvas_id, target_id);

create index canvas_mutation_receipts_user_canvas_idx
  on public.canvas_mutation_receipts (user_id, canvas_id);

create index canvas_nodes_target_node_id_idx
  on public.canvas_nodes (target_node_id)
  where target_node_id is not null;

create index canvases_origin_node_id_idx
  on public.canvases (origin_node_id)
  where origin_node_id is not null;
