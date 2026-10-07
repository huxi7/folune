# chat/src/lib/
> L2 | 父级: ../../CLAUDE.md

成员清单
canvas-chat-session.ts: 请求期只读工具分页读取正文/文字/关系，显式登记引用并逐字验证；模型漏登记时仅补正文中实际出现的已读引句，不用供应商不支持的 required； 提供本轮只读图分页、正文分段与逐字复核引用
canvas-chat-session.test.ts: 验证范围、分段、版本、引文复核、消息落库及越权工具拒绝
canvas-chat-contracts.ts: 提供只读画布问答的范围、快照与证据契约
model-error.ts: 模型错误安全映射，HTTP 402 明确为 DeepSeek 余额不足，识别 cause/重试包装且不转发原始载荷
model-error.test.ts: 余额不足跨包装保留、循环 cause 有界及未知异常净化验证
upstream-http.test.ts: 用停滞响应体验证期限真实生效、重试新连接、写请求不重放与主动取消
upstream-http.ts: Auth/Business API 共享完整 HTTP 读取期限、取消与显式只读重试策略；不接管模型 SSE，也不解析业务身份
banner.ts: 启动时输出一次定宽 ASCII Banner，只呈现服务名、运行时、端口、Agent、模型 ID 与路由等非敏感摘要
token-estimate.ts: 无精确 usage 时按字符长度保守折算 token（偏高估，宁可早触发限流也不放过烧钱）；organize/explore/canvas 的模型调用封装在 workflow 内拿不到真实 usage，用它记账使这些入口也计入每日额度
business-api.ts: prepare-chat 传递画布范围并解析可信冻结图；chat→api 唯一业务 HTTP client；当前 JWT 只在请求期转发，upstream-http 以 30 秒完整响应期限覆盖 prepare/工具/落库并且不重放写请求；用 zod 校验业务资源，含每日额度门禁读取 getUsageStatus 与真实/估算 token 记账 recordUsage 新账本上报带稳定 UUID/服务密钥，失败按同一收据重试一次。
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
