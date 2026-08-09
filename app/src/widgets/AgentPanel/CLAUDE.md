# app/src/widgets/AgentPanel/
> L2 | 父级: ../CLAUDE.md

成员清单
AgentPanel.tsx: 右侧聊天面板，使用 AI SDK useChat 与 deriveAssistantActivity 收敛 submitted/streaming/part 状态，以 onToolCall 把工具交给 clientTools 执行、显式但不等待 addToolResult 回灌真实结果并在完整工具结果后自动续写；等待 addToolResult 会与 AI SDK 当前 stream 的串行任务互锁，禁止改回 await；停止按钮必须同时中止 AI 流与活动庆祝 Canvas；Kumo Button/Input 提供命令，入口与空态使用静态 ThinkingMark，尚无 assistant message 时独立展示正式 ThinkingIndicator
ChatMessage.tsx: AI SDK UIMessage 适配层；用户文本进入 Primary 同源气泡，assistant text 进入无卡片 StreamingText，工具 part 转为 ToolCallBubble、通过客户端工具注册表解析中文显示名，并按互斥 Activity 只保留 Thinking/活动工具/streaming 之一
celebration.ts: 独立于 memoTool Worker 的“庆祝”视觉执行器，忠实保留用户 count；1–32 次渲染等量逻辑波次，更大次数压缩为 32 波性能有界批处理；复用 canvas-confetti 托管的唯一全屏 Canvas 与可用时的内部渲染 Worker，左/中/右三源从网页底边下方少量起步，以 EDGE_START_VELOCITY/CENTER_START_VELOCITY 控制初始射程、以 CELEBRATION_DECAY 收短后续最远端，再以窄锥角先集中上升再自然扩散；count:10 采用 32ms 间隔、约 288ms 完成的无停顿点射，超大次数的释放窗口封顶 400ms；动画可由 cancelCelebration 即时复位，亦会自然完成或由 3 秒看门狗兜底
celebration.test.ts: 庆祝次数与构图回归测试，锁定三源位于底边下方、中心固定/左右镜像、略放宽的窄锥轨迹、单次高密度礼花、count:10 以 32ms 连续点射、超大次数释放窗口有界及无效协议输入降级
clientTools.ts: AgentPanel 客户端工具总线，以 @mastra/client-js 镜像 chat 工具 id/schema；庆祝直达独立视觉执行器，只有备忘录工具进入 Worker 计划后再走真人操作同款乐观 Store/API 链路，并统一输出中文显示名、入参归一化与执行入口
clientTools.test.ts: 工具输入归一测试，覆盖 AI SDK 送达 JSON string、原生 object 及非对象拒绝
memoTool.worker.ts: 专用 Web Worker 入口，接收工具命令、归一化输入与 active tree 快照，返回纯读结果或单步写计划；不持有 token，不访问 API/DOM/Zustand
memoToolPlanner.ts: Worker 纯规划内核，以 schema 和树算法把 read_tree/read_memo 投影为结果，把 edit_node/edit_memo 收敛为现有 Store 可执行的单步计划
memoToolPlanner.test.ts: Worker 规划测试，覆盖整树路径、创建、移动追加、稀疏重排、正文读取与跨目录约束
memoToolSchemas.ts: app 端备忘录工具协议镜像，集中维护 read_tree/edit_node/read_memo/edit_memo 的 zod schema、输入类型与输出类型
memoToolWorkerClient.ts: 主线程到 memoTool.worker 的并发安全 RPC 桥，把每次工具输入与最新 active tree 快照按 requestId 关联到计划结果
activityState.ts: AI Activity 纯判定边界，以 status 和 assistant 最后一个 text/reasoning/step-start/tool part 导出 none/thinking/streaming/tool，工具 output 后只有 SDK 仍 streaming 才回到 thinking
activityState.test.ts: Activity 状态回归测试，覆盖 submitted、首 token、活动工具、工具完成续写、新正文与 ready/error 卸载
chatFetch.ts: 可独立测试的 HTTP 策略层，每次调用 token provider 后注入 Bearer，并把非 2xx 扁平/嵌套信封归一为带 code 的 ChatRequestError
chatTransport.ts: DefaultChatTransport 装配层，复用 shared/supabase/auth 的请求期 getSession token 读取并绑定 VITE_CHAT_BASE_URL 与 /v1/chat，不承载消息状态
chatTransport.test.ts: chatFetch 回归测试，覆盖最新 Bearer 注入、无会话短路及扁平/嵌套错误信封 code 归一
index.ts: AgentPanel 模块稳定出口，隔离 AppDashboard 与内部文件布局

职责: 承载备忘录助手 UI、传输适配与请求期注入的浏览器工具；消息由 useChat 管理，但主要 Activity 必须结合最后一个 UIMessage part 判定，禁止 timer 猜测或 Thinking/Tool/Streaming 叠加；所有已注册客户端工具必须在浏览器真实执行并显式回传结果。庆祝属于独立 DOM/Canvas 工具，不得进入 memoTool Worker；备忘录读写只能由 Worker 处理 Store 快照、主线程复用现有乐观 Store/API/FLIP 动画链路，禁止在 chat Agent 构造器或服务端工具中操作数据库。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
