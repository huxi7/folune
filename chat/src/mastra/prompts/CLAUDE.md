# chat/src/mastra/prompts/
> L2 | 父级: ../CLAUDE.md

成员清单
index.ts: prompts 子域稳定出口，只转出 memoAgentPrompt，不承载提示词正文
memo-agent.ts: 备忘录助手的协作优先系统提示词，以 XML 分层规定即时协作/显式操作/隐含收纳分流、原文与生成双模式、最小确认和可见执行；字段约束全部留给工具 schema
memo-agent.test.ts: 提示词结构回归测试，锁定协作优先双模式、直接执行原则、旧过度限制不得回归及禁止出现 schema/SQL 实现细节
CLAUDE.md: 记录提示词资产的成员、职责边界与 GEB 回环协议

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
