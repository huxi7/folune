# app/src/widgets/AgentPanel/
> L2 | 父级: ../CLAUDE.md

成员清单
CLAUDE.md: 记录 AgentPanel 子域成员、依赖方向与 GEB 回环协议
AgentPanelHeader.tsx: 无状态固定顶栏，历史接管标题和左侧返回，新建/收起位置稳定；生产与样板共用
AgentPanel.tsx: AI 组合根，History/Conversation 用撑满高度的 PersistentView 承接；历史从左侧进入，关闭向左回收，单一顶栏由 AgentPanelHeader 接管，对话原位淡换；新会话数据就绪后才替换身份，Composer 单独浮现，创建成功从历史返回新会话，失败保留旧视图并 Toast；菜单与内容 Motion 不接管审批/流式/工具执行协议，隐藏会话保留 Composer 草稿
ApprovalDock.tsx: Composer 上方唯一的紧凑非模态审批视觉原语，统一图标、标题、影响说明、按钮槽位与无蒙层语义；普通工具和 AI 整理审批只能适配它，禁止复制表面
approvalState.ts: 审批状态机纯领域层，只检查末条 assistant；统一负责 requested 单次响应投影、approved 未完成工具恢复候选与 output 结果投影，避免 UI、持久化和恢复各自解释 AI SDK 状态
approvalState.test.ts: 审批状态机回归测试，锁定同一 approval 只响应一次、拒绝不恢复、批准刷新可恢复及结果落地后退出恢复队列
composerSources.ts: Prompt Bar 唯一上下文领域层；当前 memo 与置顶来源保持结构化上下文，手动 @笔记与正文 token 同步删除，全部来源去重、限五篇并生成同一冻结 metadata
composerSources.test.ts: 覆盖当前 memo 默认来源、删除抑制、切换更新、手动/置顶去重、内联 mention 删除同步、发送冻结及发送后草稿来源收束
MentionMenu.tsx: Prompt Bar 与 Canvas Picker 共用的 memo 搜索纯函数及无状态 @列表；列表向上用 PresenceSurface 开合，查询、IME、选择生命周期由 Composer 持有
MentionMenu.test.ts: 覆盖空 @候选、搜索排除、revision、Canvas 节点隔离及轻量渲染结构
PermissionModeControl.tsx: 账号权限偏好控制器，继续只显示 API 确认结果并维持加载/失败门禁；向上/向下菜单统一消费 PresenceSurface，不改变权限或业务调用
aiSettingsCache.ts: 按用户短时缓存已确认审批设置并合并在途读取；侧栏重复挂载直接复用新鲜值，改设置成功后同步写回，不替代服务端权限事实
aiSettingsCache.test.ts: 锁定审批设置缓存的用户隔离、新鲜命中、过期重读、并发合并与成功写回语义
ApprovalCard.tsx: 每次询问与智能审批回退的工具审批语义适配；把人话动作、最小影响说明和危险操作按钮映射到共享 ApprovalDock
OrganizeReviewCard.tsx: AI 整理审批语义适配；只把当前 memo 的 awaiting_confirmation 标题/位置影响与确认/取消映射到共享 ApprovalDock，其他 Run 状态不在 AgentPanel 或 Paper 下方重复展示
OrganizeReviewCard.test.tsx: AI 整理审批 DOM 同构测试，锁定 awaiting_confirmation 复用 agent-approval-dock 且 succeeded 输出为空
ThreadHistory.tsx: 不含重复顶栏的 Panel 历史会话视图，会话行只提供切换、重命名与普通永久删除确认，hover、focus 与当前选中项共享中性表面而不使用品牌蓝底，不建立归档分组或第四栏
organizeClient.ts: 浏览器到 Chat `/v1/organize` 的最小 authenticated client，复用 AI Run mapper，确认/apply/undo 仍经 shared/api/ai 进入 Business API
canvasExpandClient.ts: 浏览器到 Chat `/v1/canvas-expand` 的最小 authenticated client；只发送 canvas_id/source_canvas_node_id/limit 并校验 up_to_date/候选，Chat 不写业务库，最终 intent 仍交给 CanvasSaveCoordinator
canvasExpandClient.test.ts: Canvas expansion 响应契约门禁，锁定身份/版本、最多五项、0..1 confidence 与两种完成状态，畸形 Chat 输出不得进入 Canvas intent
threadSelection.ts: 按用户 localStorage key 选择合法历史 thread，失效偏好回退服务端最近会话
threadSelection.test.ts: 覆盖用户偏好隔离、合法恢复和失效 ID 回退
aiThreadCache.ts: 按用户隔离的 30 秒进程内 AI 会话快照；允许陈旧读取以立即恢复最后可用画面，只服务 stale-while-revalidate，不替代服务端真相
aiThreadCache.test.ts: 锁定 AI 快照用户隔离、TTL 后仍可陈旧读取与局部更新不清空其余内容
useAiThreads.ts: 会话控制器与显式只读数据预热入口；Workspace 空闲预热只缓存已有会话，空账号仍等用户真正打开面板才创建首个会话；预热与面板初始化共用同一在途请求，重挂载先显示进程内快照，新鲜命中不请求、陈旧命中后台校准，CRUD 后同步修正快照
AgentProcessDisclosure.tsx: 真实生成过程的透明披露容器，生成期展开、完成后可手动收起，keepMounted Collapse 连续收放且保留内部工具详情状态，不包裹最终正文
ChatMessage.tsx: SuperNoteUIMessage 适配层；冻结上下文只参与请求而不渲染到用户/assistant 对话，assistant 保持单一过程区且不承载审批控件，同轮成功命令只在最终回复末尾提供一个整轮撤销
ChatMessage.test.tsx: 完整回复 DOM 契约测试，锁定单一过程区、审批条非模态且与消息解耦、单一整轮撤销、最终正文边界、冻结来源不污染消息与敏感 ID 屏蔽
composerBehavior.ts: Composer 的纯交互判定，统一非空闲/空白提交保护，并把普通 Enter 与 Shift/修饰键/IME 组合输入严格分流
composerBehavior.test.ts: Composer 键盘与提交契约测试，覆盖普通 Enter、Shift 换行、中文组合输入、Safari 229 兼容、修饰键和空白内容
celebration.ts: 独立于 memoTool Worker 的“庆祝”视觉执行器，忠实保留用户 count；1–32 次渲染等量逻辑波次，更大次数压缩为 32 波性能有界批处理；复用 canvas-confetti 托管的唯一全屏 Canvas 与可用时的内部渲染 Worker，左/中/右三源从网页底边下方少量起步，以 EDGE_START_VELOCITY/CENTER_START_VELOCITY 控制初始射程、以 CELEBRATION_DECAY 收短后续最远端，再以窄锥角先集中上升再自然扩散；count:10 采用 32ms 间隔、约 288ms 完成的无停顿点射，超大次数的释放窗口封顶 400ms；动画可由 cancelCelebration 即时复位，亦会自然完成或由 3 秒看门狗兜底
celebration.test.ts: 庆祝次数与构图回归测试，锁定三源位于底边下方、中心固定/左右镜像、略放宽的窄锥轨迹、单次高密度礼花、count:10 以 32ms 连续点射、超大次数释放窗口有界及无效协议输入降级
clientTools.ts: AgentPanel 客户端工具总线，镜像 celebration 与四个 memo 工具 schema；memo execute 被强制导向 Worker，不能误走庆祝执行器
clientTools.test.ts: 工具输入归一测试，覆盖 AI SDK 送达 JSON string、原生 object 及非对象拒绝
memoTool.worker.ts: 专用模块 Worker 入口，只调用纯 Planner 并用 requestId 返回类型化 plan/error，不持有 token 或运行时状态
memoToolWorkerClient.ts: 主线程并发 RPC 桥，按 requestId 关联/去重请求，Worker 崩溃时统一失败并允许下次重建
memoToolWorkerClient.test.ts: 锁定 Worker Client 正常通信、规划错误、崩溃清场与重复请求只投递一次
memoToolPlanner.ts: 四个胖工具的纯规划内核，基于轻量 Tree Store 快照验证 revision/树约束并生成单步内部命令计划；整树投影按类型谓词滤掉 canvas 节点——工具契约只有 folder/memo，模型因此既看不到画布也无法改名/移动/删除它，这是结构上的收窄而非遗漏；read_memo 只规划可信 nodeId，不接触正文
memoToolPlanner.test.ts: 覆盖整树/read_memo、create/rename/move/reorder/delete 五种 op、edit_memo、stale 与非法移动
memoToolSchemas.ts: 客户端四工具的 zod 契约，与 chat 模型工具保持同构并冻结 expected_revision
memoToolExecution.ts: 主线程可信协调器，把 Worker plan 映射到现有 ai_commands；read_memo 按可信 nodeId 单篇取正文，写操作分别协调 Tree/Document Store 的乐观投影、提交、对账与失败回滚
messagePresentation.ts: UIMessage 有序 part 的纯展示分区，兼容归并历史连续 assistant 分片，以最后一次工具调用为边界保留过程、按 toolCallId 去重，并把同轮成功 commands 提取为回复末尾单一入口所需的反向撤销序列
messagePresentation.test.ts: 回复分区纯函数测试，覆盖历史连续 assistant 归并、过程/工具穿插、重复 toolCall 去重、成功 commands 整轮反向撤销、reasoning 归属和普通回复零过程区
toolPresentation.ts: 工具 Message UI 的唯一展示适配器，先归一化 namespaced 工具名，再基于真实操作、标题和状态生成人话动作及安全详情
toolPresentation.test.ts: 工具展示契约测试，锁定具体动作命名、namespaced 归一、安全详情与未知协议名不外露
activityState.ts: AI Activity 纯判定边界，以 status 和 assistant 最后一个 text/reasoning/step-start/tool part 导出 none/thinking/streaming/tool，工具 output 后只有 SDK 仍 streaming 才回到 thinking
activityState.test.ts: Activity 状态回归测试，覆盖 submitted、首 token、活动工具、工具完成续写、新正文与 ready/error 卸载
chatFetch.ts: 可独立测试的 HTTP 策略层，每次调用 token provider 后注入 Bearer，并把非 2xx 扁平/嵌套信封归一为带 code 的 ChatRequestError
chatTransport.ts: 按 thread 创建 DefaultChatTransport，只发送 thread_id 与携带冻结 metadata 的完整 SuperNoteUIMessage；工具续写不再重读当前页面 memo，并集中导出 chat、organize、canvas-expand 端点 URL
chatTransport.test.ts: chatFetch 回归测试，覆盖最新 Bearer 注入、无会话短路及扁平/嵌套错误信封 code 归一
index.ts: AgentPanel 模块稳定出口，隔离 AppDashboard 与内部文件布局，只额外暴露无 UI 副作用的会话数据预热入口

职责: 承载冻结上下文、唯一 @Prompt Bar、纯净对话、可信工具过程、普通/整理同构的唯一人工裁决 Dock、刷新恢复、撤销和消息传输；当前 memo 只作为默认预选 @进入同一 sources 数组，来源只在发送前 Composer 中可见，发送后不重复进入消息视觉层。审批响应必须先持久化，UI 点击锁与 AI SDK part 状态共同阻止重复执行；已批准未完成工具刷新后可依赖 command/toolCall 幂等恢复。AI 整理只在待确认时占用 Dock，成功后消失，禁止在 Panel 或 Paper 下方重复结果卡。四个 memo 客户端工具经 Worker 纯规划，细分 command 仍由 api 安全执行。备忘录写输入可以乐观投影，但事实只能由 api command output 确认，同一 tool_call_id 只投影一次，失败/拒绝精确回滚，同一 command_id+status 只对账一次。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
