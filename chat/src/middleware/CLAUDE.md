# chat/src/middleware/
> L2 | 父级: ../../CLAUDE.md

成员清单
auth.ts: 从 Bearer JWT 经 Supabase /auth/v1/user 建立可信 userId；每次完整读取最多 6 秒，故障禁用连接复用重试一次，401 不重试；成功身份按 SHA-256(token) 缓存 45 秒，失败不缓存
request-log.ts: 纯格式化安全 HTTP 元数据；开发态输出紧凑彩色 ASCII 卡片与健康摘要，生产态输出单行 JSON
request-logger.ts: 为响应注入 X-Request-Id 并采集无查询串的请求元数据；跳过 Mastra /__* 热更新噪声，SSE 请求只记录响应握手耗时
CLAUDE.md: 记录请求中间件的成员、身份信任边界与 GEB 回环协议

职责: HTTP 横切边界；身份只信 Supabase 验证结果，日志禁止打印 JWT、Authorization、API key、查询串或响应正文。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
