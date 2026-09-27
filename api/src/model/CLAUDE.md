# api/src/model/
> L2 | 父级: ../../CLAUDE.md

成员清单
CLAUDE.md: 记录业务模型层职责与文档协议
auth.model.ts: 定义只能由 Supabase Auth 校验建立的可信 AuthUser
health.model.ts: 定义 healthy 健康状态领域类型
memo.model.ts: 定义含删除批次的 MemoNode、完整 MemoContent、不含 content_mdx 的 MemoContentSummary、递归轻量 MemoTreeNode（canvas 节点附带 MemoCanvasIdentity，folder/memo 连键都不出现）、单篇 MemoDetailNode、关键词命中 MemoSearchHit、带命中通道与融合名次的相似候选 MemoRelatedHit 与 Trash/写入领域类型
ai.model.ts: 定义无归档状态的 AI thread/message/reference、可信 memo context、账号权限、Command/审批/风险、OrganizePlan/Run/Action 与可撤销结果，以及每日用量行 AiUsageDaily 与额度门禁判定 AiDailyUsageStatus（总量/上限/剩余/是否超限）的纯领域契约
profile.model.ts: 定义与 public.profiles 五列同构的最小 Profile 与首次建档数据，username 是非空、可修改且非唯一的展示名称
canvas.model.ts: 定义 Canvas V2 的持久身份/版本、引用快照、原生卡片、带 text_scale 的空间文字节点、同画布边、默认/standalone 入口结果、统一 mutation 回执与不含正文的 expansion context
response.model.ts: 定义 ApiSuccessResponse<T> 与可选携带冲突恢复事实的 ApiErrorResponse<T> 响应信封

职责: 领域模型层，只定义纯 TypeScript 领域与响应类型；禁止 import Hono、zod。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
