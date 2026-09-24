# api/src/lib/
> L2 | 父级: ../../CLAUDE.md

成员清单
supabase-http.ts: Auth/PostgREST 共享的完整 HTTP 响应生命周期；GET/HEAD 每次 6 秒且最多两次，写请求 12 秒且不重放；重试使用新连接，读取 body 后才结束期限，定时器随完成释放
CLAUDE.md: 记录基础库适配层职责与文档协议
banner.ts: 输出纯 ASCII logo、非敏感运行信息与 ready 路由摘要
supabase-auth.ts: 使用用户 JWT/Publishable key 调用 /auth/v1/user；复用 supabase-http 的完整响应期限和只读重试后返回可信 AuthUser
supabase-rest.ts: authenticated RLS 的唯一 PostgREST 边界；组装 Prefer/query/RPC 并保留 SQLSTATE，完整响应交给 supabase-http，网络故障映射 503，主动取消透传
supabase-storage.ts: 以相同用户 JWT 调用 Storage API 上传/删除 avatars 对象，并集中构造和解析受管公开 URL

职责: 基础设施适配层；PostgREST 与 Storage 必须以 authenticated 用户身份触发 RLS，禁止 ORM、数据库驱动、连接串、service role 与业务权限判断。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
