# api/src/middleware/
> L2 | 父级: ../../CLAUDE.md

成员清单
CLAUDE.md: 记录业务中间件层职责与文档协议
error-handler.ts: 将 HttpError、404 与未知异常转换为统一错误信封
request-log.ts: 纯格式化安全 HTTP 元数据；开发态输出定宽彩色 ASCII 卡片、Docker 健康摘要，生产态输出单行 JSON
request-logger.ts: 为响应注入 X-Request-Id，采集无查询串的请求元数据并按环境选择 request-log 输出

职责: HTTP 横切层；日志禁止打印 JWT、完整 Authorization header、查询串与完整 Publishable key，控制字符进入终端前必须净化。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
