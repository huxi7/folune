# chat/src/routes/
> L2 | 父级: ../../CLAUDE.md

成员清单
chat.ts: 注册 POST /v1/chat，校验含客户端工具 part 的 AI SDK v6 UIMessage，把庆祝与备忘录工具以 params.clientTools 请求期注入，显式锁定 maxSteps=环境默认 50、输出预算与服务端身份上下文后返回 SSE Response
CLAUDE.md: 记录 HTTP 路由的成员、协议边界与 GEB 回环协议

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
