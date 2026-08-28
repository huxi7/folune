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
AppSidebar.tsx: /app 与 Canvas 共用的文件库内容；以紧凑 BrandMark、固定操作行（中性搜索按钮 + 96px 新建 split）承载 memo/Canvas/folder 创建，搜索只负责打开全局 Command Palette 而不再拥有本地输入框或独立结果树，并承载真实树展开/rename/HTML5 拖拽/回收站命令、整理目标定位高亮与 Palette 的文件夹定位
SidebarCreateMenu.tsx: 文件库创建入口；96px split 控件的 64px 主区（图标 + 「新建」）默认新建 memo，32px 下拉区显式选择 memo/standalone Canvas/folder，菜单支持方向键/Home/End 与外部点击关闭，不持有树事务或路由
AppMainToolbar.tsx: Paper 顶部 48px 文档命令条，呈现低对比完整路径、32px Canvas 入口、整理、阅读/编辑与更多菜单；进入默认 Canvas 前由页面层完成 required flush，命令条不直接发业务请求
MemoTreeBranch.tsx: 无限递归树渲染器；画布与笔记只靠叶子图标区分（星图 vs 纸张）且永不暴露扩展名，Folder/FolderOpen 单图标承担开合，同层共享固定图标槽；双击/F2 原地重命名，folder/memo 使用固定 DnD 落点，并接收本次整理 folder/memo id 绘制短期归档高亮
MemoTreeSkeleton.tsx: 文件库首次加载的真实行结构占位组件，只组合共享 Skeleton 并由调用方控制延迟显隐
MemoNodeDialog.tsx: 文件树命名弹窗，以设计系统 Dialog/Input/Button 承载新建文件夹，负责非空校验、提交锁与 API 错误展示，不使用浏览器 prompt 或直接访问 API
memoLibrary.ts: 后端轻量文件树的纯视图模型工具，复用 shared/store/memoTree 算法提供首个 memo、祖先/路径、标题/路径与服务端正文命中 ID 搜索，以及 before/after/inside/root-end 防环计划；folder inside 固定计算第一个子节点 sort_order
memoLibrary.test.ts: Bun 拖拽视图回归测试，覆盖无限嵌套查找、搜索/路径、根末尾、folder 首位放入、混合排序及自己/后代防环
useMemoTreeExpansion.ts: 文件树展开偏好的设备级持久化边界；仅在整树 ready 后按用户读取带版本 localStorage 快照，保留明确的全折叠状态，并随 folder 增删清理失效 id、默认展开新 folder
useMemoTreeExpansion.test.ts: 覆盖展开快照缺失与明确全折叠的区分、损坏/旧版本容错，以及删除清理和新 folder 自动展开规则
useMemoSearch.ts: Command Palette 与 @菜单共用的正文关键词命中 hook，180ms 防抖、切换中止旧请求，只把仍存在于 active tree 的命中 ID 与 idle/loading/ready/error 状态交给调用方
PanelResizeHandle.tsx: 左右分栏拖拽手柄，支持 Pointer 拖拽、方向键调整、双击复位与 separator ARIA
ArchiveCord.tsx: react-archer 5.1 几何适配层；提供稳定隔离源 ID、Paper/树 DOM 锚点、一次绘制后静止曲线，以及 resize/scroll/目录 Mutation 的刷新闭环
archiveCordPolicy.ts: Archive Cord 目标解析与宽屏可见性纯策略，优先目录、根级回退 memo，并在覆盖模式禁止假连线
archiveCordPolicy.test.ts: 覆盖成功/撤销目标、根级回退、文件库关闭与小屏覆盖门禁
cordGeometry.ts: Cord 连线几何内核；提供边缘锚点、距离自适应弯度、三次贝塞尔与 De Casteljau 中点切分，两段子曲线同以中点为起点以支撑「光自中间淌向两端」
cordGeometry.test.ts: 以独立三次贝塞尔求值反证中点切分，并覆盖四向边缘锚点、重合端点不产 NaN 与两位小数收敛
Cord.tsx: 共享连线 Signature 渲染层；粗细沿路径恒定是 SVG 硬限制，两头收细由 Cord 生成的沿线透明度渐变承担，虚线表 AI 临时推荐、实线表已确认关联，出场自绘与流光下沉 CSS 以避免每帧 React 更新
EdgeDock.tsx: 文件库/AI 共用的 Stage 关闭态 Ghost 图标入口，桌面 32px、窄屏 44px，静止无背景/描边/文字且不使用共享 layoutId；Panel 关闭入口由各自 Header 内部拥有
PaperSurface.tsx: 816px Paper Signature 边界，拥有非对称 Paper 阴影、Archive Port 与只替换内容不重挂载编辑会话的内部过渡
CanvasWorkspace.tsx: Canvas V2 全视口会话壳；与 Paper 互斥但复用左右文件库/AI Panel 和 ArchiveCord 上下文，Panel/Preview 开合不卸载中央 React Flow；进入状态只在挂载那一刻由返回描述或 canvasChromeStore 解释一次，之后每次开关都记进该画布的最近布局，顶层只保留左上开关+标题与右上 AI 开关两块无卡片分区
CanvasWorkspace.test.tsx: Canvas 会话壳回归测试，锁定中央 Canvas、共享 Panel、Paper 互斥关系，以及伪返回按钮/Canvas 文字标识/厚重标题卡片确已消失
KnowledgeCanvas/: Canvas V2 交互内容根，以受控 React Flow 承载持久视口、memo/native 节点、连接/删除/拖拽/缩放、Picker、Preview、显式 AI expansion、WAL 恢复与保存状态
DesignSystemWorkspace/: 开发态 Quiet Editorial Design System 工作区，按 Foundations/Primitives/Navigation & Overlays/Editorial/AI & Organize 五层直接陈列生产 Token、Lucide Iconography、完整 Markdown/Reading/Quote/Code 与四种 Signature Components；通过 lazy import 只在 import.meta.env.DEV 下暴露
NotePaper.tsx: 共享纸面原语，以 thumbnail/reader 两个 variant 承载 Canvas 卡片缩略纸与小开本浮纸；纸张曲率、纸边、墨色与渐隐只在此实现一次，reader 只承载正文、纸面静止而正文在纸内滚动，可声明 Dialog autofocus 契约
NotePaper.test.tsx: 纸面骨架回归测试，锁定两个 variant 的 DOM 同构、空摘录占位、children 覆盖摘录与 overlay 不进入正文流
MarkdownEditor.tsx: Markdown 存储协议与 CodeMirror 显示协议之间的唯一 adapter；handle 只暴露 focus 与只读 readSelection（剥掉零宽标记后返回选中文字，不触碰选区/撤销/自动保存），GFM language 常驻，live/source 只通过 Compartment 重配显示扩展以共享 EditorState/选区/撤销历史，零宽空行标记和纯文本粘贴继续保证 content_mdx 无损往返
MarkdownEditor.test.ts: 以 content_mdx 恒等 round-trip 验证普通文本、2/5+ 连续空行、首尾/连续空格、强调段、空白行与 CRLF，约束零宽标记、HTML 空标签和 nbsp 永不离开 adapter
MarkdownLivePreview.ts: CodeMirror 6 原生 Live Preview 引擎，以 syntaxTree/visibleRanges 只扫描可见 block；活动标题保留弱化且无下划线的源码标记，非活动标题隐藏标记和分隔空白，活动/多选区与不安全语法回退完整源码，隐藏范围同步提供 atomicRanges，IME 合成期只映射旧装饰并在结束后刷新
MarkdownReadingView.tsx: react-markdown + remark-gfm + 可选 remark-breaks + rehype-sanitize 的共享只读正文边界；备忘录阅读态保留单换行，AI 消息维持标准 CommonMark，并以模块级稳定渲染器 + Context 只装饰最后可见块；历史块和最后块的稳定前缀保留原生文本节点，末尾最多五个动画 span，固定 skipHtml 并禁止原始 HTML、JSX/JavaScript 执行
MarkdownReadingView.test.tsx: 阅读换行、安全、常数尾部动画节点与文件边界测试，覆盖备忘录单换行/空行分段、GFM 表格/任务/删除线/引用/代码、脚本/HTML/危险链接剔除、Markdown 五词错峰拖尾、历史正文不装饰、结束回归原生文本，以及 title 到 .md 文件名归一化
MarkdownViewMenu.tsx: 中央 Toolbar 的高频 editing/reading 切换与 More 菜单；支持外部点击、Escape、方向键/Home/End、焦点恢复，并仅复制/导出当前原始 content_mdx，title 只用于文件名
markdownViewTypes.ts: DocumentView editing/reading 与 EditingMode live/source 的共享状态协议，阅读状态不占用编辑模式槽位
NotesWorkspace.tsx: /app Paper 内部写作列，以跨临时/真实后端 ID 不变的 memoClientKey 保持编辑器会话；按需正文未到达前不把空标题反写轻量树，新建时聚焦并选中默认标题，imperative handle 暴露 Agent/Canvas/整理 required flush、正文替换、删除 pause 与已提交 AI 标题接纳
PaperWorkspaceShell.tsx: Paper First 四层空间壳；以 AnimatePresence 编排 Ghost Panel Toggle、按需文件库、唯一 Paper 与 AI 思考空间，Panel 只使用无弹跳 x/opacity Tween；成功/撤销时只持久连接 Paper 与真实树目标，Canvas 空间由并列的 CanvasWorkspace 承担
useMemoAutosave.ts: 单 memo 编辑会话状态机；支持 required flush、删除期 pause/resume、AI 标题接纳，并只在没有本地草稿时采纳同一 memo 的迟到服务端初值，避免刷新空白或覆盖输入
useMemoAutosave.test.ts: 覆盖迟到服务端正文接纳门禁、插入/删除/等长替换字符计数及三次有界指数退避
WorkspaceAuxViews.tsx: 纸内辅助视图挂载点；订阅、回收站、Design System 住在 Paper 内部且彼此互斥。已保存画布属于独立空间语境，明确由 CanvasWorkspace 承载，不得重新并入此分支
WorkspaceCommandPalette.tsx: 全局唯一 Command Surface；680px 顶部对齐面板、⌘K 双向开合、稳定 id 作为 active 身份、六档排序结果、默认画布降级为笔记行的次级动作，Canvas 语境下只对笔记提供 ⌘Enter 连续加入
WorkspaceCommandPalette.test.tsx: 键盘状态机门禁，覆盖双向开合、焦点稳定、首项选中、方向键/Enter/Esc、IME 合成期不跳转、⌘Enter 加入后保持打开、正文结果补入时 active 不跳走与 loading/empty/error 状态
commandResults.ts: 全局搜索唯一排序与去重纯函数；六档命中顺序、同档内确定性 tie-break，默认画布永不作为独立结果出现
commandResults.test.ts: 排序契约门禁，锁定六档顺序、默认画布去重、独立画布独立成行、文件夹可导航与空查询最近项
TrashWorkspace.tsx: /app 回收站控制器，读取真实顶层删除根并编排重试、恢复、永久删除和当前用户原子清空，结果统一进入根级 Toast
TrashWorkspaceView.tsx: 无网络纯视图，复用 ui-page、Button/Dialog/Skeleton 与语义 token，区分 Folder/Memo 并覆盖 loading/empty/error/list/危险确认/提交锁
TrashWorkspace.test.tsx: 回收站纯视图回归测试，覆盖状态页、Folder 根不展开、永久删除/清空确认文案与防重复提交
AccountDialog.tsx: UserMenu 身份卡片与设置项共同打开的唯一设置模态框，以小尺寸 4:3 居中表面、192px 左栏和轻分隔主内容标题栏组成骨架；左栏不设重复大标题，只在“通用”分组下列账户/外观真实页面，Profile 后台刷新期间保留缓存资料与可操作页面，仅以 aria-busy/隐藏状态文字表达请求，不清空为 Skeleton
AccountProfilePanel.tsx: AccountDialog 的账户资料栏，以后端单一非空 username 初始化草稿，Profile 后台刷新按字段合并：未修改字段接受服务端新值，正在编辑字段保留本地草稿；停止输入 800ms 后串行 PATCH 用户名/简介且不锁定输入，不保留显式保存按钮，头像选择后即时上传最大 5MB 的 JPEG/PNG/WebP，成功、校验与失败状态进入全局 Toast，服务端 Profile 结果回传 Dashboard
AccountSettingsPanel.tsx: AccountDialog 的外观栏，在“主题”同一行消费 Design System SegmentedControl 提供系统/白天/黑夜偏好；system 实时跟随设备并仍只解析到同一套 light/dark token
SubscriptionWorkspace.tsx: /app 订阅入口工作区，以纯白画布、三档可选方案、权益清单与选中回执展示 5/20/100 美金订阅
AgentPanel/: Paper 与 Canvas 共用的右侧思考空间；AI SDK useChat 承载对话/工具/审批/撤销，organize client 服务 Paper，Canvas expansion client 只取可信候选并把最终 intent 交还统一 Canvas 保存协调器

职责: 业务组合组件层，承载 Landing、Paper/Canvas 两个一级 Workspace、共享文件库与 AI 思考空间、认证、账户和业务视图；Canvas 组件只产生 intent，可靠写入归 Store/Coordinator，正文归 memoDocumentStore；业务组件禁止裸写 fetch 或直连 Supabase 业务数据，AgentPanel transport/client 只在请求期读取 Auth token 访问 chat。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
