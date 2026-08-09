# chat/src/mastra/
> L2 | 父级: ../../CLAUDE.md

成员清单
index.ts: Mastra 组合根，注册 memo-agent、服务端口、CORS、内置 /health、全局安全日志与 /v1/chat 自定义路由
agents/: Agent 定义边界，装配“庆祝”工具契约但不承载浏览器执行逻辑或记忆
prompts/: 系统提示词资产边界，集中约束回答与“庆祝”工具选择，阻止 Agent 文件内联产品指令
tools/: 工具契约边界，当前只声明由 app 执行并回传结果的“庆祝”浏览器工具
CLAUDE.md: 记录 Mastra 能力层的组合关系与 GEB 回环协议

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
