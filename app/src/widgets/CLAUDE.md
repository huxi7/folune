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
AppSidebar.tsx: /app 与 Canvas 共用的文件库内容；定位展开只以结构/目标语义键触发，memo 指针/焦点会预热正文；树内重排与跨视图拖入 Canvas 共享一次原生拖拽会话，辅助导航只上报意图给 Dashboard，实际 React 实例由 WorkspaceLibraryLayer 跨路由持有
WorkspaceLibraryLayer.tsx: Dashboard 级持久文件库浮层；把 AppSidebar 与 PanelResizeHandle 放在 Paper/Canvas 路由壳之外，开合只驱动透明度/位移和 inert，不因内容壳切换重挂载
SidebarCreateMenu.tsx: 文件库创建入口；96px split 控件默认新建 memo，下拉显式选择 memo/standalone Canvas/folder；menu 容器可聚焦并支持方向键/Home/End 与外部关闭，不持有树事务或路由
AppMainToolbar.tsx: Paper 顶部 48px 文档命令条，呈现低对比完整路径、32px Canvas 入口、整理、阅读/编辑与更多菜单；进入默认 Canvas 前由页面层完成 required flush，命令条不直接发业务请求
MemoTreeBranch.tsx: 无限递归树渲染器；叶子指针/键盘焦点上报 memo 预取意图，folder/memo 使用固定 DnD 落点，画布与笔记靠图标区分；双击/F2/右键共用原地重命名，撞名时挂起提交
MemoTreeSkeleton.tsx: 文件库首次加载的真实行结构占位组件，只组合共享 Skeleton 并由调用方控制延迟显隐
MemoNodeDialog.tsx: 文件树命名弹窗，以设计系统 Dialog/Input/Button 承载新建文件夹，负责非空校验、同级重名即时提示与提交拦截、提交锁与 API 错误展示（服务端 MEMO_TITLE_CONFLICT 也说人话），不使用浏览器 prompt 或直接访问 API
memoLibrary.ts: 后端轻量文件树的纯视图模型工具，提供路径/搜索、树内稀疏移动计划，以及仅 memo 可生成和解析的 `application/x-supernote-memo` Canvas 拖拽协议
memoLibrary.test.ts: Bun 视图模型测试，覆盖嵌套查找、搜索/路径、稀疏移动、防环与跨视图拖拽载荷校验
useMemoTreeExpansion.ts: 文件树展开偏好的设备级持久化边界；水合只由用户存储身份/ready 驱动，folderIds 用序列化语义键独立对账，避免数组身份或树刷新重置用户展开状态
useMemoTreeExpansion.test.ts: 覆盖展开快照缺失与明确全折叠的区分、损坏/旧版本容错，以及删除清理和新 folder 自动展开规则
useMemoSearch.ts: Command Palette 与 @菜单共用的正文关键词命中 hook，180ms 防抖、切换中止旧请求，只把仍存在于 active tree 的命中 ID 与 idle/loading/ready/error 状态交给调用方
PanelResizeHandle.tsx: 左右浮动 Panel 拖拽手柄，支持 Pointer 拖拽、方向键调整、双击复位与 separator ARIA；拖拽期间声明全局 resizing 状态，禁止布局/面板动画干扰 1:1 跟手；文件库手柄随持久宿主保留
ArchiveCord.tsx: react-archer 5.1 几何适配层；提供稳定隔离源 ID、Paper/持久文件树 DOM 锚点、一次绘制后静止曲线，以及 resize/scroll/目录 Mutation 的刷新闭环；跨路由唯一容器由 AppDashboard 持有
archiveCordPolicy.ts: Archive Cord 目标解析与宽屏可见性纯策略，优先目录、根级回退 memo，并在覆盖模式禁止假连线
archiveCordPolicy.test.ts: 覆盖成功/撤销目标、根级回退、文件库关闭与小屏覆盖门禁
cordGeometry.ts: Cord 连线几何内核；提供边缘锚点（CordBox 声明 radius 即按圆角矩形求交：射线落在四角那一段时改与该角的圆相交，与平直边在切点处同解，因此绕卡片一圈连续滑动）、距离自适应弯度、三次贝塞尔与 De Casteljau 中点切分，两段子曲线同以中点为起点以支撑「光自中间淌向两端」。radial 模式的弯度是 bow·sin(2θ) 的反对称法向偏移（展开即 2·dx·dy/L²，无三角函数、无扇区分支）：水平/垂直对齐时归零成直线，四条 45° 对角线最弯且是两个弯的 S，绕行 360° 只有连续变形
cordGeometry.test.ts: 以独立三次贝塞尔求值反证中点切分，并覆盖四向边缘锚点、圆角锚点确实落在弧上且绕行 360° 每度位移有界（夹到边中段那种做法会在角上跳 ~68px）、重合端点不产 NaN 与两位小数收敛；另以「相对自身弦的有符号法向偏移」为形状描述子绕行 360°，逐度证明弯度无跳变（1° 内形变 < 2px）且恰好在四条轴上取直
Cord.tsx: 共享连线 Signature 渲染层；粗细沿路径恒定是 SVG 硬限制，两头收细由沿线透明度渐变承担，虚线/实线表达关系状态，并向 Canvas 暴露可延后 draw 语义；路径动画仍统一下沉 CSS，reduced-motion 直接静态
EdgeDock.tsx: 文件库/AI 共用的 Stage 关闭态 Ghost 图标入口，桌面 32px、窄屏 44px，静止无背景/描边/文字且不使用共享 layoutId；Panel 关闭入口由各自 Header 内部拥有
PaperSurface.tsx: 816px Paper Signature 边界，拥有非对称 Paper 阴影、Archive Port、共享 memo identity 注册与无退出等待的即时内容切换；纸壳与纸内正文各自命名，因此 Paper↔Canvas 只飞纸的边界，编辑正文按原始尺寸淡换而不被拉伸
CanvasStageLoading.tsx: Paper/Canvas 共用的单纸面 Stage 占位；消费统一延迟 Skeleton，快速请求不出现，慢请求保持真实结构比例且只做交叉淡入
CanvasStageLoading.test.tsx: 锁定 visible=false 时完全卸载全屏容器，visible=true 时只渲染一张纸面 Skeleton，防止透明占位遮住 ready Canvas
CanvasWorkspace.tsx: Canvas 全视口会话壳；可空闲预载 KnowledgeCanvas、消费可选一次性 detail，并向路由暴露 flush；Panel/Preview 开合不改变几何或卸载中央 React Flow，bootstrap 只决定进入语境（有 detail 即视图过渡带进来，无则自己淡入）
CanvasWorkspace.test.tsx: Canvas 会话壳回归测试，锁定中央 Canvas、共享 Panel、Paper 互斥关系，以及伪返回按钮/Canvas 文字标识/厚重标题卡片确已消失
KnowledgeCanvas/: Canvas V2 交互内容根，以受控 React Flow 承载持久视口、memo/native 节点、连接、带撤销回执/来源确认的移除、拖拽/缩放、Picker、Preview、显式 AI expansion、WAL 恢复与保存状态
DesignSystemWorkspace/: 开发态 Quiet Editorial Design System 工作区，按 Foundations/Primitives/Navigation & Overlays/Editorial/AI & Organize 五层直接陈列生产 Token、Lucide Iconography、完整 Markdown/Reading/Quote/Code 与四种 Signature Components；通过 lazy import 只在 import.meta.env.DEV 下暴露
NotePaper.tsx: 共享纸面原语，以 thumbnail/reader 两个 variant 承载 Canvas 卡片缩略纸与小开本浮纸。transitionIdentity 一个入参同时命名纸壳与纸内正文（paper-/paper-body-），规矩因此住在纸里而不是每个调用方——漏一处就是一次字被当图片拉伸的过渡；不再交出真实 DOM，几何归浏览器，没人再测量这张纸。纸张曲率、纸边、墨色与 thumbnail 渐隐仍只实现一次，reader 纸面静止且正文在纸内滚动
NotePaper.test.tsx: 纸面骨架与视觉契约回归测试，锁定两个 variant 的 DOM 同构、thumbnail 五段透明度且模糊层不填纸色、空摘录占位、children 覆盖摘录与 overlay 不进入正文流，以及一个 transitionIdentity 必须同时命名纸壳与正文、不给身份则一个名字都不留
MarkdownEditor.tsx: Markdown 存储协议与 CodeMirror 显示协议之间的唯一 adapter；handle 只暴露 focus 与只读 readSelection（剥掉零宽标记后返回选中文字，不触碰选区/撤销/自动保存），GFM language 常驻，live/source 只通过 Compartment 重配显示扩展以共享 EditorState/选区/撤销历史，零宽空行标记和纯文本粘贴继续保证 content_mdx 无损往返
MarkdownEditor.test.ts: 以 content_mdx 恒等 round-trip 验证普通文本、2/5+ 连续空行、首尾/连续空格、强调段、空白行与 CRLF，约束零宽标记、HTML 空标签和 nbsp 永不离开 adapter
MarkdownLivePreview.ts: CodeMirror 6 原生 Live Preview 引擎，以 syntaxTree/visibleRanges 只扫描可见 block；活动标题保留弱化且无下划线的源码标记，非活动标题隐藏标记和分隔空白，活动/多选区与不安全语法回退完整源码，隐藏范围同步提供 atomicRanges，IME 合成期只映射旧装饰并在结束后刷新
MarkdownReadingView.tsx: react-markdown + remark-gfm + 可选 remark-breaks + rehype-sanitize 的共享只读正文边界；备忘录阅读态保留单换行，AI 消息维持标准 CommonMark，并以模块级稳定渲染器 + Context 只装饰最后可见块；历史块和最后块的稳定前缀保留原生文本节点，末尾最多五个动画 span，固定 skipHtml 并禁止原始 HTML、JSX/JavaScript 执行
MarkdownReadingView.test.tsx: 阅读换行、安全、常数尾部动画节点与文件边界测试；正则按真实 HTML 属性匹配，不保留无意义的 quote 转义
MarkdownViewMenu.tsx: 中央 Toolbar 的 editing/reading 切换与 More 菜单；menu 容器可聚焦，分隔符具备名称，支持键盘/焦点恢复，并在导出文件名时显式过滤 ASCII 控制字符
markdownViewTypes.ts: DocumentView editing/reading 与 EditingMode live/source 的共享状态协议，阅读状态不占用编辑模式槽位
NotesWorkspace.tsx: /app Paper 内部写作列，以 memoClientKey 作为唯一编辑会话/自动聚焦身份；逐键正文只更新本地草稿，保存/flush 才跨越 Dashboard 共享状态边界
PaperWorkspaceShell.tsx: Paper First 四层空间壳；向 PaperSurface 下传稳定 memo identity，响应式覆盖判据以 assistant/library 状态稳定闭包驱动 resize effect，文件库/AI 独立浮层开合不改变 Paper/Stage 几何
useMemoAutosave.ts: 单 memo 本地草稿状态机；递归 required flush 使用具名 callback，session 只以 memoId 建立/销毁，逐键输入不写全局 Store，晚到初值由独立门禁接纳
useMemoAutosave.test.ts: 覆盖迟到服务端正文接纳门禁、插入/删除/等长替换字符计数、三次有界指数退避，以及驱动真实 Hook 证明标题冲突只挂起 title 而正文照常落库
WorkspaceAuxViews.tsx: 纸内辅助视图挂载点；订阅、回收站、Design System 住在 Paper 内部且彼此互斥。已保存画布属于独立空间语境，明确由 CanvasWorkspace 承载，不得重新并入此分支
WorkspaceCommandPalette.tsx: 全局唯一 Command Surface；listbox 结果行是可聚焦 option，以稳定 id 承担 active 身份，并支持六档排序、Tab 进入画布与 Canvas 语境连续加入
WorkspaceCommandPalette.test.tsx: 键盘状态机门禁，使用最小 Bun test 依赖覆盖开合、焦点、方向键/Enter/Tab/Esc、IME、Canvas 连续加入、正文补入稳定与提示条状态
commandResults.ts: 全局搜索唯一排序纯函数；六档命中顺序与同档内确定性 tie-break，两种画布都独立成行且画布行携带来源笔记标题，同档同名时按「本体先于派生物」让笔记恒排在它的画布之前
commandResults.test.ts: 排序契约门禁，锁定六档顺序、两种画布都独立成行、同名时笔记先于画布、画布行的血缘、文件夹可导航与空查询最近项
TrashWorkspace.tsx: /app 回收站控制器，读取真实顶层删除根并编排重试、恢复、永久删除和当前用户原子清空，结果统一进入根级 Toast
TrashWorkspaceView.tsx: 无网络纯视图，复用 ui-page、Button/Dialog/Skeleton 与语义 token，区分 Folder/Memo 并覆盖 loading/empty/error/list/危险确认/提交锁
TrashWorkspace.test.tsx: 回收站纯视图回归测试，覆盖状态页、Folder 根不展开、永久删除/清空确认文案与防重复提交
AccountDialog.tsx: UserMenu 身份卡片与设置项共同打开的唯一设置模态框，以小尺寸 4:3 居中表面、192px 左栏和轻分隔主内容标题栏组成骨架；左栏不设重复大标题，只在“通用”分组下列账户/外观真实页面，Profile 后台刷新期间保留缓存资料与可操作页面，仅以 aria-busy/隐藏状态文字表达请求，不清空为 Skeleton
AccountProfilePanel.tsx: AccountDialog 的账户资料栏；后台 Profile 刷新只以 bio/username 字段合并草稿，头像/email 等无关身份变化不重跑文字合并；停止输入 800ms 后串行 PATCH，头像即时上传并经 Toast 回执
AccountSettingsPanel.tsx: AccountDialog 的外观栏，在“主题”同一行消费 Design System SegmentedControl 提供系统/白天/黑夜偏好；system 实时跟随设备并仍只解析到同一套 light/dark token
SubscriptionWorkspace.tsx: /app 订阅入口工作区，以纯白画布、三档可选方案、权益清单与选中回执展示 5/20/100 美金订阅
AgentPanel/: Paper 与 Canvas 共用的右侧思考空间；AI SDK useChat 承载对话/工具/审批/撤销，organize client 服务 Paper，Canvas expansion client 只取可信候选并把最终 intent 交还统一 Canvas 保存协调器

职责: 业务组合组件层，承载 Landing、Paper/Canvas 两个一级 Workspace、共享文件库与 AI 思考空间、认证、账户和业务视图；Canvas 组件只产生 intent，可靠写入归 Store/Coordinator，正文归 memoDocumentStore；业务组件禁止裸写 fetch 或直连 Supabase 业务数据，AgentPanel transport/client 只在请求期读取 Auth token 访问 chat。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
