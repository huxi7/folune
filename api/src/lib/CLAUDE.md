# api/src/lib/
> L2 | 父级: ../../CLAUDE.md

成员清单
CLAUDE.md: 记录基础库适配层职责与文档协议
banner.ts: 输出纯 ASCII logo、非敏感运行信息与 ready 路由摘要
supabase-auth.ts: 使用 apikey=Publishable key、Authorization=用户 JWT 调用 /auth/v1/user 并返回可信 AuthUser
supabase-rest.ts: 强制注入 apikey=Publishable key、Authorization=用户 JWT，组合 Prefer header 并支持 on_conflict/eq/is/in 查询及 RPC 的唯一 REST/PostgREST fetch 封装；错误保留 PostgREST 的原始 SQLSTATE 供上层认出结构性拒绝（翻译语义归 service，lib 不认识业务概念）；中文检索不在此层表达——PGroonga 相似检索只在索引扫描下生效，必须经 rpc/ 走函数
supabase-storage.ts: 以相同用户 JWT 调用 Storage API 上传/删除 avatars 对象，并集中构造和解析受管公开 URL

职责: 基础设施适配层；PostgREST 与 Storage 必须以 authenticated 用户身份触发 RLS，禁止 ORM、数据库驱动、连接串、service role 与业务权限判断。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
