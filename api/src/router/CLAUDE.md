# api/src/router/
> L2 | 父级: ../../CLAUDE.md

成员清单
CLAUDE.md: 记录业务路由装配层职责与文档协议
health.router.ts: 挂载 GET / 并通过 service 返回已校验健康状态
index.ts: 聚合 health/profile、memo 与 ai-threads/context/settings/commands/runs 资源路径
ai.router.ts: 挂载无归档 query 的 /ai-threads、/ai-context/resolve、/ai-settings、/ai-commands 与 /ai-runs 全部 JWT 资源，只负责 zod 输入与 AI services 下传
memo.router.ts: 提供 active tree CRUD 及回收站列表/清空、节点软删/恢复/永久删除；只做认证、参数/body 校验与 service 调用
profile.router.ts: 提供 JWT 保护的 GET/PATCH /profile 与 PUT /profile/avatar，认证后读取 JSON 或 multipart avatar File 并下传 service
request.ts: 统一提取 Authorization Bearer，并将 JSON body、query、路由参数交给 zod 后转换为一致的 400 输入错误

职责: HTTP 路由层，只挂路径、读请求、zod 校验、调 service、返回响应；禁止业务判断。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
