# chat/src/routes/
> L2 | 父级: ../../CLAUDE.md

成员清单
chat.ts: 注册 POST /v1/chat；冻结 primary/@refs，按账号模式协调独立审批 Agent/Mastra approval；实验审批额外读取实际目标/子树影响，再把批准后的四个客户端工具交给浏览器 Worker
chat-persistence.ts: 提供只含 memo id/title/revision 的用户轮次 context snapshot、稳定 assistant start chunk、终态标记和最多一次持久化重试策略
chat-persistence.test.ts: 锁定 context 正文不进入快照、服务端稳定 ID 下发、中止状态和一次安全重试生命周期
frozen-turn-context.ts: 从最后用户消息 metadata 读取不可漂移的 active/@refs/revisions，旧消息才回退请求级 active memo
frozen-turn-context.test.ts: 锁定发送后页面切换不改变本轮 ID/revision、旧消息回退及不继承早期轮次 context
organize.ts: 注册 POST /v1/organize；幂等创建 Run、投影目标 memo/tree、执行无副作用 Workflow，并将确认计划或安全自动应用委托给 Business API 状态机
CLAUDE.md: 记录 HTTP 路由的成员、协议边界与 GEB 回环协议

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
