# chat/src/routes/
> L2 | 父级: ../../CLAUDE.md

成员清单
batch-model-messages.ts: 仅模型上下文投影，去除恢复检查点并压缩批量输出为逐项状态；原始消息和推理完整保留
batch-model-messages.test.ts: 检查点隔离、批量计数与失败真实性、不修改原始 UI 消息的契约验证
chat-stream.test.ts: 402 直接异常与流内余额错误的真实 SSE 门禁； 98 项审批并发上限与总耗时超过单项期限的回归；真实 AI SDK 流门禁，覆盖 finish 无 EOF、流内错误、异常 EOF、空回复、静默期限、主动取消、审批顺序、正文即时显示与落库关流
chat-stream.ts: 模型流生命周期，已净化的余额不足文案跨 SSE 保留，未知错误仍屏蔽原始载荷；审批最多四项并发，每项取得执行槽后单独限期，大批量总耗时不触发静默超时；30 秒无事件即取消，finish 不再等待 EOF，错误/空回复/异常断流转 error 并保留 parts；审批先于 finish，单条消息落库先于客户端续写，失败不伪装成功；诊断日志只记录阶段/事件数/超时，不含正文或凭据
chat.ts: POST /v1/chat 冻结上下文、同轮续写与 SSE；原子与批量工具统一审批，批量按真实目标标题和影响数量裁决，不赋予模型审批权
chat-persistence.ts: 提供只含 memo id/title/revision 的用户轮次 context snapshot、同轮 assistant ID/parts 续写、完成/中止/启动失败原位终态和最多一次持久化重试策略
chat-persistence.test.ts: 锁定 context 正文不进入快照、服务端稳定 ID、续写及启动失败不追加重复 assistant、中止状态和一次安全重试生命周期
frozen-turn-context.ts: 从最后用户消息 metadata 读取不可漂移的 active/@refs/revisions，识别以 assistant 结尾的工具续写，旧消息才回退请求级 active memo
frozen-turn-context.test.ts: 锁定发送后页面切换不改变本轮 ID/revision、工具续写识别、旧消息回退及不继承早期轮次 context
organize.ts: 注册 POST /v1/organize；幂等创建 Run，并行读取轻量 tree 与目标 memo 正文后投影输入、执行无副作用 Workflow，并将确认计划或安全自动应用委托给 Business API 状态机
explore.ts: 注册 POST /v1/explore；召回宽（12 篇）判定窄（默认留 5 篇），正文按 ID 逐篇取回而不让候选列表携带正文，未选中文字时以整篇为查询。它是只读的: 不创建 Run、不写库、不经审批链——推荐是瞬时结果，落库只在用户确认后由 api 完成
canvas-expand.ts: 注册 POST /v1/canvas-expand；浏览器只提供 Canvas/node 定位，服务端从 api 重取可信 source revision、corpus、checkpoint、邻居和正文，完整且未变化时直接返回 up_to_date，否则返回逐字复核候选且不写业务库
CLAUDE.md: 记录 HTTP 路由的成员、协议边界与 GEB 回环协议

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
