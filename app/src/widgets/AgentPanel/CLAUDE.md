# app/src/widgets/AgentPanel/
> L2 | 父级: ../CLAUDE.md

成员清单
AgentConversation.tsx: 引用置顶/移除原位显示 WarmTooltip，发送/停止由 Button 同源提供； 单会话Composer/流/审批/八并发工具执行与恢复边界；权限确认后发送，草稿首发保持实例，停止取消排队，后台同步真实消息/命令；完成提示仅来自本次实际处理结束
chatErrorCopy.test.ts: SSE 余额错误显示专门标题，登录和通用错误分类保持
batchCheckpoint.test.ts: 并行批次检查点串行合并不丢记录、末轮恢复与终态不重跑门禁
batchRecovery.ts: 末条 assistant 的审批/检查点恢复候选纯判定，终态和旧轮次不重跑
toolExecutionState.tsx: 会话隔离的 Zustand 执行事实上下文；按 toolCallId 订阅等待/执行/终态及批量快照，不从 SDK 参数状态猜测是否运行
chatErrorCopy.ts: 中英错误分类只翻译界面，不改变服务端事实；HTTP/SSE 错误到用户可读标题与说明的纯适配，模型余额不足单独显示且不误导为网络失败，供会话组合根消费
batchCheckpoint.ts: 串行检查点写入，保存时从最新消息合并目标批次，不把进度当最终工具结果
batchToolExecution.test.ts: 慢保存合并、失败检查点在途补取与双端 schema 同构、100项八并发与补位、失败/停止、初始落库门禁、幂等恢复和批量撤销验证
batchToolExecution.ts: 批量预检与八槽共享调度；稳定子命令幂等键、整批初始检查点、每八项触发合并检查点，只保留在途及最新快照、失败取消本批排队及刷新恢复
BatchToolProgress.tsx: 截断目标与失败原因使用 WarmTooltip 展示； 中英批量状态与读屏标签由locale驱动，目标标题保真；明确批次展示：不足十项直接展示；大量任务显示真实运行项、待执行数量和失败计数，新结果短暂显示勾叉但不占执行槽，完成记录一次展开，以固定行高虚拟列表控制 DOM
AgentToolProgress.tsx: 工具读屏状态按locale投影，推理/正文不翻译；过程展示边界，原始推理与普通工具按顺序显示；转圈只来自实际运行状态，只有明确 edit_nodes 批次交由 BatchToolProgress 聚合
clientToolQueue.ts: 共享工具队列最多八项并发，完成一项立即补位；停止取消排队而保留已提交结果
clientToolQueue.test.ts: 98 项任务并发上限、单项失败释放执行槽、停止取消排队与后续队列复用门禁
CLAUDE.md: 记录 AgentPanel 子域成员、依赖方向与 GEB 回环协议
AgentPanelHeader.tsx: 收起入口仅保留无障碍名称，历史/新建/窗口尺寸仍有功能提示；功能图标复用 Button 默认提示并朝下展开； 无状态同源Header；历史/返回、即时新对话、可选短窗/全高切换与向下收起，复用DS Ghost Button，尺寸模式归外壳
useConversationScroll.test.tsx: 验证首次非平滑定位与退出冻结、迟到内容回调不追尾
useConversationScroll.ts: 消息滚动唯一边界，首次绘制前定位、退出取消平滑滚动并冻结位置，隐藏历史拒绝追尾
AgentPanel.draft.test.tsx: 覆盖首开权限与保存期间按钮/Enter/直接提交不发送；子进程隔离、真实组件/Hook/SDK/transport，验证零写草稿、首发创建/引用/持续消息实例、失败重试、删除与迟到请求隔离
AgentPanel.tsx: 历史/新对话导航与单会话装配；冷启动与切历史共用延迟消息/输入槽位，数据就绪即接管；接收外壳尺寸/放大收起动作，将聊天与整理的真实状态上报胶囊；AgentConversation身份不因场景/尺寸变化而重建
AgentConversationSkeleton.tsx: 冷启动、目标会话与代码加载共用的纯加载构图；180ms 后显示消息文字、浅用户容器与输入/工具行，Composer 保留边框壳，不把输入区涂成整块；不持有请求或会话，真实内容就绪立即卸载
AgentPanel.streaming.test.tsx: 余额不足退出思考、明确提示且不自动重发； 新增流内错误立即停止思考、不执行未确认写工具/自动续写门禁； 子进程隔离 mock，使用真实 useChat/AgentPanel、可控直通流与延迟工具结果，验证连续两轮工具/自动续写稳定、正文首分块在 text-end/finish-step 前已显示且只折叠一次，独立读写工具并发、98 项独立工具顺序展示、100项明确批量八并发与完成列表 DOM 有界，以及停止后不再启动待执行工具或自动续写
AgentPanelNavigation.test.tsx: 会话切换交互回归门禁，以未完成内容请求锁定历史列表立即退出、目标标题与加载壳同步接管
ApprovalDock.tsx: Composer 上方唯一的紧凑非模态审批视觉原语，统一图标、标题、影响说明、按钮槽位与无蒙层语义；普通工具和 AI 整理审批只能适配它，禁止复制表面
approvalState.ts: 审批状态机纯领域层，只检查末条 assistant；统一负责 requested 单次响应投影、approved 未完成工具恢复候选与 output 结果投影，避免 UI、持久化和恢复各自解释 AI SDK 状态
approvalState.test.ts: 审批状态机回归测试，锁定同一 approval 只响应一次、拒绝不恢复、批准刷新可恢复及结果落地后退出恢复队列
composerSources.ts: Prompt Bar 唯一上下文领域层；当前 memo 与置顶来源保持结构化上下文，手动 @笔记与正文 token 同步删除，全部来源去重、限五篇并生成同一冻结 metadata
composerSources.test.ts: 覆盖当前 memo 默认来源、删除抑制、切换更新、手动/置顶去重、内联 mention 删除同步、发送冻结及发送后草稿来源收束
MentionMenu.tsx: 中英菜单/空态标签独立于真实笔记名；Prompt Bar 与 Canvas Picker 共用的 memo 搜索纯函数及无状态 @列表；列表向上用 PresenceSurface 开合，查询、IME、选择生命周期由 Composer 持有
MentionMenu.test.ts: 覆盖空 @候选、搜索排除、revision、Canvas 节点隔离及轻量渲染结构
PermissionModeControl.tsx: locale切换仅改视图，不重发或重置权限请求；当前账号三档权限视图，默认完全访问；API 确认后更新勾选，失败不冒充询问模式且同值可重试；保存独立于卸载/凭据刷新，菜单复用 PresenceSurface
PermissionModeControl.test.tsx: 真实控件生命周期门禁，覆盖默认显示、刷新保留选择、保存中凭据刷新/重挂、旧账号结果隔离与同值重试
aiSettingsCache.ts: 用户级确认快照与 GET/PATCH 协调；读取优先等待在途保存、迟到 GET 不能覆盖 PATCH，保存跨控件卸载写回；命令仍仅合并同凭据在途读取，不借用 UI 快照
aiSettingsCache.test.ts: 锁定 TTL、用户隔离、在途合并、迟到 GET 保护、保存中重挂/凭据刷新读取等待与失败重试；命令权限完成后重读
ApprovalCard.tsx: 中英审批动作与影响说明保留目标名/数量；普通与批量写工具审批适配，统一 ApprovalDock 并显示批量操作及目标数量
OrganizeReviewCard.tsx: 中英确认文案只包装建议标题与目录，不改写建议值；AI 整理审批语义适配；只把当前 memo 的 awaiting_confirmation 标题/位置影响与确认/取消映射到共享 ApprovalDock，其他 Run 状态不在 AgentPanel 或 Paper 下方重复展示
OrganizeReviewCard.test.tsx: AI 整理审批 DOM 同构测试，锁定 awaiting_confirmation 复用 agent-approval-dock 且 succeeded 输出为空
ThreadHistory.tsx: locale统一空态/动作/日期，真实会话标题保真；不含重复顶栏的 Panel 历史会话视图，会话行在 pointer/focus 意图时预取，点击只发出立即导航，另提供重命名与普通永久删除确认；当前项保持中性表面
organizeClient.ts: 浏览器到 Chat `/v1/organize` 的最小 authenticated client，复用 AI Run mapper，确认/apply/undo 仍经 shared/api/ai 进入 Business API
canvasExpandClient.ts: 浏览器到 Chat `/v1/canvas-expand` 的最小 authenticated client；只发送 canvas_id/source_canvas_node_id/limit 并校验 up_to_date/候选，Chat 不写业务库，最终 intent 仍交给 CanvasSaveCoordinator
canvasExpandClient.test.ts: Canvas expansion 响应契约门禁，锁定身份/版本、最多五项、0..1 confidence 与两种完成状态，畸形 Chat 输出不得进入 Canvas intent
threadSelection.ts: 按用户 localStorage key 保存已选 thread 或显式 draft 标记；bootstrap 不把本地草稿标记当服务端 ID，历史选择策略仍按合法 ID 或最近会话回退
threadSelection.test.ts: 覆盖用户偏好隔离、合法恢复和失效 ID 回退
aiThreadCache.ts: 按用户隔离的 30 秒面板快照允许 selectedThread=null 表达草稿；逐会话内容仅缓存已保存 ID、最多八项，允许陈旧回显且不把草稿混入历史
aiThreadCache.test.ts: 锁定面板/逐会话快照的用户隔离、TTL、局部更新、目标删除与有界淘汰
useAiThreads.ts: 会话与本地草稿控制器；新对话、空列表及删完最后一条都不写库，首次发送合并同一创建请求并保存草稿置顶引用，失败可复用已创建 ID；conversationKey 在落库时保持以延续 useChat，bootstrap/内容迟到不覆盖新选择；列表预热、逐会话缓存与流完成本地提交仍收口于此
AgentProcessDisclosure.tsx: 中英处理状态保持同一披露生命周期；单条回复只自动收起一次：处理期展开，正文首分块同帧交接，130ms micro Collapse 与正文同时进行；只有跟随流式正文的自动收起才联动滚动，用户手动展开/收起一律留在原地不甩到底部；后续工具不能自动重开，用户回看独立，工具详情按需挂载
ChatMessage.tsx: locale投影状态/工具动作/撤销，不触碰用户和AI正文；消息语义适配；原始推理即时显示，普通工具按序、明确批量按组，正文首次到达自动收起且允许手动回看；整轮终止后统一撤销成功命令
ChatMessage.interaction.test.tsx: 锁定整轮结束才显示撤销； 生产消息 DOM 生命周期回归，覆盖工具/审批间隙持续展开、正文即折叠、迟到活动不重开、手动回看、新消息重置及停止/失败
ChatMessage.test.tsx: 首 token 前失败移除空思考占位；完整回复 DOM 契约测试，锁定单一过程区、审批条非模态且与消息解耦、单一整轮撤销、最终正文边界、冻结来源不污染消息与敏感 ID 屏蔽
composerBehavior.ts: Composer 的纯交互判定，统一非空闲/空白提交保护，并把普通 Enter 与 Shift/修饰键/IME 组合输入严格分流
composerBehavior.test.ts: Composer 键盘与提交契约测试，覆盖普通 Enter、Shift 换行、中文组合输入、Safari 229 兼容、修饰键和空白内容
celebration.ts: 独立于 memoTool Worker 的“庆祝”视觉执行器，忠实保留用户 count；1–32 次渲染等量逻辑波次，更大次数压缩为 32 波性能有界批处理；复用 canvas-confetti 托管的唯一全屏 Canvas 与可用时的内部渲染 Worker，左/中/右三源从网页底边下方少量起步，以 EDGE_START_VELOCITY/CENTER_START_VELOCITY 控制初始射程、以 CELEBRATION_DECAY 收短后续最远端，再以窄锥角先集中上升再自然扩散；count:10 采用 32ms 间隔、约 288ms 完成的无停顿点射，超大次数的释放窗口封顶 400ms；动画可由 cancelCelebration 即时复位，亦会自然完成或由 3 秒看门狗兜底
celebration.test.ts: 庆祝次数与构图回归测试，锁定三源位于底边下方、中心固定/左右镜像、略放宽的窄锥轨迹、单次高密度礼花、count:10 以 32ms 连续点射、超大次数释放窗口有界及无效协议输入降级
clientTools.ts: 注册四个原子 memo 工具、明确目标清单的 edit_nodes 与 celebration；批量由独立编排器拆为原子 command
clientTools.test.ts: 工具输入归一测试，覆盖 AI SDK 送达 JSON string、原生 object 及非对象拒绝
memoToolPlanner.ts: 四个胖工具的纯规划内核，基于轻量 Tree Store 快照验证 revision/树约束并生成单步内部命令计划；整树投影按类型谓词滤掉 canvas 节点——工具契约只有 folder/memo，模型因此既看不到画布也无法改名/移动/删除它，这是结构上的收窄而非遗漏；read_memo 只规划可信 nodeId，不接触正文
memoToolPlanner.test.ts: 覆盖整树/read_memo、create/rename/move/reorder/delete 五种 op、edit_memo、stale 与非法移动
memoToolPlannerBoundary.test.ts: Planner 纯度静态门禁，以剥离注释的源码证明规划内核不导入 api client 与 Zustand store、不引用 accessToken/document/window/fetch，并且树只能作为只读入参进入；Worker realm 删除后由它把「客户端规划器不是安全边界、也不许自己去取状态」变成 CI 事实而不是评审约定
memoToolSchemas.ts: 与 Chat 同构的五工具输入契约；edit_nodes 只接受同一种删除/移动/重命名、去重目标及每项 revision
memoToolExecution.ts: 主线程可信协调器，把 Planner plan 映射到现有 ai_commands；read_memo 按可信 nodeId 单篇取正文，网络响应限期 45 秒且写请求不自动重放，超时明确结果未确认；写操作合并同凭据在途权限读取，分别协调 Tree/Document Store 的乐观投影、提交、对账与失败回滚
messagePresentation.ts: 有序消息分区与单调正文发布；按调用去重，读取普通/批量结果及检查点收集成功命令，批次检查点不作为思考文字
messagePresentation.test.ts: 回复分区纯函数测试，覆盖历史连续 assistant 归并、step/工具/过渡文字穿插、处理中正文不争抢、重复 toolCall 去重、成功 commands 整轮反向撤销、reasoning 归属和普通回复零过程区
toolPresentation.ts: locale参数统一工具名称、状态与安全详情，原目标标题保持；单次扫描本轮读取/命令快照，为执行中与失败动作保留目标名，无额外 API 请求； SDK 回包与业务成功分离，failed/stale/rejected/undone 不显示成功勾；工具 Message UI 的唯一展示适配器，先归一化 namespaced 工具名，再基于真实操作、标题和状态生成人话动作及安全详情
toolPresentation.test.ts: 锁定并发删除执行中/失败/历史回看仍显示笔记名； 工具展示契约测试，锁定具体动作命名、namespaced 归一、安全详情与未知协议名不外露
activityState.ts: AI Activity与胶囊AgentPresence类型边界；以整轮continuation补齐SDK ready期间的工具/审批/续写间隙，当前step未完成工具优先
activityState.test.ts: Activity 状态回归测试，覆盖当前 step、ready 工具间隙、审批/拒绝、空分块、正文开始与终态卸载
chatFetch.ts: 可独立测试的 HTTP 策略层，每次调用 token provider 后注入 Bearer，并把非 2xx 扁平/嵌套信封归一为带 code 的 ChatRequestError
chatTransport.ts: DefaultChatTransport 在 SDK submitted 阶段异步解析草稿的真实 thread ID，后续发送/工具续写复用同一 ID；增量消息、冻结 metadata、稳定 assistant ID 与统一鉴权端点保持
chatTransport.test.ts: transport/chatFetch 回归测试，覆盖增量消息裁剪、稳定 assistant id、最新 Bearer 注入、无会话短路及扁平/嵌套错误信封 code 归一
index.ts: AgentPanel 模块稳定出口，隔离 AppDashboard 与内部文件布局，只额外暴露无 UI 副作用的会话数据预热入口

