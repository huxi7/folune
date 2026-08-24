# chat/src/mastra/agents/
> L2 | 父级: ../CLAUDE.md

成员清单
memo-agent.ts: 备忘录 Agent，按请求组合基础提示词与冻结 API memo context；构造器不绑定工具/记忆，服务端工具由 chat 路由注入且无审批权
approval-agent.ts: 固定模型、无工具、无记忆、无子代理的独立审批 Agent，只输出严格风险决定，由 Chat 协调器调用而非挂到 memoAgent
organize-planner-agent.ts: 固定模型的无工具无记忆整理 Planner，只产出待本地 Zod 校验的 JSON 语义判断，执行权与风险规则不进入 Agent
explore-agent.ts: 固定模型的无工具无记忆关联判断器，一次只判断一篇候选是否与手上内容真相关；输出预算刻意放宽，因为推理与正文共享同一预算，给小了会「思考塞满、正文为空」。召回、并行调度、摘录复核与排序都不在 Agent 内
CLAUDE.md: 记录 Agent 子域的成员、能力边界与 GEB 回环协议

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
