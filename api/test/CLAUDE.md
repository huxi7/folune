# api/test/
> L2 | 父级: ../CLAUDE.md

成员清单
CLAUDE.md: 记录 API 内存集成测试职责与文档协议
memo.test.ts: 以 Hono app 和内存 Supabase Auth/PostgREST mock 验证 active memo 整树、创建补偿、JWT owner 隔离、标题/正文更新、空白保真、移动防环及回收站端点认证
memo-trash.test.ts: 以内存 RPC/级联模型回归软删、顶层 Trash、批次独立恢复/祖先阻断、正常入口隔离、Folder 永久级联、当前用户清空、重复操作与异常净化
ai.test.ts: 以内存 Auth/PostgREST/RPC 全链路验证无归档状态的 thread CRUD 与废弃字段拒绝、冻结 snapshot、refs、三档权限、Command revision/幂等/owner/undo 与 Organize Run 生命周期
profile.test.ts: 以同源内存 mock 验证 Profile 幂等建档、字段白名单、头像格式/体积校验、Storage 生命周期与并发补偿
canvas-v2.test.ts: Canvas V2 HTTP 纵向契约测试；锁定 memo 默认/空白持久入口、strict protocol=2、人工/AI 共用 apply_canvas_mutation、空间文字 text_scale 几何边界、409 当前版本恢复事实与不含正文的可信 expansion context
request-log.test.ts: 验证开发请求卡片、健康探针摘要、生产 JSON 日志，以及控制字符净化与敏感请求信息不落日志

职责: API 的无远端依赖 HTTP 回归层；通过真实 router/service/repository 调用链验证鉴权、业务不变量和 Supabase REST 请求契约，禁止保存或输出真实凭据。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
