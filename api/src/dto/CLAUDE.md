# api/src/dto/
> L2 | 父级: ../../CLAUDE.md

成员清单
CLAUDE.md: 记录业务 DTO 层职责与文档协议
auth.dto.ts: 校验 Supabase /auth/v1/user 响应并 infer Auth payload
health.dto.ts: 定义健康检查数据 schema 与 zod infer 类型
memo.dto.ts: node_type 枚举含 canvas，故整树读取认得画布节点；校验含 deleted_root_id 的 memo_nodes、完整/摘要 memos、关键词搜索 query、related strict body（查询文字上限与排除节点白名单）、关键词/混合召回两个检索 RPC 结果、Trash 最小摘要及四个删除 RPC 返回，并维持创建/更新/重命名/移动 strict body 与 UUID param 白名单
ai.dto.ts: 校验无归档状态的 AI threads、原始 UIMessage parts、携带 expected revision 的消息级冻结 context、bootstrap/prepare-chat 增量消息、稳定 assistant message id、最多五篇 refs、三档权限、六种 Command、OrganizePlan/Run 行、每日用量行与 increment_ai_usage_daily 累计值 RPC 结果、记账 body 与全部 strict HTTP/RPC 输入
canvas.dto.ts: 以 strict 判别联合校验 Canvas V2 默认/空白入口、无正文读取、人工/AI 共用的有限 mutation 操作、expansion context 与整树用的画布身份三列行；protocol_version、100 操作上限、空间文字宽高与 text_scale（0.25–8）几何边界、稳定 mutation_id 和 RPC status 都在此收口
profile.dto.ts: 校验五字段 profiles PostgREST 行与 username/bio 严格白名单 PATCH body；username 必须非空，avatar_url 只允许头像替换用例写入

职责: 数据传输对象层，只定义 zod schema 与 infer 类型；禁止 import Hono。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
