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
AppSidebar.tsx: /app 按需浮现的文件库内容；以紧凑 BrandMark + Header 最右 Ghost 收起、同排中性弹性搜索 + 32px NotePencil Primary 新建立起唯一品牌动作，搜索激活后以全宽输入独占原行并暂时隐藏新建；标题/路径本地匹配，正文经轻量服务端命中 ID 合并，并承载真实树展开/rename/HTML5 拖拽/回收站命令及整理目标定位高亮
AppMainToolbar.tsx: Paper 顶部 48px 文档命令条，只呈现低对比完整路径、32px Sparkle Secondary 图标探索、32px MagicWand Secondary 图标整理与阅读/编辑/更多菜单；探索与整理并列是因为二者同为「对当前这一篇施加 AI 动作」，区别只在读/写，故共享规格而不另立入口；全局文件库/AI 开关归 Stage Controls
MemoTreeBranch.tsx: 无限递归树渲染器；画布与笔记只靠叶子图标区分（星图 vs 纸张）且永不暴露扩展名，Folder/FolderOpen 单图标承担开合，同层共享固定图标槽；双击/F2 原地重命名，folder/memo 使用固定 DnD 落点，并接收本次整理 folder/memo id 绘制短期归档高亮
MemoTreeSkeleton.tsx: 文件库首次加载的真实行结构占位组件，只组合共享 Skeleton 并由调用方控制延迟显隐
MemoNodeDialog.tsx: 文件树命名弹窗，以设计系统 Dialog/Input/Button 承载新建文件夹，负责非空校验、提交锁与 API 错误展示，不使用浏览器 prompt 或直接访问 API
memoLibrary.ts: 后端轻量文件树的纯视图模型工具，复用 shared/store/memoTree 算法提供首个 memo、祖先/路径、标题/路径与服务端正文命中 ID 搜索，以及 before/after/inside/root-end 防环计划；folder inside 固定计算第一个子节点 sort_order
memoLibrary.test.ts: Bun 拖拽视图回归测试，覆盖无限嵌套查找、搜索/路径、根末尾、folder 首位放入、混合排序及自己/后代防环
useMemoTreeExpansion.ts: 文件树展开偏好的设备级持久化边界；仅在整树 ready 后按用户读取带版本 localStorage 快照，保留明确的全折叠状态，并随 folder 增删清理失效 id、默认展开新 folder
useMemoTreeExpansion.test.ts: 覆盖展开快照缺失与明确全折叠的区分、损坏/旧版本容错，以及删除清理和新 folder 自动展开规则
useMemoSearch.ts: 文件库与 @菜单共用的正文关键词命中 hook，180ms 防抖、切换中止旧请求，只把仍存在于 active tree 的命中 ID 交给本地结果排序
PanelResizeHandle.tsx: 左右分栏拖拽手柄，支持 Pointer 拖拽、方向键调整、双击复位与 separator ARIA
ArchiveCord.tsx: react-archer 5.1 几何适配层；提供稳定隔离源 ID、Paper/树 DOM 锚点、一次绘制后静止曲线，以及 resize/scroll/目录 Mutation 的刷新闭环
archiveCordPolicy.ts: Archive Cord 目标解析与宽屏可见性纯策略，优先目录、根级回退 memo，并在覆盖模式禁止假连线
archiveCordPolicy.test.ts: 覆盖成功/撤销目标、根级回退、文件库关闭与小屏覆盖门禁
cordGeometry.ts: Cord 连线几何内核；提供边缘锚点、距离自适应弯度、三次贝塞尔与 De Casteljau 中点切分，两段子曲线同以中点为起点以支撑「光自中间淌向两端」
cordGeometry.test.ts: 以独立三次贝塞尔求值反证中点切分，并覆盖四向边缘锚点、重合端点不产 NaN 与两位小数收敛
Cord.tsx: 共享连线 Signature 渲染层；粗细沿路径恒定是 SVG 硬限制，两头收细由 Cord 生成的沿线透明度渐变承担，虚线表 AI 临时推荐、实线表已确认关联，出场自绘与流光下沉 CSS 以避免每帧 React 更新
useExploreStage.ts: 探索态量尺；纯决策 explorePresentation 与真实 DOM 之间唯一的换算口。测量对象是正被 transform 缩放的活纸，故必须由已施加的变换反解未变换布局盒，否则第二次测量会把上一次的缩放再缩一次
PaperRetreat.tsx: 活纸退后包裹，探索态里唯一被 transform 缩放的元素，同时是量纸几何的那把尺；变换变量名只在此出现一次，生产壳层与 DEV 实验台共用它，二者几何因此不可能分叉
ExploreStage.tsx: 探索浮层视图与 WorkspaceExploration 视图契约；plan 给出承载 AI 亲疏语义的初始几何，组件只保存本轮用户拖动的瞬时偏移，卡片与 Cord 同步移动，退出即弃、按保存时才把实际排布交给画布。保存后连线由虚转实——那是「零数据库写入」与「已写入关系表」的唯一视觉分界。槽位按下标而非 node_id 作 key，骨架与实卡是同一个 DOM 节点；理由仍是卡片之外、线那一头的无表面注文，与卡内的笔记原文分属两个语义层
radialLayout.ts: 探索态候选排布内核；提供确定性的分侧、角度与避开竖直方向，半径自中心矩形边缘起算。纸高瘦时边缘距中心忽远忽近，故产品语义上的「越相关越近」由 pages/explorePresentation 按直线距离重写，本模块不是那条规则的所有者
radialLayout.test.ts: 覆盖越相关越近、候选让开中心矩形、输入顺序无关、绕开竖直楔形与同侧拥挤外推
ExploreResultPanel.tsx: 探索结果静态清单纯视图；只在 reduced-motion 或窗口窄到距离读不出来时替代星野出场——那是它唯一的用途。不持有状态、不发请求，只按 loading/空/有结果三态呈现标题、判定理由、逐字校验过的原文摘录与置信度
EdgeDock.tsx: 文件库/AI 共用的 Stage 关闭态 Ghost 图标入口，桌面 32px、窄屏 44px，静止无背景/描边/文字且不使用共享 layoutId；Panel 关闭入口由各自 Header 内部拥有
PaperSurface.tsx: 816px Paper Signature 边界，拥有非对称 Paper 阴影、Archive Port 与只替换内容不重挂载编辑会话的内部过渡
CanvasWorkspace.tsx: 已保存画布的全屏空间壳，与 PaperWorkspaceShell 互斥；负责确定 100vw×100vh 视口、浮动返回/标题入口并 lazy 挂载 KnowledgeCanvas，左右 Panel、Paper、工具栏与归档口一律不进入画布 DOM
CanvasWorkspace.test.tsx: 全屏画布空间壳回归测试，锁定返回/标题入口并禁止 Paper、文件库、AI Panel 混入
KnowledgeCanvas/: 已保存画布的只读空间内容，以 React Flow v12 承载持久视口、pan/zoom、极淡点阵、共享 Cord 连线、限高不展开的只读卡片与「成为笔记」晋升；只住在 CanvasWorkspace，不再作为 Paper activeView
DesignSystemWorkspace/: 开发态 Quiet Editorial Design System 工作区，按 Foundations/Primitives/Navigation & Overlays/Editorial/AI & Organize 五层直接陈列生产 Token、Lucide Iconography、完整 Markdown/Reading/Quote/Code 与四种 Signature Components；通过 lazy import 只在 import.meta.env.DEV 下暴露
MarkdownEditor.tsx: Markdown 存储协议与 CodeMirror 显示协议之间的唯一 adapter；handle 只暴露 focus 与只读 readSelection（剥掉零宽标记后返回选中文字，不触碰选区/撤销/自动保存），GFM language 常驻，live/source 只通过 Compartment 重配显示扩展以共享 EditorState/选区/撤销历史，零宽空行标记和纯文本粘贴继续保证 content_mdx 无损往返
MarkdownEditor.test.ts: 以 content_mdx 恒等 round-trip 验证普通文本、2/5+ 连续空行、首尾/连续空格、强调段、空白行与 CRLF，约束零宽标记、HTML 空标签和 nbsp 永不离开 adapter
MarkdownLivePreview.ts: CodeMirror 6 原生 Live Preview 引擎，以 syntaxTree/visibleRanges 只扫描可见 block；活动标题保留弱化且无下划线的源码标记，非活动标题隐藏标记和分隔空白，活动/多选区与不安全语法回退完整源码，隐藏范围同步提供 atomicRanges，IME 合成期只映射旧装饰并在结束后刷新
MarkdownReadingView.tsx: react-markdown + remark-gfm + 可选 remark-breaks + rehype-sanitize 的共享只读正文边界；备忘录阅读态保留单换行，AI 消息维持标准 CommonMark，并以模块级稳定渲染器 + Context 只装饰最后可见块；历史块和最后块的稳定前缀保留原生文本节点，末尾最多五个动画 span，固定 skipHtml 并禁止原始 HTML、JSX/JavaScript 执行
MarkdownReadingView.test.tsx: 阅读换行、安全、常数尾部动画节点与文件边界测试，覆盖备忘录单换行/空行分段、GFM 表格/任务/删除线/引用/代码、脚本/HTML/危险链接剔除、Markdown 五词错峰拖尾、历史正文不装饰、结束回归原生文本，以及 title 到 .md 文件名归一化
MarkdownViewMenu.tsx: 中央 Toolbar 的高频 editing/reading 切换与 More 菜单；支持外部点击、Escape、方向键/Home/End、焦点恢复，并仅复制/导出当前原始 content_mdx，title 只用于文件名
markdownViewTypes.ts: DocumentView editing/reading 与 EditingMode live/source 的共享状态协议，阅读状态不占用编辑模式槽位
NotesWorkspace.tsx: /app Paper 内部写作列，以跨临时/真实后端 ID 不变的 memoClientKey 保持编辑器会话；按需正文未到达前不把空标题反写轻量树，新建时聚焦并选中默认标题，imperative handle 暴露 Agent/整理 required flush、正文替换、删除 pause、已提交 AI 标题接纳，以及探索所需的只读选区读取与焦点归还——写作态取 CodeMirror 选区，阅读态取阅读视图 DOM 选区
PaperWorkspaceShell.tsx: Paper First 四层空间壳；以 AnimatePresence 编排 Ghost Panel Toggle、按需文件库、唯一 Paper 与 AI 思考空间，Panel 仅使用无弹跳 x/opacity Tween，1200px+ 单侧建立安全区、1400px+ 才允许双侧同时预留，较小视口互斥覆盖并提供画布空白/遮罩/Escape 关闭；成功/撤销时只持久连接 Paper 与真实树目标。探索态在此只做三件空间上的事: 让两侧 Panel 平移出画面但保持挂载（Panel 是条件渲染，卸载等于草稿销毁）、给活纸套上 PaperRetreat、把量好的几何交给 ExploreStage；期间冻结纸的滚动以守住量好的那一次几何，并把切换笔记造成的滚动归零推迟到退场之后
useMemoAutosave.ts: 单 memo 编辑会话状态机；支持 required flush、删除期 pause/resume、AI 标题接纳，并只在没有本地草稿时采纳同一 memo 的迟到服务端初值，避免刷新空白或覆盖输入
useMemoAutosave.test.ts: 覆盖迟到服务端正文接纳门禁、插入/删除/等长替换字符计数及三次有界指数退避
WorkspaceAuxViews.tsx: 纸内辅助视图挂载点；订阅、回收站、Design System 住在 Paper 内部且彼此互斥。已保存画布属于独立空间语境，明确由 CanvasWorkspace 承载，不得重新并入此分支
TrashWorkspace.tsx: /app 回收站控制器，读取真实顶层删除根并编排重试、恢复、永久删除和当前用户原子清空，结果统一进入根级 Toast
TrashWorkspaceView.tsx: 无网络纯视图，复用 ui-page、Button/Dialog/Skeleton 与语义 token，区分 Folder/Memo 并覆盖 loading/empty/error/list/危险确认/提交锁
TrashWorkspace.test.tsx: 回收站纯视图回归测试，覆盖状态页、Folder 根不展开、永久删除/清空确认文案与防重复提交
AccountDialog.tsx: UserMenu 身份卡片与设置项共同打开的唯一设置模态框，以小尺寸 4:3 居中表面、192px 左栏和轻分隔主内容标题栏组成骨架；左栏不设重复大标题，只在“通用”分组下列账户/外观真实页面，Profile 后台刷新期间保留缓存资料与可操作页面，仅以 aria-busy/隐藏状态文字表达请求，不清空为 Skeleton
AccountProfilePanel.tsx: AccountDialog 的账户资料栏，以后端单一非空 username 初始化草稿，Profile 后台刷新按字段合并：未修改字段接受服务端新值，正在编辑字段保留本地草稿；停止输入 800ms 后串行 PATCH 用户名/简介且不锁定输入，不保留显式保存按钮，头像选择后即时上传最大 5MB 的 JPEG/PNG/WebP，成功、校验与失败状态进入全局 Toast，服务端 Profile 结果回传 Dashboard
AccountSettingsPanel.tsx: AccountDialog 的外观栏，在“主题”同一行消费 Design System SegmentedControl 提供系统/白天/黑夜偏好；system 实时跟随设备并仍只解析到同一套 light/dark token
SubscriptionWorkspace.tsx: /app 订阅入口工作区，以纯白画布、三档可选方案、权益清单与选中回执展示 5/20/100 美金订阅
AgentPanel/: /app 按需浮现的右侧思考空间，以共享 48/32/16 单行 Header、本地 Ghost 图标命令、无描边历史打开态、空白初始正文与底部工具化 Kumo Composer 承载当前 memo/最多五篇引用、多会话、权限设置与低置信度整理确认；AI SDK useChat + UIMessage parts 管理 SSE/停止/处理过程/工具/整轮撤销，通过 Supabase Bearer token 对接 chat /v1/chat，并顺带承载 organize/explore 两个非流式 client 以复用同一套 token 注入与错误信封归一

职责: 业务组合组件层，承载 Landing 工程骨架、Paper First 舞台与其探索态、后端驱动的按需文件库、右侧 AI 思考空间、统一认证、同源账户模态框与各业务工作区；探索态的候选只来自 explorationStore，视图层不持有第二份候选，也不把它们并进目录树；业务组件禁止裸写 fetch 或直连 Supabase 业务数据，唯一例外是 AgentPanel 的 AI SDK transport 在发送时读取 Auth token 并访问独立 chat 服务。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
