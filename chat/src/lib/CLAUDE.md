# chat/src/lib/
> L2 | 父级: ../../CLAUDE.md

成员清单
banner.ts: 启动时输出一次定宽 ASCII Banner，只呈现服务名、运行时、端口、Agent、模型 ID 与路由等非敏感摘要
CLAUDE.md: 记录 chat 通用运行时能力的职责边界与 GEB 回环协议

职责: 承载不属于业务、路由或配置的服务端运行时能力；任何输出都必须保持密钥、JWT 与完整鉴权材料不可见。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
