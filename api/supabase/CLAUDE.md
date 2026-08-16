# api/supabase/
> L2 | 父级: ../CLAUDE.md

成员清单
CLAUDE.md: 记录 Supabase 数据库契约层职责与文档协议
profiles.sql: 建立只含 id/email/username/avatar_url/bio 的 public.profiles；username 是可修改、非唯一的单一展示名称，身份仍由 UUID 与 owner-only RLS 决定
avatars.sql: 建立公开读取 avatars bucket、5MB/JPEG-PNG-WebP 上传限制，以及绑定用户 UUID 目录与 owner_id 的 SELECT/INSERT/DELETE policies
memos.sql: 建立 memo_nodes 邻接树与 memos 正文表，以 deleted_at+deleted_root_id 表达删除批次、父子/正文物理级联，并提供 SECURITY INVOKER 的递归软删/恢复/永久删/当前用户清空 RPC、克制索引及 owner-only RLS/grants
ai.sql: 建立不含归档状态的会话、原始 UIMessage parts、会话级 memo 引用、整理 Run 与可逆 Action；以 owner-only RLS、显式 authenticated grants、引用上限触发器和受控 mutation policy 隔离租户与写入口
remove-ai-thread-archive.sql: 一次性删除 public.ai_threads.status 与旧归档索引；保留历史会话并创建按活动时间排序的新索引
ai-organize.sql: 提供 Run 创建/规划/失败/拒绝状态机和 SECURITY INVOKER 的 apply/undo 原子执行器；固定锁顺序、revision 门禁、真实目录复核、动作倒序恢复与幂等结果共同保护 AI 写操作
ai-organize-grants.sql: 收口 AI 整理六个 SECURITY INVOKER 函数的显式权限；撤销 public/anon/service_role 默认执行权，只向 authenticated 开放 Run 状态机入口
ai-v2.sql: 已部署的默认 ask 账号级 ai_user_settings 与通用 ai_commands 台账契约，以 owner-only RLS、幂等键、状态/操作/revision 约束及显式 grants 分离审批偏好和写审计事实
ai-command.sql: 已部署的 SECURITY INVOKER Command 创建/批准/拒绝/apply/undo 状态机；按账号权限校验审批来源，并以固定锁、expected_revision、软删除与撤销冲突保护真实 memo 写入

职责: 保存可审阅、可顺序部署的 Database/Storage SQL 契约；业务表以 owner-only RLS 与显式 grants 隔离租户，AI 方案只经受控状态机和单事务执行器落地，远端是否已部署必须单独验证，禁止把仓库文件存在误报为线上已应用。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