职责: 承载冻结上下文、唯一 @Prompt Bar、纯净对话、可信工具过程、普通/整理同构的唯一人工裁决 Dock、刷新恢复、撤销和消息传输；当前 memo 只作为默认预选 @进入同一 sources 数组，来源只在发送前 Composer 中可见，发送后不重复进入消息视觉层。审批响应必须先持久化，UI 点击锁与 AI SDK part 状态共同阻止重复执行；已批准未完成工具刷新后可依赖 command/toolCall 幂等恢复。AI 整理只在待确认时占用 Dock，成功后消失，禁止在 Panel 或 Paper 下方重复结果卡。四个原子 memo 工具与 edit_nodes 子操作经纯 Planner 规划（与调用方同一同步 tick，快照与乐观投影之间不再有让步点），细分 command 仍由 api 安全执行。备忘录写输入可以乐观投影，但事实只能由 api command output 确认，同一 tool_call_id 只投影一次，失败/拒绝精确回滚，同一 command_id+status 只对账一次。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

2026-09-07 视觉收口：回复末尾撤销入口使用 Undo2、短标签「撤销」与共享 Label 字阶。

2026-09-07 Menu consistency: PermissionModeControl 当前模式以 CheckIcon 标记，成功切换不重复弹 Toast；共享菜单表面，不常驻 hover 填色，权限请求与确认状态协议不变。
