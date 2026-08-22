# api/src/dto/
> L2 | 父级: ../../CLAUDE.md

成员清单
CLAUDE.md: 记录业务 DTO 层职责与文档协议
auth.dto.ts: 校验 Supabase /auth/v1/user 响应并 infer Auth payload
health.dto.ts: 定义健康检查数据 schema 与 zod infer 类型
memo.dto.ts: 校验含 deleted_root_id 的 memo_nodes、完整/摘要 memos、正文搜索 query、Trash 最小摘要及四个 RPC 返回，并维持创建/更新/重命名/移动 strict body 与 UUID param 白名单
ai.dto.ts: 校验无归档状态的 AI threads、原始 UIMessage parts、携带 expected revision 的消息级冻结 context、最多五篇 refs、三档权限、六种 Command、OrganizePlan/Run 行与全部 strict HTTP/RPC 输入
profile.dto.ts: 校验五字段 profiles PostgREST 行与 username/bio 严格白名单 PATCH body；username 必须非空，avatar_url 只允许头像替换用例写入

职责: 数据传输对象层，只定义 zod schema 与 infer 类型；禁止 import Hono。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
