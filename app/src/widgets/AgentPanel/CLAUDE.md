# app/src/widgets/AgentPanel/
> L2 | 父级: ../CLAUDE.md

成员清单
AgentPanel.tsx: 右侧聊天面板，使用 AI SDK useChat 与 deriveAssistantActivity 收敛 submitted/streaming/part 状态，以 Kumo Button/Input 提供命令；入口与空态使用静态 ThinkingMark，尚无 assistant message 时独立展示正式 ThinkingIndicator
ChatMessage.tsx: AI SDK UIMessage 适配层；用户文本进入 Primary 同源气泡，assistant text 进入无卡片 StreamingText，工具 part 转为 ToolCallBubble，并按互斥 Activity 只保留 Thinking/活动工具/streaming 之一
activityState.ts: AI Activity 纯判定边界，以 status 和 assistant 最后一个 text/reasoning/step-start/tool part 导出 none/thinking/streaming/tool，工具 output 后只有 SDK 仍 streaming 才回到 thinking
activityState.test.ts: Activity 状态回归测试，覆盖 submitted、首 token、活动工具、工具完成续写、新正文与 ready/error 卸载
chatFetch.ts: 可独立测试的 HTTP 策略层，每次调用 token provider 后注入 Bearer，并把非 2xx 扁平/嵌套信封归一为带 code 的 ChatRequestError
chatTransport.ts: DefaultChatTransport 装配层，复用 shared/supabase/auth 的请求期 getSession token 读取并绑定 VITE_CHAT_BASE_URL 与 /v1/chat，不承载消息状态
chatTransport.test.ts: chatFetch 回归测试，覆盖最新 Bearer 注入、无会话短路及扁平/嵌套错误信封 code 归一
index.ts: AgentPanel 模块稳定出口，隔离 AppDashboard 与内部文件布局

职责: 承载备忘录助手 UI 与传输适配；消息由 useChat 管理，但主要 Activity 必须结合最后一个 UIMessage part 判定，禁止 timer 猜测或 Thinking/Tool/Streaming 叠加；工具 part 只负责展示不在前端执行，面板开关由 shared/store 管理，身份只转发 access token 并由 chat 服务验证。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
