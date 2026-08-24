# api/src/router/
> L2 | 父级: ../../CLAUDE.md

成员清单
CLAUDE.md: 记录业务路由装配层职责与文档协议
health.router.ts: 挂载 GET / 并通过 service 返回已校验健康状态
index.ts: 聚合 health/profile、memo tree/search（关键词 + related）/detail 与 ai-threads/context/settings/commands/runs 资源路径
ai.router.ts: 挂载无归档 query 的 /ai-threads、/ai-context/resolve、/ai-settings、/ai-commands 与 /ai-runs 全部 JWT 资源，只负责 zod 输入与 AI services 下传
memo.router.ts: 提供不含正文的 active tree、关键词命中摘要、POST /memo-search/related 相似召回、单篇正文 CRUD 及回收站列表/清空、节点软删/恢复/永久删除；只做认证、参数/query/body 校验与 service 调用。related 用 POST 而非 query string，因为查询文字可以是一整段正文，且日志契约禁止 query string 落盘
profile.router.ts: 提供 JWT 保护的 GET/PATCH /profile 与 PUT /profile/avatar，认证后读取 JSON 或 multipart avatar File 并下传 service
canvas.router.ts: 挂载 POST /canvases 保存、GET /canvases/:nodeId 读取、PATCH /canvases/:nodeId 视口与坐标、POST /canvases/:nodeId/cards 新增摘录/原生卡片、POST /canvas-cards/:cardId/promote 晋升；只做认证、zod 校验与 service 下传
request.ts: 统一提取 Authorization Bearer，并将 JSON body、query、路由参数交给 zod 后转换为一致的 400 输入错误

职责: HTTP 路由层，只挂路径、读请求、zod 校验、调 service、返回响应；禁止业务判断。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
