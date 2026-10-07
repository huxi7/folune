# chat/src/routes/
> L2 | 父级: ../../CLAUDE.md

成员清单
canvas-chat-stream.test.ts: 验证服务端读取、引用工具和多步正文在同一请求完成
batch-model-messages.ts: 仅模型上下文投影，去除恢复检查点并压缩批量输出为逐项状态；原始消息和推理完整保留
batch-model-messages.test.ts: 检查点隔离、批量计数与失败真实性、不修改原始 UI 消息的契约验证
chat-stream.test.ts: 真实 AI SDK 流门禁，覆盖续写失败/取消不继承旧用量、失败 finish 保留本轮消耗、等待用量收据且回复可并行保存，以及 finish 无 EOF、流内错误、静默期限、审批并发/顺序、正文即时显示与落库关流
chat-stream.ts: 模型流生命周期，安全错误映射、30 秒静默期限与 finish 即终点；审批四并发且逐项限期；工具续写等待审批、落库与用量记账，用量只取本次原始 finish（含失败生成），拒绝从合并后的 assistant metadata 继承旧消耗；诊断日志不含正文或凭据
chat.ts: 依据 API 快照注入只读服务端工具，验证引用并随消息流保存；POST /v1/chat 冻结上下文、同轮续写与 SSE；进入模型前先查每日额度、超限返回 429；原子与批量工具统一审批，批量按真实目标标题和影响数量裁决，不赋予模型审批权；用 messageMetadata 注入 finish 时模型真实 totalUsage，经 chat-stream 的 onUsage 透出后精确记账
chat-persistence.ts: 提供只含 memo id/title/revision 的用户轮次 context snapshot、同轮 assistant ID/parts 续写、完成/中止/启动失败原位终态和最多一次持久化重试策略
chat-persistence.test.ts: 锁定 context 正文不进入快照、服务端稳定 ID、续写及启动失败不追加重复 assistant、中止状态和一次安全重试生命周期
frozen-turn-context.ts: 冻结画布身份、范围与版本，损坏范围不降级为普通可写会话；从最后用户消息 metadata 读取不可漂移的 active/@refs/revisions，识别以 assistant 结尾的工具续写，旧消息才回退请求级 active memo
frozen-turn-context.test.ts: 损坏画布范围不降级可写； 锁定发送后页面切换不改变本轮 ID/revision、工具续写识别、旧消息回退及不继承早期轮次 context
organize.ts: 注册 POST /v1/organize；进入模型前先查每日额度、超限返回 429；幂等创建 Run，并行读取轻量 tree 与目标 memo 正文后投影输入、执行无副作用 Workflow，并将确认计划或安全自动应用委托给 Business API 状态机；精确 usage 封装在 workflow 内取不到，按输入正文保守估算记账
explore.ts: 注册 POST /v1/explore；进入模型前先查每日额度、超限返回 429；召回宽（12 篇）判定窄（默认留 5 篇），正文按 ID 逐篇取回而不让候选列表携带正文，未选中文字时以整篇为查询，精确 usage 取不到则按查询+召回正文保守估算记账。它是只读的: 不创建 Run、不写库、不经审批链——推荐是瞬时结果，落库只在用户确认后由 api 完成
canvas-expand.ts: 注册 POST /v1/canvas-expand；先查每日额度，重取可信 source/revision/corpus/checkpoint/邻居；完整且未变化时返回 up_to_date，否则返回逐字复核候选；仅实际执行判断时等待估算记账，checkpoint/零候选短路不扣积分，后续复核失败不抹掉已执行消耗
canvas-expand.test.ts: 真实路由回归，锁定完整 checkpoint/零候选/空正文零模型零扣费，以及实际判断和后续复核失败只记一次用量
CLAUDE.md: 记录 HTTP 路由的成员、协议边界与 GEB 回环协议

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
