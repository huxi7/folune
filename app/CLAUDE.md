# app/
> L1 | 父级: ../CLAUDE.md

用户端模块，负责承载浏览器内的 SuperNote 产品体验边界。

技术栈: Bun + Vite + React 19 + React Router + Zustand + Vercel AI SDK/useChat + @mastra/client-js + Web Worker + canvas-confetti + Kumo UI + Tailwind CSS v4 + 本地 design system + Supabase Auth SDK + system/light/dark 全局主题偏好 + Phosphor Icons + CodeMirror 6/Lezer Markdown GFM + react-markdown/remark-gfm/remark-breaks/rehype-sanitize + TypeScript。

成员清单
index.html: Vite HTML 宿主页面，声明 V1 Classic Blueprint 默认画布、同步解析 App 的 system/light/dark 与 Landing 浅色画布 pre-paint bootstrap、提供 root 挂载点并内联折角笔记页 favicon
.env.example: app 浏览器环境变量模板，声明业务 API、chat 服务 base URL 与 Supabase 公开连接配置
AUTH_SETUP.md: Supabase 邮箱确认模板、URL allow list、自定义 SMTP 限制与 Google OAuth 后台配置说明
UI_REFINEMENT.md: UI-only 工作台账，记录 V1 Classic Blueprint 基线、约束、验收进度与决策
vite.config.ts: Vite 配置，从 app/.env.local 加载浏览器环境，将开发服务器严格固定到 10000，连接 React/Tailwind 插件，并用 Rolldown 按 React 封装、Markdown、View、State、Language、Features 拆分 CodeMirror chunk
src/main.tsx: React 挂载入口，在 ThemeProvider 内、RouterProvider 外装配全局 ToastProvider 并加载全局样式
src/index.css: Kumo/Tailwind v4 入口与唯一色值源，冻结 V1 Classic Blueprint、自然现代主色、统一 smooth corner/阴影/动效、确定性白/中性灰蓝表面及 light/dark Skeleton 语义 token，并导入 AI 消息与同构 DEV Design System 等职责样式模块
src/styles/: UI 样式实现层，以 landing.css 隔离营销页、workspace.css 隔离三 Panel/真实结构 Skeleton 布局、design-system.css 统一固定灰阶宽光带与 reveal、ai-message.css 统一 SSE 消息家族、design-system-workspace.css 统一 DEV 组件卡片矩阵、CodeMirror CSS 隔离 source/live 显示协议，其余样式按认证、Toast 与账户菜单分责；跨样式颜色插值统一使用 sRGB，避免低饱和 OKLCH 混合产生粉红表面
src/app/: 应用装配层，承载 OAuth 回调、Profile/access token 登录守卫、仅用于 /app 首次准入的三 Panel Skeleton fallback 及共享 Dashboard 生命周期的 /app 与 /app/notes/:noteId 路由
src/pages/: 页面层，承载 Landing、OAuth Callback 与三 Panel Dashboard，并编排删除前草稿 flush、删除后编辑会话/路由/last-memo 收束
src/widgets/: 业务组合组件层，承载 Landing、文件导航、账户/订阅/Agent、memo 连续写作画布与真实回收站；AgentPanel 独立对接 chat SSE，以 Mastra Client 分流独立庆祝视觉工具与由专用 Worker 规划的备忘录命令，再复用现有 Store/API 执行
src/shared/: 前端共享层，承载唯一业务 API 中枢、Zustand 状态、含统一 Skeleton/延迟显示策略、SuperNote AI Formation Motion/互斥 Activity 消息家族/SidebarButton/Kumo-backed Toast 适配器的 design system、纯 Supabase Auth 服务与全局主题状态；前端禁止直连 Storage
docs/: UI 验收证据目录，仅保存仍可复核的 V1 Design System 语义说明与 computed Token 快照；历史截图已作废，视觉判断必须重新读取当前运行界面
package.json: Bun 包元数据、Vite dev/build/typecheck 与 Bun test scripts 及用户端依赖清单
bun.lock: Bun 锁定依赖版本
tsconfig.json: TypeScript 编辑器与编译约束
.gitignore: app 模块忽略规则

