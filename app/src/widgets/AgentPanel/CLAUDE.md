# app/src/widgets/AgentPanel/
> L2 | 父级: ../CLAUDE.md

成员清单
AgentPanel.tsx: AI Native V2 组合根；48px Header 以本地 Design System Ghost Button 承载 16px 历史菜单、新对话与收起动作；Prompt Bar 冻结统一 sources，右下角发送/停止共享 32px 几何圆形 Primary 轮廓且不继承 Button squircle；普通 tool approval 与 AI 整理 awaiting_confirmation 在 Composer 上方竞争同一个 ApprovalDock 槽位，普通审批优先，整理成功不在 Panel 重复显示；批准/拒绝先同步完整消息再执行或回滚，同一 approval 防连点，刷新后的已批准未完成工具按 toolCallId 幂等恢复，tool result 续写复用同一 assistant，同轮 commands 逆序撤销并继续走版本门禁
ApprovalDock.tsx: Composer 上方唯一的紧凑非模态审批视觉原语，统一图标、标题、影响说明、按钮槽位与无蒙层语义；普通工具和 AI 整理审批只能适配它，禁止复制表面
approvalState.ts: 审批状态机纯领域层，只检查末条 assistant；统一负责 requested 单次响应投影、approved 未完成工具恢复候选与 output 结果投影，避免 UI、持久化和恢复各自解释 AI SDK 状态
approvalState.test.ts: 审批状态机回归测试，锁定同一 approval 只响应一次、拒绝不恢复、批准刷新可恢复及结果落地后退出恢复队列
composerSources.ts: Prompt Bar 唯一上下文领域层；当前 memo 与置顶来源保持结构化上下文，手动 @笔记与正文 token 同步删除，全部来源去重、限五篇并生成同一冻结 metadata
composerSources.test.ts: 覆盖当前 memo 默认来源、删除抑制、切换更新、手动/置顶去重、内联 mention 删除同步、发送冻结及发送后草稿来源收束
MentionMenu.tsx: Prompt Bar 原生 @笔记命令菜单视图与搜索纯函数；标题/路径本地匹配并合并服务端正文命中 ID，结果以内容宽度的 28px 文件图标+文件名轻量行呈现，已选项排除
MentionMenu.test.ts: 覆盖空 @候选、搜索排除、revision 元数据及结果只渲染文件图标+文件名的轻量结构
PermissionModeControl.tsx: Composer 左下角账号全局每次询问/智能审批实验/完全访问 32px 本地 Ghost Button；与右侧发送/停止同尺寸，菜单向上展开，以一句短描述区分模式，hover 与当前模式共享中性表面，只显示 API 已确认模式，加载/保存失败保持旧值并经全局 Toast 明示
ApprovalCard.tsx: 每次询问与智能审批回退的工具审批语义适配；把人话动作、最小影响说明和危险操作按钮映射到共享 ApprovalDock
OrganizeReviewCard.tsx: AI 整理审批语义适配；只把当前 memo 的 awaiting_confirmation 标题/位置影响与确认/取消映射到共享 ApprovalDock，其他 Run 状态不在 AgentPanel 或 Paper 下方重复展示
OrganizeReviewCard.test.tsx: AI 整理审批 DOM 同构测试，锁定 awaiting_confirmation 复用 agent-approval-dock 且 succeeded 输出为空
ThreadHistory.tsx: Panel 内统一历史会话视图，会话行只提供切换、重命名与普通永久删除确认，hover、focus 与当前选中项共享中性表面而不使用品牌蓝底，不建立归档分组或第四栏
organizeClient.ts: 浏览器到 Chat `/v1/organize` 的最小 authenticated client，复用 AI Run mapper，确认/apply/undo 仍经 shared/api/ai 进入 Business API
threadSelection.ts: 按用户 localStorage key 选择合法历史 thread，失效偏好回退服务端最近会话
threadSelection.test.ts: 覆盖用户偏好隔离、合法恢复和失效 ID 回退
useAiThreads.ts: 会话控制器，服务端持有 Thread/Message/Reference 真相；负责首次空会话、统一列表/detail/messages 加载、选择偏好与标题/删除 CRUD，并在删除当前会话后选择最近项或创建空白项
AgentProcessDisclosure.tsx: 单条 assistant 回复的处理过程显隐边界，入口固定在所有过程文字与工具之前；生成期以 ThinkingMark + 真实状态强制展开，完成后保留“思考过程”顶部入口供手动收起/展开，容器永不包裹最终正文
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
memoToolPlanner.ts: 四个胖工具的纯规划内核，基于轻量 Tree Store 快照验证 revision/树约束并生成单步内部命令计划；read_memo 只规划可信 nodeId，不接触正文
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
chatTransport.ts: 按 thread 创建类型化 DefaultChatTransport，只发送 thread_id 与携带冻结 metadata 的完整 messages；工具续写不再重读当前页面 memo
chatTransport.test.ts: chatFetch 回归测试，覆盖最新 Bearer 注入、无会话短路及扁平/嵌套错误信封 code 归一
index.ts: AgentPanel 模块稳定出口，隔离 AppDashboard 与内部文件布局

职责: 承载冻结上下文、唯一 @Prompt Bar、纯净对话、可信工具过程、普通/整理同构的唯一人工裁决 Dock、刷新恢复、撤销和消息传输；当前 memo 只作为默认预选 @进入同一 sources 数组，来源只在发送前 Composer 中可见，发送后不重复进入消息视觉层。审批响应必须先持久化，UI 点击锁与 AI SDK part 状态共同阻止重复执行；已批准未完成工具刷新后可依赖 command/toolCall 幂等恢复。AI 整理只在待确认时占用 Dock，成功后消失，禁止在 Panel 或 Paper 下方重复结果卡。四个 memo 客户端工具经 Worker 纯规划，细分 command 仍由 api 安全执行。备忘录写输入可以乐观投影，但事实只能由 api command output 确认，同一 tool_call_id 只投影一次，失败/拒绝精确回滚，同一 command_id+status 只对账一次。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
