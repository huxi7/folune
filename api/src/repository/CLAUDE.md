# api/src/repository/
> L2 | 父级: ../../CLAUDE.md

成员清单
CLAUDE.md: 记录 repository 数据访问边界与文档协议
memo.repository.ts: 强制 user_id 与已验证 access token，只通过 supabase-rest 执行 active 节点/正文 CRUD、Trash 最小列表查询与四个原子 RPC；存储异常统一净化且不做业务状态判断
ai.repository.ts: 强制 user_id 与已验证 access token，通过 supabase-rest 执行统一 thread 列表/settings/command 读取、UIMessage parts 幂等 upsert，并只经受控 RPC 推进 Command/Run 状态
profile.repository.ts: 强制传入已验证用户 access token，只通过 supabase-rest 执行 profiles 查询、幂等创建、username/bio 更新与 avatar_url 乐观条件更新

职责: 数据访问层，资源 CRUD 只能携带用户 JWT 调用 lib/supabase-rest.ts 以触发 RLS；禁止业务权限与直接数据库连接。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