交互组件约束: 侧栏导航必须复用 SidebarButton；根级“新建备忘录”只出现在 sidebar header 右侧，并复用带专属笔记书写图标的 Primary Button，禁止退化为孤立加号或在文件树上方重复绘制整行新建按钮。Design System 与回收站位于文件树之外的同一底部导航列表，各占一行、规格一致且不显示额外分组标题。APP、设置模态框与侧栏命令统一使用默认 Button 高度和 smooth-corner 曲率，递归文件树的 folder/memo 行是唯一密度例外，以 30px 行高和逐级缩进承载高频浏览，不绘制永久父子导轨。文件夹开合只允许 Folder/FolderOpen 单一状态图标，不额外添加 Caret；同层文件夹与文件共享固定图标槽，标题必须严格对齐。树行单击只负责导航或开合，双击任意 folder/memo、右键重命名或聚焦后 F2 均进入同一原地 input；Enter/blur 提交，Escape 取消。文件树节点是固定位置的扁平列表项，hover/press 不得产生位移或抬升。原生拖拽预览按节点身份分型：folder 必须显示纯文件夹图标与单行截断名称，memo 只显示纯 SVG 图标；二者都禁止胶囊、方框、按钮背景或实体阴影，仅允许图标/文字底层的极淡虚化光晕。拖拽源保留原位并弱化到 40%。拖拽命中区不得改变行高、层间距或整体高度；before/after/root-end 使用 8px 起始圆点+2px 插入线，folder 中段只显示原位放入态，实际位置变化统一用约 210ms Web Animations FLIP。除文件树的扁平交互例外外，其他 SidebarButton 的选中态和 prominent 态必须直接复用无明显描边 Secondary Button 的自然表面与内外阴影，不得维护第二套材质；Button、SidebarButton、UserButton 与 Select 的 hover/open 状态必须固定原位和静止深度，仅允许通过颜色或边框反馈，Button/SidebarButton 只有 press 可保留 1px 下压。UserButton、Select 动作和侧栏工具按钮同样消费统一平滑圆角，不得使用局部曲率。账户入口统一打开小尺寸 4:3 AccountDialog；192px 左栏不绘制重复的大标题栏，只以小型分组标题组织真实页面，当前“通用”只包含账户与外观，新增能力时再增加栏目或分组。每次打开只后台刷新一次真实 Profile，并继续展示 loader 或本地更新维护的旧资料；返回时仅合并未被用户修改的字段，禁止清空为 Skeleton，栏目切换不得重复请求。账户 username/bio 在停止输入 800ms 后静默自动保存并以 Toast 回执，不显示独立保存区或大按钮；模态框不得扩张为全屏设置页。瞬时业务反馈必须经根级 ToastProvider 发出，不在页面重复实现通知浮层。

空间与尺寸约束: APP 以 4px 为唯一空间基线，并在 `src/index.css` 集中维护 32/40/48px 尺寸阶梯。三处 Panel Header 统一为 48px 高、12px 水平内边距；Header 图标命令、Sidebar 新建、中央阅读/更多/助手开关、Agent 标识与关闭入口统一为 32px 容器和 16px 图标，因此上下自然各保留 8px 呼吸区，相邻命令间距统一为 4px。Button、Input、Select 与 SidebarButton 的默认控制高度统一为 40px；Agent Composer 作为复合输入表面从 48px 起步，内部动作位为 36px，InputArea 最多增长到 6 行后只滚动正文。30px 文件树行是高密度浏览的唯一例外。首屏 Skeleton 必须使用相同尺寸 token，禁止加载跳变；DEV Design System 必须直接呈现这套空间标尺与 Header 样板，且不得复制另一套展示专用值。

