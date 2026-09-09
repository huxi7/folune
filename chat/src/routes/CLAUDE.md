# chat/src/routes/
> L2 | 父级: ../../CLAUDE.md

成员清单
chat.ts: 注册 POST /v1/chat；用一次性 prepare-chat 合并 thread/settings/context 与消息落账，普通发送只接收最后一条消息，冻结 primary/@refs ID，首次生成校验发送时 revision，tool result 续写复用同一 assistant ID；审批判断与模型流并行，流末只 PATCH 当前 assistant
chat-persistence.ts: 提供只含 memo id/title/revision 的用户轮次 context snapshot、同轮 assistant ID/parts 续写、完成/中止/启动失败原位终态和最多一次持久化重试策略
chat-persistence.test.ts: 锁定 context 正文不进入快照、服务端稳定 ID、续写及启动失败不追加重复 assistant、中止状态和一次安全重试生命周期
frozen-turn-context.ts: 从最后用户消息 metadata 读取不可漂移的 active/@refs/revisions，识别以 assistant 结尾的工具续写，旧消息才回退请求级 active memo
frozen-turn-context.test.ts: 锁定发送后页面切换不改变本轮 ID/revision、工具续写识别、旧消息回退及不继承早期轮次 context
organize.ts: 注册 POST /v1/organize；幂等创建 Run，并行读取轻量 tree 与目标 memo 正文后投影输入、执行无副作用 Workflow，并将确认计划或安全自动应用委托给 Business API 状态机
explore.ts: 注册 POST /v1/explore；召回宽（12 篇）判定窄（默认留 5 篇），正文按 ID 逐篇取回而不让候选列表携带正文，未选中文字时以整篇为查询。它是只读的: 不创建 Run、不写库、不经审批链——推荐是瞬时结果，落库只在用户确认后由 api 完成
canvas-expand.ts: 注册 POST /v1/canvas-expand；浏览器只提供 Canvas/node 定位，服务端从 api 重取可信 source revision、corpus、checkpoint、邻居和正文，完整且未变化时直接返回 up_to_date，否则返回逐字复核候选且不写业务库
CLAUDE.md: 记录 HTTP 路由的成员、协议边界与 GEB 回环协议

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
