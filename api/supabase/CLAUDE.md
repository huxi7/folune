# api/supabase/
> L2 | 父级: ../CLAUDE.md

成员清单
CLAUDE.md: 记录 Supabase 数据库契约层职责与文档协议
profiles.sql: 建立只含 id/email/username/avatar_url/bio 的 public.profiles；username 是可修改、非唯一的单一展示名称，身份仍由 UUID 与 owner-only RLS 决定
avatars.sql: 建立公开读取 avatars bucket、5MB/JPEG-PNG-WebP 上传限制，以及绑定用户 UUID 目录与 owner_id 的 SELECT/INSERT/DELETE policies
memos.sql: 建立 memo_nodes 邻接树与 memos 正文表，以 deleted_at+deleted_root_id 表达删除批次、父子/正文物理级联，并提供 SECURITY INVOKER 的递归软删/恢复/永久删/当前用户清空 RPC、克制索引及 owner-only RLS/grants

职责: 保存经 Supabase MCP 执行并验证的 Database/Storage SQL；业务表以 owner-only RLS 与显式 grants 隔离租户，storage.objects 只通过 policy 管权且文件对象必须走 Storage API。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