备忘录状态约束: `src/shared/store/memoTreeStore.ts` 是 active 文件树与正文草稿的唯一客户端状态源。GET 整树只允许在进入 Dashboard、登录用户变化或显式刷新时发生；创建、重命名、移动、软删除与恢复都必须乐观更新或合并局部响应，失败精确回滚，严禁写成功后刷新整棵树。Trash 只保存回收站列表视图状态，不得复制 active tree。删除当前 Memo 或其祖先前必须等待 `useMemoAutosave` required flush，失败保留路由、编辑会话和 subtree；删除成功后暂停旧会话、清理受影响 last-memo 并导航到下一 Memo 或 `/app`。中央连续画布、Markdown、reading/live/source、安全渲染与空白保真继续遵循既有单一存储协议；自动保存仍使用既有调度/重试参数且所有保存携带显式 memoId。

备忘录画布约束: 中央 Main Panel 自身就是唯一编辑表面，内部不得再绘制纸卡边框、圆角、阴影或独立底色；文件名标题与正文共享居中的 52rem 上限写作列，标题和水平留白必须依据可拖拽 Main Panel 自身宽度响应，而不是依据浏览器视口，标题保持 24–30px、正文保持 15px，reading/live 的正文 H1 必须严格小于文件名标题。标题、正文与 reading/live/source 切换不得通过重挂载破坏 CodeMirror 选区、撤销历史或自动保存会话。

状态反馈约束: 不提供通用状态胶囊；进行中状态由对应 Button loading 表达，操作结果由 Toast 反馈，页面长期信息使用上下文内的普通文字、图标或结构层级，不额外制造状态徽章。

Skeleton 加载约束: Skeleton 只允许来自 shared/design-system；首次无旧内容且真实结构明确时才使用，业务层必须按最终尺寸组合，不得自建灰块、shimmer 或计时器。统一采用低对比表面、3.6s 单组宽光带、180ms 延迟出现与 360ms 最短可见时长，reduced-motion 下保持静态。已有内容刷新必须保留内容，按钮操作只用局部 loading；页面级 Skeleton 仅用于 /app 首次 Profile 准入，memo tree 成功后侧栏与连续写作画布各自自然恢复。

AI 消息组件约束: 用户气泡必须与 Primary Button 同源；消息角色只由气泡材质、对齐和上下文表达，用户与助手回复上方禁止重复显示“你”“备忘录助手”等身份标题。AssistantMessage 最终正文严禁 border、background、radius、shadow 等任何卡片表面；流式正文以 Unicode 词边界追赶 SSE，英文按词、中文按语义词组从轻微模糊中落定，末尾只保留一根细光标，reduced-motion 下立即补齐且停止模糊动效。AI SDK `UIMessage.parts` 是回复显示顺序的唯一真相源：最后一次工具调用之前的模型实际可见 text、全部 reasoning 与工具 part 按原序组成处理过程，工具不得被二次抽取并堆到消息底部；最后一次工具后的 text 是独立最终正文，永远位于折叠容器之外。过程入口固定在全部过程文字和工具之上：生成期间以 ThinkingMark + 真实状态强制展开，生成完成后继续保持展开并显示“思考过程”，用户可在同一顶部入口手动收起或再次展开；普通无 reasoning/工具回复直接显示正文，不制造空过程区。处理过程只是透明度信息，视觉必须弱于最终正文，只允许自然留白过渡，不展示耗时、步骤数、工具数，不添加固定横线、厚重卡片、时间轴或伪造的“深度分析”文字。ToolCallBubble 以真实操作和可得标题生成人话动作名，整颗按钮可点击但不绘制展开箭头，宽度按名称自适应并复用 Secondary Button 材质；执行中展示低频 shimmer，成功/失败/取消使用克制灰阶图标，回复停止后未完成工具不得继续播放。点击工具按钮只可查看目标、类型/位置、结果等已净化的人话详情，禁止显示协议名、UUID、Token、耗时、原始 JSON、完整正文或开发者字段；状态不得由固定 timeout 猜测。客户端工具只能经 AgentPanel 注册表执行并显式 addToolResult 回灌真实结果；AI SDK 送达的 string/object input 必须先归一化。庆祝必须忠实接收用户 count，直接进入独立视觉执行器而不经过 memoTool Worker；由 canvas-confetti 托管唯一全屏 Canvas，并在浏览器支持时使用其内部渲染 Worker；左/中/右三个源点位于网页底边下方少量位置，中心固定于 0.5、左右保持镜像，发射以窄锥角和高初速形成先集中上升、后自然扩散的轨迹；明示多次庆祝使用约 32ms 的连续点射节拍，count:10 约 288ms 完成且不得出现波次间停顿，超大次数释放窗口封顶 400ms；停止按钮必须同时停止 AI 流并调用 cancelCelebration 立即复位活动 Canvas；整场动画最长 3 秒、不拦截交互、尊重 reduced-motion，并回传 requestedCount/renderedWaves；超大 count 不得被产品层拒绝，但可压缩视觉逻辑波次以维持固定粒子预算。备忘录工具才进入专用 Worker，必须基于最新 Store 快照生成单步计划，再调用真人操作同款乐观 Store/API/FLIP 动画链路；禁止浏览器直连数据库或 chat 服务端代写。

