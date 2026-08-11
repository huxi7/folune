# app/src/widgets/AgentPanel/
> L2 | 父级: ../CLAUDE.md

成员清单
AgentPanel.tsx: 右侧聊天面板，Header 以共享 48px 高度、32px 标识/关闭容器与 16px ThinkingMark 建立空间节奏；Kumo InputArea 与圆形动作位组成 48px 起步、最多 6 行后内部滚动的单一 Composer 气泡，普通 Enter 发送、Shift+Enter 换行，submitted/streaming 期间保留可编辑草稿并立即显示停止动作；使用 AI SDK useChat 与 deriveAssistantActivity 收敛 submitted/streaming/part 状态，以 onToolCall 把工具交给 clientTools 执行、显式但不等待 addToolResult 回灌真实结果并在完整工具结果后自动续写；等待 addToolResult 会与 AI SDK 当前 stream 的串行任务互锁，禁止改回 await；停止按钮必须同时中止 AI 流与活动庆祝 Canvas，尚无 assistant message 时独立展示正式 ThinkingIndicator
AgentProcessDisclosure.tsx: 单条 assistant 回复的处理过程显隐边界，入口固定在所有过程文字与工具之前；生成期以 ThinkingMark + 真实状态强制展开，完成后保留“思考过程”顶部入口供手动收起/展开，容器永不包裹最终正文
ChatMessage.tsx: AI SDK UIMessage 适配层；用户文本直接进入 Primary 同源气泡且不重复显示“你”，assistant 不显示身份标题，按 messagePresentation 分区后把过程文字/reasoning/工具原位穿插进 AgentProcessDisclosure，并把最终正文留在独立 StreamingText 槽位
ChatMessage.test.tsx: 完整回复 DOM 契约测试，锁定过程文字与工具的真实顺序、折叠入口位于最终正文之前、敏感 ID 不进入界面、普通回复零过程区及双方无可见身份标题
composerBehavior.ts: Composer 的纯交互判定，统一非空闲/空白提交保护，并把普通 Enter 与 Shift/修饰键/IME 组合输入严格分流
composerBehavior.test.ts: Composer 键盘与提交契约测试，覆盖普通 Enter、Shift 换行、中文组合输入、Safari 229 兼容、修饰键和空白内容
celebration.ts: 独立于 memoTool Worker 的“庆祝”视觉执行器，忠实保留用户 count；1–32 次渲染等量逻辑波次，更大次数压缩为 32 波性能有界批处理；复用 canvas-confetti 托管的唯一全屏 Canvas 与可用时的内部渲染 Worker，左/中/右三源从网页底边下方少量起步，以 EDGE_START_VELOCITY/CENTER_START_VELOCITY 控制初始射程、以 CELEBRATION_DECAY 收短后续最远端，再以窄锥角先集中上升再自然扩散；count:10 采用 32ms 间隔、约 288ms 完成的无停顿点射，超大次数的释放窗口封顶 400ms；动画可由 cancelCelebration 即时复位，亦会自然完成或由 3 秒看门狗兜底
celebration.test.ts: 庆祝次数与构图回归测试，锁定三源位于底边下方、中心固定/左右镜像、略放宽的窄锥轨迹、单次高密度礼花、count:10 以 32ms 连续点射、超大次数释放窗口有界及无效协议输入降级
clientTools.ts: AgentPanel 客户端工具总线，以 @mastra/client-js 镜像 chat 工具 id/schema；庆祝直达独立视觉执行器，只有备忘录工具进入 Worker 计划后再走真人操作同款乐观 Store/API 链路，并统一输出协议名类型、入参归一化与执行入口
clientTools.test.ts: 工具输入归一测试，覆盖 AI SDK 送达 JSON string、原生 object 及非对象拒绝
memoTool.worker.ts: 专用 Web Worker 入口，接收工具命令、归一化输入与 active tree 快照，返回纯读结果或单步写计划；不持有 token，不访问 API/DOM/Zustand
memoToolPlanner.ts: Worker 纯规划内核，以 schema 和树算法把 read_tree/read_memo 投影为结果，把 edit_node/edit_memo 收敛为现有 Store 可执行的单步计划
memoToolPlanner.test.ts: Worker 规划测试，覆盖整树路径、创建、移动追加、稀疏重排、正文读取与跨目录约束
memoToolSchemas.ts: app 端备忘录工具协议镜像，集中维护 read_tree/edit_node/read_memo/edit_memo 的 zod schema、输入类型与输出类型
memoToolWorkerClient.ts: 主线程到 memoTool.worker 的并发安全 RPC 桥，把每次工具输入与最新 active tree 快照按 requestId 关联到计划结果
messagePresentation.ts: UIMessage 有序 part 的纯展示分区，以最后一次工具调用为边界保留过程序列，并把工具后的正文稳定留在折叠区之外；无工具普通文本直接成为最终回复
messagePresentation.test.ts: 回复分区纯函数测试，覆盖多轮过程/工具穿插、reasoning 归属和普通回复零过程区
toolPresentation.ts: 工具 Message UI 的唯一展示适配器，基于真实操作、标题和状态生成人话动作名称与目标/位置/结果详情，集中屏蔽 UUID、Token、完整正文和原始 JSON
toolPresentation.test.ts: 工具展示契约测试，锁定具体动作命名、安全详情、节点操作语义与未知协议名不外露
activityState.ts: AI Activity 纯判定边界，以 status 和 assistant 最后一个 text/reasoning/step-start/tool part 导出 none/thinking/streaming/tool，工具 output 后只有 SDK 仍 streaming 才回到 thinking
activityState.test.ts: Activity 状态回归测试，覆盖 submitted、首 token、活动工具、工具完成续写、新正文与 ready/error 卸载
chatFetch.ts: 可独立测试的 HTTP 策略层，每次调用 token provider 后注入 Bearer，并把非 2xx 扁平/嵌套信封归一为带 code 的 ChatRequestError
chatTransport.ts: DefaultChatTransport 装配层，复用 shared/supabase/auth 的请求期 getSession token 读取并绑定 VITE_CHAT_BASE_URL 与 /v1/chat，不承载消息状态
chatTransport.test.ts: chatFetch 回归测试，覆盖最新 Bearer 注入、无会话短路及扁平/嵌套错误信封 code 归一
index.ts: AgentPanel 模块稳定出口，隔离 AppDashboard 与内部文件布局

职责: 承载备忘录助手 UI、传输适配与请求期注入的浏览器工具；消息由 useChat 管理且以 UIMessage.parts 为唯一显示顺序，过程文字与工具可同时保留但 Activity 必须由最后一个 part 判定，禁止 timer 猜测。处理过程只提供透明度，生成期展开、完成后手动折叠；最终正文始终独立且为视觉主角。所有已注册客户端工具必须在浏览器真实执行并显式回传结果。庆祝属于独立 DOM/Canvas 工具，不得进入 memoTool Worker；备忘录读写只能由 Worker 处理 Store 快照、主线程复用现有乐观 Store/API/FLIP 动画链路，禁止在 chat Agent 构造器或服务端工具中操作数据库。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
