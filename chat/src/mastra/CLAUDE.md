# chat/src/mastra/
> L2 | 父级: ../../CLAUDE.md

成员清单
index.ts: Mastra 组合根，注册 memo-agent、服务端口、CORS、内置 /health、全局安全日志与 /v1/chat 自定义路由
agents/: Agent 定义边界，不装配静态工具或记忆；请求期客户端工具由 routes 注入
prompts/: 系统提示词资产边界，集中约束协作优先的回答/创作、显式操作与隐含收纳分流、原文/生成双模式及按用户 count 庆祝策略，阻止 Agent 文件内联产品指令
tools/: 客户端工具契约边界，声明庆祝与备忘录树/正文工具的 id/schema，不提供服务端 execute；真实执行结果由 app 回传
CLAUDE.md: 记录 Mastra 能力层的组合关系与 GEB 回环协议

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
