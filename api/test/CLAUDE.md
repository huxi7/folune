# api/test/
> L2 | 父级: ../CLAUDE.md

成员清单
CLAUDE.md: 记录 API 内存集成测试职责与文档协议
memo.test.ts: 以 Hono app 和内存 Supabase Auth/PostgREST mock 验证 active memo 整树、创建补偿、JWT owner 隔离、标题/正文更新、空白保真、移动防环及回收站端点认证
memo-trash.test.ts: 以内存 RPC/级联模型回归软删、顶层 Trash、批次独立恢复/祖先阻断、正常入口隔离、Folder 永久级联、当前用户清空、重复操作与异常净化
ai.test.ts: 以内存 Auth/PostgREST/RPC 全链路验证无归档状态的 thread CRUD 与废弃字段拒绝、冻结 snapshot、refs、三档权限、Command revision/幂等/owner/undo 与 Organize Run 生命周期
profile.test.ts: 以同源内存 mock 验证 Profile 幂等建档、字段白名单、头像格式/体积校验、Storage 生命周期与并发补偿
knowledge-canvas.test.ts: 画布保存/读取/布局/新增卡片/晋升的全链路契约测试；RPC mock 忠实复刻 SQL 语义（含晋升后 text 置空与 memo_ref 幂等），并锁定无 Bearer 一律 401、跨租户 404、失联候选跳过计数、载荷永不含 content_mdx，以及摘要/字数/sort_order 确实由 service 派生
request-log.test.ts: 验证开发请求卡片、健康探针摘要、生产 JSON 日志，以及控制字符净化与敏感请求信息不落日志

职责: API 的无远端依赖 HTTP 回归层；通过真实 router/service/repository 调用链验证鉴权、业务不变量和 Supabase REST 请求契约，禁止保存或输出真实凭据。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
