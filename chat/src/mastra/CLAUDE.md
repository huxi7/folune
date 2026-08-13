# chat/src/mastra/
> L2 | 父级: ../../CLAUDE.md

成员清单
index.ts: Mastra 组合根，注册 memo/approval/organize Planner Agents、organize-memo-workflow、全局 HTTP 策略与 /v1/chat、/v1/organize 路由
agents/: Agent 定义边界；对话 Agent 动态接收可信 memo context，独立审批 Agent 无工具/记忆/子代理，Planner 仅生成 JSON 计划，三者都不启用 Mastra Memory
prompts/: 系统提示词资产边界，分别管理对话行为、可信上下文隔离、严格审批输出及整理 Planner 的最小目录策略
tools/: 工具契约边界；庆祝由浏览器回传结果，memo 读写按请求注入且写入仅经 api Command 服务端执行
workflows/: 无副作用整理编排边界，负责 JSON 计划严格解析、目录白名单与确认风险，不持有 JWT 或写数据库
CLAUDE.md: 记录 Mastra 能力层的组合关系与 GEB 回环协议

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
