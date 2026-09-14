# chat/src/mastra/prompts/
> L2 | 父级: ../CLAUDE.md

成员清单
index.ts: prompts 子域稳定出口，只转出 memoAgentPrompt，不承载提示词正文
memo-agent.ts: 备忘录助手的协作优先系统提示词，以 XML 分层规定即时协作/显式操作/隐含收纳分流、原文与生成双模式、最小确认和可见执行；字段约束全部留给工具 schema
memo-agent.test.ts: 提示词结构回归测试，锁定协作优先双模式、直接执行原则、旧过度限制不得回归及禁止出现 schema/SQL 实现细节
memo-context.ts: 把 Business API 返回的 primary/references 正文序列化到不可信用户数据区，明确 primary 优先级、截断语义与 prompt injection 隔离
approval-agent.ts: 实验性独立审批规则，限定 approve/manual/deny 与风险理由，强制综合用户原话、实际目标、参数和影响范围，禁止只按 op 判断
organize-planner.ts: 约束 Planner 只返回无 Markdown 前后缀的标题/目录 JSON 对象，优先复用现有目录，并把目标正文和文件夹投影封装为不可信数据以供本地严格验证
explore.ts: 关联判断指令与不可信候选序列化器；把候选标题/正文严格降级为数据，要求逐字摘录并把 confidence 限定为 0..1 JSON 小数，禁止百分数或 1..10/1..100 量表，后端仍以真实正文复核
explore.test.ts: 锁定单篇粒度、果断判断、0..1 confidence、逐字摘录、不相关最小响应及请求不出现候选 node_id
CLAUDE.md: 记录提示词资产的成员、职责边界与 GEB 回环协议

品牌展示: 提示词的产品自称统一为 Folune；Agent ID、name 配置、工具、协议与行为规则保持原样。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
