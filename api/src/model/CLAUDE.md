# api/src/model/
> L2 | 父级: ../../CLAUDE.md

成员清单
CLAUDE.md: 记录业务模型层职责与文档协议
auth.model.ts: 定义只能由 Supabase Auth 校验建立的可信 AuthUser
health.model.ts: 定义 healthy 健康状态领域类型
memo.model.ts: 定义含删除批次的 MemoNode/MemoContent、递归 MemoTreeNode、Trash 最小项目/操作结果及 repository 写入领域类型
profile.model.ts: 定义与 public.profiles 五列同构的最小 Profile 与首次建档数据，username 是非空、可修改且非唯一的展示名称
response.model.ts: 定义 ApiSuccessResponse<T> 与 ApiErrorResponse 响应信封

职责: 领域模型层，只定义纯 TypeScript 领域与响应类型；禁止 import Hono、zod。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