设计系统约束: 通用界面继续复用本地 design system；AI 对话面板明确使用 Kumo Button/Input 与本地 AI 消息家族，不得用原生元素另造基础控件。页面视觉必须围绕 src/index.css 暴露的 V1 语义 token 与 4px 空间/尺寸阶梯展开，Kumo 只作为基础件实现而不引入第二套产品视觉。V1 Classic Blueprint 是唯一开发/生产视觉基线；主题颜色仍只保留 light/dark 明暗轴，system 只是跟随设备的偏好入口，不产生第三套 token，也不再维护第二套预设、版本选择器或版本持久化。外观设置把“主题”与系统/白天/黑夜放在同一行并使用共享 SegmentedControl；轨道与选中片段保持平整，禁止增加内凹阴影、外投影、Select 或二级弹层。Button 使用现代硅谷包豪斯平面材质：自然现代蓝、统一 smooth corner、干净纯色背景、细实体边缘与零偏移均匀环绕柔影共同表达克制层级；禁止静态背景渐变、顶部内高光和底部偏色暗线，白色按钮必须保持纯白。hover 必须固定原位并维持静止深度，只保留颜色或边框反馈；press 位移限制为向下 1px 并同步收拢环绕柔影。loading shimmer 必须清晰可见但保持窄光带与低频节奏，disabled 继续保留可辨轮廓，禁止爆闪、强发光、厚重投影与塑料质感。Secondary Button 只显示用于界定实体轮廓的低对比弱边缘，以纯净 card 表面和比 Primary 更弱的零偏移环绕柔影塑形，不得退化为强 outline。SidebarButton 的通用默认高度与平滑圆角必须与 Button 一致；文件树行只覆盖布局密度，不另建材质，选中态和 prominent 态仍只允许复用 Secondary Button 材质。BrandMark 全站只允许“图标”与“图标 + SuperNote 标题”两种形态，不提供副标题。Landing 固定使用 Light Canvas，不提供 Landing Dark、颜色编辑、Token Override 或主题生成器。Landing 保持纯白无纹理底材，不使用纸张噪点或 Hero 点阵，避免额外纹理影响信息密度。Landing Header 顶边必须贴住视口，Header 与公告的背景横向铺满浏览器，同时共享正文 1088px 主轨坐标；只有同时满足 1200px+、支持 hover 与精细指针的桌面环境才在视口两侧显示辅助外轨，其位置取“视口边缘到主轨”距离的 1/5，横线穿过 10px 遮罩节点继续延伸到视口边缘；触屏设备与窄屏默认隐藏外轨并收束到主轨。Header 下节点在初始位置覆盖公告上节点形成共享交点，公告只压缩到 Header 约 2/3 高并随页面滚走，Header RailLayer 保持粘性。Landing 动效只允许 3–4px 一次性 reveal、Button 1px press 压感、2px CTA 箭头、loading 低频 shimmer 与 FAQ 展开等信息型反馈；禁止磁吸、卡片上浮、指针聚光、点阵漂移、循环浮动/脉冲及非交互区域的蓝色 hover 填充。全部浅色骨架导轨、Divider 与节点描边必须共用同一中性淡灰 token；节点内部以画布色遮罩导轨，严禁导轨穿模，Divider 不得用独立色块遮断纯白底材；正文横线止于主节点内侧尖端，全宽 Header/公告横线延伸至视口。正文继续使用 section sibling 14px Divider；末端预页脚只保留大产品图标、`立即使用 SuperNote` 标题与小号 `开始` 按钮，使用极淡蓝白渐变底材且不附加 eyebrow/副描述，正文左右竖轨在末端不设 Divider/节点，必须无割裂地直达深蓝 Footer。Footer 是无 BlueprintFrame 的独立全宽两段式画布，上层分栏导航、下层空旷品牌舞台；舞台使用大尺寸 SVG SuperNote 幽灵字，1.5px 描边必须与上层分栏线共用同一颜色变量，内部仅用 Footer 深蓝混入 3% 偏白前景色，保持静态、低对比但轮廓清晰。节点不得归属 section 伪元素，工程骨架不得参与 reveal 位移动画。

