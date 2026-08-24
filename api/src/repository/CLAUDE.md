# api/src/repository/
> L2 | 父级: ../../CLAUDE.md

成员清单
CLAUDE.md: 记录 repository 数据访问边界与文档协议
memo.repository.ts: 强制 user_id 与已验证 access token，只通过 supabase-rest 执行 active 节点、无正文 summary 列表、单篇正文 CRUD、search_memos_keyword/search_memos_hybrid 两个 PGroonga 检索 RPC、Trash 最小列表与四个删除原子 RPC；中文检索一律走 RPC 而非行过滤，因为 PGroonga `&@*` 相似检索只在索引扫描下生效。存储异常统一净化且不做业务状态判断
ai.repository.ts: 强制 user_id 与已验证 access token，通过 supabase-rest 执行统一 thread 列表/settings/command 读取、UIMessage parts 幂等 upsert，并只经受控 RPC 推进 Command/Run 状态
canvas.repository.ts: 携带用户 JWT 调用 save_exploration_canvas/read_canvas/update_canvas_layout/promote_canvas_node 四个受控 RPC，并提供画布存在性、单卡插入与晋升前的单卡正文读取；多表必须一起成立的动作一律走 RPC，单行插入则走 PostgREST——形状约束与同租户校验由表和触发器保证
profile.repository.ts: 强制传入已验证用户 access token，只通过 supabase-rest 执行 profiles 查询、幂等创建、username/bio 更新与 avatar_url 乐观条件更新

职责: 数据访问层，资源 CRUD 只能携带用户 JWT 调用 lib/supabase-rest.ts 以触发 RLS；禁止业务权限与直接数据库连接。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
