# app/src/widgets/
> L2 | 父级: ../../CLAUDE.md

成员清单
.gitkeep: 保留业务组合组件层空目录
CLAUDE.md: 记录业务组合组件层职责与文档协议
MarketingHeader.tsx: Landing 迷你顶部锚点导航内容，品牌锁定只显示 SuperNote 主名称且无 hover 位移，Login 按钮通过 URL 状态按需加载统一认证 Dialog并在认证成功后进入 /app；顶边贴视口、全宽背景和主轨/外轨骨架由 LandingPage 外层 BlueprintFrame 拥有
MarketingAnnouncement.tsx: 紧贴粘性导航下方、约为 Header 2/3 高且随页面滚走的无关闭公告栏，在背景全宽、1088px 主轨与正文对齐且宽屏带视口外轨的 BlueprintFrame 中居中呈现标签、正文与 2px 箭头反馈；hover 不填充蓝色背景
BlueprintFrame.tsx: Landing 通用连续 RailLayer 容器，以显式 DOM 绘制主内容竖轨与可选 fullBleed 视口外轨，由 LandingPage 组成全宽 Header/公告和 1088px 正文骨架，并统一在 Footer 前终止
BlueprintDivider.tsx: Landing 独立 14px/零高度贴边区块分隔器，以显式 DOM 绘制正文止于主节点的中性淡灰横线，以及 fullBleed 模式下穿过内收外轨节点并继续延伸至视口的开放横线；节点内部以画布色遮罩导轨以杜绝穿模
AuthDialog.tsx: 登录/注册状态切换的统一认证 Dialog，复用共享内凹 Input/PasswordInput 承载邮箱、双密码与显隐控制，并提供协议提示、六格 OTP 自动校验与 Google OAuth 入口
LandingHero.tsx: Landing 首屏，以“写下内容，结构在保存后出现”为文案母题，用 4px 一次性淡入、无磁吸 CTA、静态能力条与产品预览呈现定位
LandingSections.tsx: Landing 扩展模块，包含 CountUp 行为指标、问题/流程/场景、静态定价卡、FAQ 与“大产品图标 + 立即使用 SuperNote + 小号开始按钮”的极简预页脚 CTA；移除非交互蓝底 hover、磁吸、聚光、上浮和循环动效，section 之间只由 BlueprintDivider 拥有边界节点，预页脚末端不设 Divider/节点以让竖轨直达 Footer
LandingFooter.tsx: Landing 无 BlueprintFrame 的全宽深蓝 Fat Footer，品牌锁定只显示 SuperNote 主名称并移除 Write first 副标题，上层用无位移 hover 的独立分栏网格承载品牌/导航/元信息，下层以大块留白呈现与分栏线同色的 1.5px 描边、3% 偏白浅蓝填充、400 字重和负字距的大尺寸 SuperNote SVG 幽灵字
LandingMotion/: Landing 克制反馈模块，只提供 CountUp 与一次性 reveal；磁吸、指针聚光与装饰点阵已移除，当前页面只保留有信息价值的计数与 3–4px 入场反馈
NotebookPreview.tsx: Landing 的真实工作台预览，以工具轨、单栏文件 tree、文档纸面和 Agent 归档面板呈现核心体验
AppSidebar.tsx: /app 常驻文件导航 Panel；承载真实树搜索、新建、展开、原地 rename、HTML5 拖拽与右键“移至回收站”，底部 Design System/回收站以无容器前景色标识当前位置，软删除使用现有 destructive 菜单语义并把可等待命令交给 Dashboard
MemoTreeBranch.tsx: 无限递归树渲染器；Folder/FolderOpen 单图标承担开合，同层共享固定图标槽；双击/F2 进入 Enter/blur 提交、Escape 取消的原地 input，folder 行按上 24% before/下 24% after/中 52% inside 分区，memo 只分前后，排序落点使用 8px 圆点+2px 横线，拖拽源保留在原位并弱化到 40%，after 落点位于完整子树之后
MemoNodeDialog.tsx: 文件树命名弹窗，以设计系统 Dialog/Input/Button 承载新建文件夹，负责非空校验、提交锁与 API 错误展示，不使用浏览器 prompt 或直接访问 API
memoLibrary.ts: 后端文件树的纯视图模型工具，复用 shared/store/memoTree 算法提供首个 memo、祖先/路径、全文搜索及 before/after/inside/root-end 防环计划；folder inside 固定计算第一个子节点 sort_order
memoLibrary.test.ts: Bun 拖拽视图回归测试，覆盖无限嵌套查找、搜索/路径、根末尾、folder 首位放入、混合排序及自己/后代防环
useMemoTreeExpansion.ts: 文件树展开偏好的设备级持久化边界；仅在整树 ready 后按用户读取带版本 localStorage 快照，保留明确的全折叠状态，并随 folder 增删清理失效 id、默认展开新 folder
useMemoTreeExpansion.test.ts: 覆盖展开快照缺失与明确全折叠的区分、损坏/旧版本容错，以及删除清理和新 folder 自动展开规则
PanelResizeHandle.tsx: 左右分栏拖拽手柄，支持 Pointer 拖拽、方向键调整、双击复位与 separator ARIA
DesignSystemWorkspace/: 开发态 V1 Design System 参考工作区，以单一同构卡片矩阵陈列含 Skeleton 与不重复 Button variants/loading/disabled 状态在内的十个通用组件家族、既定 ThinkingMark 与完整 AI 消息模块；通过 lazy import 只在 import.meta.env.DEV 下暴露
MarkdownEditor.tsx: Markdown 存储协议与 CodeMirror 显示协议之间的唯一 adapter；GFM language 常驻，live/source 只通过 Compartment 重配显示扩展以共享 EditorState/选区/撤销历史，零宽空行标记和纯文本粘贴继续保证 content_mdx 无损往返
MarkdownEditor.test.ts: 以 content_mdx 恒等 round-trip 验证普通文本、2/5+ 连续空行、首尾/连续空格、强调段、空白行与 CRLF，约束零宽标记、HTML 空标签和 nbsp 永不离开 adapter
MarkdownLivePreview.ts: CodeMirror 6 原生 Live Preview 引擎，以 syntaxTree/visibleRanges 只扫描可见 block；活动标题保留弱化且无下划线的源码标记，非活动标题隐藏标记和分隔空白，活动/多选区与不安全语法回退完整源码，隐藏范围同步提供 atomicRanges，IME 合成期只映射旧装饰并在结束后刷新
MarkdownReadingView.tsx: react-markdown + remark-gfm + 可选 remark-breaks + rehype-sanitize 的共享只读正文边界；备忘录阅读态保留单换行，AI 消息维持标准 CommonMark，固定 skipHtml 并禁止原始 HTML、JSX/JavaScript 执行
MarkdownReadingView.test.tsx: 阅读换行、安全与文件边界测试，覆盖备忘录单换行/空行分段、GFM 表格/任务/删除线/引用/代码、脚本/HTML/危险链接剔除及 title 到 .md 文件名归一化
MarkdownViewMenu.tsx: 中央 Toolbar 的高频 editing/reading 切换与 More 菜单；支持外部点击、Escape、方向键/Home/End、焦点恢复，并仅复制/导出当前原始 content_mdx，title 只用于文件名
markdownViewTypes.ts: DocumentView editing/reading 与 EditingMode live/source 的共享状态协议，阅读状态不占用编辑模式槽位
NotesWorkspace.tsx: /app 中央连续写作画布，以宽度受控的单一内容列承载独立文件名标题和 Markdown 正文，不在 Panel 内重复制造纸卡；imperative handle 暴露 Agent 写前 required flush、Agent 正文替换进入同一自动保存状态机、删除前 flush/pause 与失败恢复边界，正常编辑仍由 title/MarkdownEditor 和唯一 Store 草稿驱动
useMemoAutosave.ts: 单 memo 编辑会话状态机；除既有静默/上限/重试保存外，提供可等待且失败抛错的 required flush，并可暂停旧会话以阻止软删除后卸载保存
useMemoAutosave.test.ts: 覆盖插入/删除/等长替换字符计数，以及三次有界指数退避成功与最终失败规则
TrashWorkspace.tsx: /app 回收站控制器，读取真实顶层删除根并编排重试、恢复、永久删除和当前用户原子清空，结果统一进入根级 Toast
TrashWorkspaceView.tsx: 无网络纯视图，复用 ui-page、Button/Dialog/Skeleton 与语义 token，区分 Folder/Memo 并覆盖 loading/empty/error/list/危险确认/提交锁
TrashWorkspace.test.tsx: 回收站纯视图回归测试，覆盖状态页、Folder 根不展开、永久删除/清空确认文案与防重复提交
AccountDialog.tsx: UserMenu 身份卡片与设置项共同打开的唯一设置模态框，以小尺寸 4:3 居中表面、192px 左栏和轻分隔主内容标题栏组成骨架；左栏不设重复大标题，只在“通用”分组下列账户/外观真实页面，Profile 后台刷新期间保留缓存资料与可操作页面，仅以 aria-busy/隐藏状态文字表达请求，不清空为 Skeleton
AccountProfilePanel.tsx: AccountDialog 的账户资料栏，以后端单一非空 username 初始化草稿，Profile 后台刷新按字段合并：未修改字段接受服务端新值，正在编辑字段保留本地草稿；停止输入 800ms 后串行 PATCH 用户名/简介且不锁定输入，不保留显式保存按钮，头像选择后即时上传最大 5MB 的 JPEG/PNG/WebP，成功、校验与失败状态进入全局 Toast，服务端 Profile 结果回传 Dashboard
AccountSettingsPanel.tsx: AccountDialog 的外观栏，在“主题”同一行消费 Design System SegmentedControl 提供系统/白天/黑夜偏好；system 实时跟随设备并仍只解析到同一套 light/dark token
SubscriptionWorkspace.tsx: /app 订阅入口工作区，以纯白画布、三档可选方案、权益清单与选中回执展示 5/20/100 美金订阅
AgentPanel/: /app 可收起右侧聊天模块，以 AI SDK useChat + UIMessage parts 管理消息/SSE/停止与互斥 Activity；停止命令同时收束 SSE 与活动庆祝 Canvas；用 Mastra Client 镜像工具显式回灌结果，庆祝直达独立全屏执行器，备忘录读写才由专用 Worker 处理 Store 快照后执行现有乐观 Store/API/FLIP 链路；通过 Supabase Bearer token 对接 chat /v1/chat

职责: 业务组合组件层，承载 Landing 工程骨架、后端驱动的递归文件树、可收起且可调宽的三 Panel 工作台、统一认证、同源账户模态框与各业务工作区；业务组件禁止裸写 fetch 或直连 Supabase 业务数据，唯一例外是 AgentPanel 的 AI SDK transport 在发送时读取 Auth token 并访问独立 chat 服务。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
