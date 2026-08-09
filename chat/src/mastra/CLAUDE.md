# chat/src/mastra/
> L2 | 父级: ../../CLAUDE.md

成员清单
index.ts: Mastra 组合根，注册 memo-agent、服务端口、CORS、内置 /health、全局安全日志与 /v1/chat 自定义路由
agents/: 纯聊天 Agent 定义边界，本轮不装配工具或记忆
prompts/: 系统提示词资产边界，阻止 Agent 文件内联产品指令
CLAUDE.md: 记录 Mastra 能力层的组合关系与 GEB 回环协议

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