Kumo Toast 约束: 全局瞬时反馈必须经本地 Toast API 适配 Kumo Toast Provider/Manager/Parts；Kumo 负责队列、自动关闭、悬停暂停、焦点与滑动生命周期，表现层遵循 Kumo 同源 Root/独立材质层/Content 结构并以 SuperNote Token 塑造 Apple-like 中性半透明浮层。Toast 本体必须使用 smooth corner，状态只通过轻量图标传达，禁止旧式彩色竖线、图标盒、状态边框与彩色填充；业务层不得直接依赖 Kumo 协议。

纯白画布约束: Light APP 与 DEV Design System 的页面、卡片和预览底材必须保持纯白；轨道、Skeleton 与禁用态只能消费 index.css 中确定性的中性灰蓝 token，禁止以 muted/destructive 混色生成基础背景，也禁止用低饱和 OKLCH 插值制造可能偏红的表面、边缘或阴影。跨样式颜色插值统一使用 sRGB。Danger Button 是唯一允许保留实心 destructive 红色功能面的组件；错误 Toast、Agent 错误区、菜单危险项等其他入口只通过红色文字、图标和细边界表达，不允许红色或浅红色填充。非 Danger Button 的 loading 状态不得复用 Primary 填色，统一消费独立状态面与低频 Shimmer；dark 主题仍遵循其独立暗色语义画布。

本地环境约束: Vite 默认读取 app/.env.local/.env；业务 API 请求只允许经 src/shared/api/client.ts 使用 VITE_API_BASE_URL，默认指向 http://localhost:10001。AI 对话仅由 AgentPanel/chatTransport.ts 使用 VITE_CHAT_BASE_URL，默认指向 http://localhost:10002，并在请求期从 Supabase Auth 读取 access token；不传 userId，不接入 Supabase 业务数据。浏览器只接收 VITE_ 前缀的公开配置，api/chat 服务端密钥不得写入 app。

底部导航例外: Design System 与回收站的选中态表达“当前位置”而不是“可执行按钮”；两者继续复用 SidebarButton 的结构与尺寸，但选中时只使用 primary 前景色，禁止背景、边框、阴影和按压位移。此例外优先于上文通用 SidebarButton 选中材质规则。

流式 Markdown 生命周期约束: SSE 内容增长时必须复用模块级渲染器身份，通过 Context 传递当前正文与动效状态；已出现词节点不得因新分块重挂载。上游网络结束只表示不再接收新字，不代表视觉队列完成；StreamingText 必须排空剩余词并等待末词落定后，才撤销动效节点与尾部光标。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
