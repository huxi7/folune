# api/src/repository/
> L2 | 父级: ../../CLAUDE.md

成员清单
CLAUDE.md: 记录 repository 数据访问边界与文档协议
memo.repository.ts: 强制 user_id 与已验证 access token，只通过 supabase-rest 执行 active 节点、无正文 summary 列表、单篇正文 CRUD、search_memos_keyword/search_memos_hybrid 两个 PGroonga 检索 RPC、Trash 最小列表与四个删除原子 RPC；中文检索一律走 RPC 而非行过滤，因为 PGroonga `&@*` 相似检索只在索引扫描下生效。存储异常统一净化且不做业务状态判断，唯一例外是恢复撞上同级重名——那是用户需要改名的具体原因，不能折叠成 502
ai.repository.ts: 强制 user_id 与已验证 access token，通过 supabase-rest 执行统一 thread 列表/settings/command 读取、UIMessage parts 幂等 upsert，并只经受控 RPC 推进 Command/Run 状态
canvas.repository.ts: 携带用户 JWT 调用 Canvas V2 入口/读取/context RPC，并为整树读取提供 canvases 三列只读身份查询（canvases 表的访问只在此收口，memo 域不得自己去读）；人工与 AI 提交都只走 apply_canvas_mutation；运行时代码不暴露旧写函数，所有多表一致性由 SECURITY INVOKER RPC 与 RLS 共同保证
profile.repository.ts: 强制传入已验证用户 access token，只通过 supabase-rest 执行 profiles 查询、幂等创建、username/bio 更新与 avatar_url 乐观条件更新

职责: 数据访问层，资源 CRUD 只能携带用户 JWT 调用 lib/supabase-rest.ts 以触发 RLS；禁止业务权限与直接数据库连接。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
