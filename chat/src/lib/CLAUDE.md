# chat/src/lib/
> L2 | 父级: ../../CLAUDE.md

成员清单
banner.ts: 启动时输出一次定宽 ASCII Banner，只呈现服务名、运行时、端口、Agent、模型 ID 与路由等非敏感摘要
business-api.ts: chat→api 唯一业务 HTTP client，请求期转发当前 Bearer JWT，校验一次性 Chat turn prepare、thread/frozen-context/settings/command/run 以及含 canvas 的轻量 tree/单篇 memo 资源；导出轻量树 schema 锁定资源边界，canvas 只穿过校验、由模型投影显式过滤，token 绝不记录或持久化
business-api.test.ts: 轻量树资源 schema 回归测试，证明 canvas 节点不会在进入 Planner 投影前触发 Chat 502
canvas-expand-service.ts: Canvas AI 只读编排内核，先用可信 checkpoint 短路，否则只排除直接邻居并复用 Explore 正文/判断/引文复核链，返回 revision 候选而不写业务库
canvas-expand-service.test.ts: 锁定 up-to-date 零正文零模型、incomplete 继续、直接邻居排除、已有 Canvas memo 补边、零结果完整与模型失败不推进
approval-contracts.ts: approval-agent 的 approve/manual/deny + risk + reason 严格结构化契约与非法输出手工兜底
approval-coordinator.ts: Chat 独立审批协调器，仅在智能审批实验调用 approvalAgent；综合用户原话、冻结来源、胖工具参数、实际目标与影响范围，失败/非法/manual/deny 一律转人工
memo-agent-context.ts: 在 RequestContext 中短暂承载可信 ResolvedContext 的非序列化盒；toJSON 主动隐藏正文，供动态 Agent instructions 请求期读取
organize-contracts.ts: 定义严格 OrganizePlan/PlannerInput schema，把可含 canvas 的轻量整树与单独读取的目标正文裁剪为仅 folder/memo 的导航/目标投影；兼容纯 JSON/JSON fence 文本后仍经 Zod/目录白名单校验，并以置信阈值和 new_folder 规则确定确认风险
organize-contracts.test.ts: 锁定整理最小投影、同树 canvas 隔离、供应商无 response_format 时的 JSON 文本严格解析、低置信/new_folder 确认和模型伪造 folder ID 拒绝
explore-contracts.ts: 定义探索领域契约: 候选投影只带查询文字与单篇正文（不带 node_id，故模型无从编造范围外 ID）、keep 判别联合 schema（不相关只需 {"keep":false}）、逐字摘录对真实正文的容噪复核，以及按置信度降序、召回名次稳定兜底的服务端排序; 摘录对不上即整条丢弃，丢弃原因分三类计数供可观测
explore-contracts.test.ts: 锁定 JSON fence 剥离与截断输出拒绝、伪造与语义改写摘录必被丢弃、空白/引号/省略号容噪必被接受，以及排序由置信度而非召回名次决定、judged_irrelevant 与 judge_failed 分别计数
CLAUDE.md: 记录 chat 通用运行时能力的职责边界与 GEB 回环协议

职责: 承载不属于业务、路由或配置的服务端运行时能力；任何输出都必须保持密钥、JWT 与完整鉴权材料不可见。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
