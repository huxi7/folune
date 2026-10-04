# app/src/pages/
> L2 | 父级: ../../CLAUDE.md

成员清单
useCheckoutFlow.ts: 订阅/积分共用结账编排；同步防连点、稳定幂等键、创建未知只查原付款、自动安全导航与离开中止；付款身份沿原路保留，后台及返回窗口主动核对后刷新权益。
useCheckoutFlow.test.tsx: 验证连点幂等、未知创建恢复自动跳转、迟到响应隔离、后退清理过渡、返回核对及服务端确认前不发成功回执。
CreditsPage.tsx: 积分弹窗读取服务端目录并委托 useCheckoutFlow 一次点击结账；页面只持有选择、目录重试与关闭生命周期。
CreditsPage.test.tsx: 验证积分一次点击自动跳转、无二次确认或订单面板、目录失败重试、选择保留与关闭中止。
SubscriptionPage.tsx: 独立订阅页投影服务端月年方案，委托共享流程直接结账；不装配确认弹窗、订单历史或支付管理。
SubscriptionPage.test.tsx: 验证一次点击订阅、管理员也无支付管理入口、月年报价、同意图重试、关闭隔离与中英文界面。
subscriptionNavigation.ts: 订阅导航的纯路径边界，以 isSubscriptionPath 同时识别标准地址与尾斜杠，只允许 /app 或 /app/notes/:noteId 来路，保留底层笔记身份且拒绝外部/无关路径
subscriptionNavigation.test.ts: 验证 memo/Canvas 来路保真、外部/非法路径回退、直达订阅默认落点和普通工作区忽略陈旧返回 state
subscriptionController.test.tsx: 真实 Router/controller 验证订阅往返保留 memo/Canvas 身份与挂载实例，直接深链不触发首屏恢复或自动创建笔记
useSubscriptionKeyboardBoundary.ts: 订阅可见时在 document 冒泡阶段隔离 keydown/keyup，阻止隐藏工作区的 window 快捷键监听器，保留控件默认行为和 Dialog 同层键盘仲裁
useSubscriptionKeyboardBoundary.test.tsx: 验证订阅隔离键盘事件而保留控件默认行为与 document 监听，关闭/卸载后 window 工作区快捷键恢复
LegalPage.tsx: 独立公开 /terms 与 /privacy 装配，共用 PublicArticle 和营销壳，pathname 变化重播同构的花纹局部外框/纹样入场；登录/页脚来路返回，协议互链不污染博客集合，提供真实邮件联系入口
LegalPage.test.tsx: 匿名直达、登录到协议再返回、协议互链、元信息、页脚可发现性与原博客阅读回归；花纹完成后 query/锚点保留终态，目录/正文/协议路径切换重新入场
legalSite.ts: 运营者 huxi、正式域名、经确认的联系邮箱和协议版本日期的单一事实源
termsContent.tsx: 按实际功能撰写服务条款，区分内容权利、AI 操作、未接通支付、人工注销和法定救济
privacyContent.tsx: 按真实数据流披露 Google 基础身份、Supabase、DeepSeek、公开头像、本地缓存、保存及删除权利，Google 数据单独限定用途
usePublicPageMetadata.ts: 博客和法律页共用的标题/摘要生命周期，离场恢复已有元信息
useWorkspaceEntryReady.ts: Paper/Canvas 共用的一次性首屏就绪桥梁；等待导航空闲与两帧提交，错误撤销覆盖层，入口编号阻止旧页面推进新加载
MarketingLayout.tsx: 首页、登录、博客、动态和独立法律页持续挂载的公共壳，持有唯一 MarketingHeader 与 Router ScrollRestoration；登录内容使用弹性单屏布局并省去 Footer，其余页面保留 Footer，路径变化聚焦主标题；useMarketingMotion 在滚动恢复后编排可视正文，路径/锚点原生过渡与一次性滚动浮现共用节奏，query 不重播
LoginPage.tsx: 桌面复用正文与表单但不挂营销壳，保留原字体/背景； /login 公开认证页，384px 表单与完整 3:4 插画左右并置，共享首页公告和 Header；公告单独包入 fullBleed BlueprintFrame，使主轨/外轨与顶栏及首页同轴；正文铺设终选 01A 极慢散墨，标题去除行末标点以视觉居中，视频静音自动循环；AuthForm 独占认证步骤，成功仍经 /app Profile 守卫准入
BlogPage.tsx: 返回首页复用 Secondary Button 材质与标准箭头，博客题眉使用 FOLUNE 杂志品牌刊物署名；目录分类与摘要下主题标签、文章分类复用同一材质； /blog 与 /updates 两个分区共用目录和 :slug 阅读页；pathname 作为骨架 key，目录/正文通过 BlogFrameSection 共用两侧花纹局部外框先现/纹样后现，主轨与其他分隔线直接显示，query/锚点不重播，Hero 后空轨上沿有节点、下沿平直；section 选择独立内容集合、标题与目录路径，动态复用点阵标题及无封面整行列表并提供空状态；正文交给 PublicArticle、元信息交给 usePublicPageMetadata；保留来路返回、404 与同分区推荐，目录统一为无封面整行单一链接且不重复显示阅读按钮，Hero 上方空轨承载返回首页，列表由主页同高上下空轨包围，共享波浪侧纹仅覆盖列表高度、不进入空轨，Hero 后空轨下边的中段静态绘制，两侧短横线由花纹外框补齐且无节点；博客保留同组阅读规则；全部文章/目录链接复用 MarketingLink，标题与阅读正文标记交给营销壳浮现，返回继续使用原历史状态
workspacePreload.ts: 正文邻居与 Canvas 代码预热共用的在线/前台/省流/慢网判据，只约束非必要预取，不阻止主动打开
workspacePreload.test.ts: 验证弱网、省流、后台与离线不预取，以及缺失 Network Information 时的兼容行为
MotionLabPage.tsx: DEV /motion-lab 无鉴权验收入口，复用生产 MotionSpecimen，所有交互只更新本地 fixture 状态，并链接真实 AppSidebar/归档线验收台
useAppDashboardController.ts: 退出先flush笔记并通过Canvas保存门禁，认证成功后才取消选择/清树/导航；投影助手唯一可见性并在场景边界恢复笔记尺寸/解析画布短窗或明确返回尺寸； 从 subscriptionNavigation 解析订阅背后的原笔记身份，订阅深链不触发恢复/创建笔记且暂停 Command+E 编辑快捷键；桌面退出/重启注册现有笔记 flush 与 Canvas 持久化门禁； 首次准入等待入口解析与正文就绪后报告完成，新账号初始化失败释放加载层；普通笔记选择交给 useMemoSelection，树高亮即时响应、正文导航按帧合并且保持可中断，不强制同步挂载编辑器；仅 Canvas 离场等待保存且最后一次选择生效，新选择清理旧定位； Dashboard 单次持有的状态/命令协调 Hook，保持 Profile/正文订阅、乐观事务、flush/导航、工具预载、唯一响应式判据与归档 canonical 目标；普通本地辅助视图走 transitionContent，跨路由快照交给 Router 当前节点查询按 tree/路由 ID 缓存，相邻正文预取等当前正文就绪；文件夹创建和改名成功静默，失败保持原有 Toast。
.gitkeep: 保留页面层空目录
CLAUDE.md: 记录页面层职责与文档协议
LandingPage.tsx: MarketingLayout 内的公开首页正文，以 1120px 主轨和流式分区组合居中 Hero、大幅编辑器、图文叙事；顶栏与全宽 Footer 由父布局持有；声明中文语言，复用 DS 字体回退、圆角按钮和品牌墨蓝，保留参考布局与背景
ArchiveCordLabPage.tsx: resizeHandle 复用宿主独立边界插槽； 仅 DEV `/archive-cord-lab` 归档线验收 fixture；复用生产 PaperSurface/ArchiveStatus/AppSidebar/WorkspacePanelLayer/PanelResizeHandle/ArchiveCordOverlay 与真实 organizePresentation 构造器，以三层嵌套 + 上下填充的确定性假树覆盖 fresh/restore/清除、逐层折叠展开、tree 滚动贴边、文件库开关、Panel resize 与 Light/Dark。纸必须由 PaperSurface 包出来——`.app-main-panel` 是单 grid area，7:9 比例基线与 `.paper-content-transition` 叠在同一格里，少了那层顶栏会被放到基线下面那一行、source 直接掉出视口。进入时清掉 fixture 专属的展开偏好键使结论可重跑；假 ID、假内容，不读写 API、数据库、真实用户正文或真实 AI run
ColorLabPage.tsx: 仅 DEV `/color-lab` 色彩决策实验页，以同一静态 Paper First/Library/AI DOM、共享生产组件与候选选择、Light/Dark 控制公平比较现有蓝、02 灰蓝、04 标准墨蓝与 05 柔和墨蓝 scoped token，不读取鉴权、业务数据或主题持久化
AuthCallbackPage.tsx: /auth/callback 路由页面，交换 Google OAuth PKCE code，成功进入 /app，失败提供返回登录入口；状态卡片复用 auth.css 的中性表面、文字角色与状态提示，会话 Spinner 在 reduced-motion 下静止
AppDashboard.tsx: 菜单/设置统一先打开退出确认，确认后才调用真实退出；Workspace视觉装配根与用户级BillingProvider；文件库走原常驻宿主，AI走胶囊/短窗/全高宿主，AgentPanel实例跨Paper/Canvas持续；订阅隐藏/inert保留底层会话，积分路由沿原来路返回
CanvasRouteCoordinator.tsx: `/app/notes/:id` 的 Canvas 路由协调器；把入口 Canvas bootstrap 冻结为本次挂载的不可变快照，避免缓存消费后在浏览器拍新帧前撤掉目标纸面身份，也避免下一轮离场 bootstrap 反向注入仍在场的旧 Canvas 并制造重复 transition name；另统一 Canvas→原文→Canvas 返回描述、画布重命名与会话 flush 暴露，不持有图数据、保存队列或跨路由文件库。画布→写作区那一跳由它的 navigate 带 viewTransition 起——路由状态落地是异步的，谁持有 navigate 谁才能在正确的那一刻开始过渡
DashboardDialogs.tsx: 五栏设置与新建文件夹的纯受控组合，透传真实退出命令和独立订阅入口；外层 presence 等待 Dialog 自身退出，文件夹落点与重名裁决不变
appDashboardTypes.ts: Dashboard 私有状态类型边界，集中定义含首屏 tree bootstrap 与入口编号的 loader、账户/文件夹弹窗、标题草稿与树加载状态，不承载运行时逻辑
memoDeletion.ts: 删除导航纯算法，区分“当前路由被影响需要导航离开”与“当前路由是 memo 需要等 autosave flush”两件事（画布没有编辑会话可等）；落点按移除前取下的同级槽位就近选择：同级后一篇 → 前一篇 → 沿祖先链上一层，整条链都没有才钻进旁边文件夹（钻进去会撑开它），画布不作落点——取整树第一篇会把选中、展开与滚动一起拽回树顶，删除与新建失败回退共用这一条
memoDeletion.test.ts: 覆盖删除当前 Memo/祖先影响判定、删除正在打开的 Canvas 只导航不 flush、就近落点的五种位置关系（同级后/前、上一层、删文件夹、祖先链无笔记才钻旁边文件夹）与画布不作落点，及无剩余 Memo 空态
useMemoNodeDeletion.ts: 软删编排 Hook；沿用调用方共享的 mutating 门禁，删除前对 memo 会话做 required flush，摘除前先取同级槽位供就近落点；乐观移除与导航落在同一 React 批次、网络确认置于其后，删当前笔记时路由从被删项直接跳到落点、不经过 memo===null 的空态闪帧，成功确认后才清正文缓存与 last-memo；失败随 store 回滚原路退回并恢复编辑会话
useOptimisticMemoCreation.ts: 人工创建事务编排；每次点击立即插入临时笔记与完整标题，独立跟踪网络请求；成功/失败交给选择意图边界对账或回退（失败按临时笔记所在的同级首位就近落点），不直接导航或强制同步渲染
useMemoSelection.ts: 文件树即时选择与正文路由之间的意图边界；同帧只导航到最新目标，路由保持可中断，临时 ID 落库前后保留 push/replace 语义；旧回包与旧过渡不能抢回高亮，历史返回/辅助视图/卸载取消待执行导航
memoCreation.integration.test.tsx: 真实 Router/Dashboard/Store/ThemeProvider/侧栏时序回归；Canvas 预载只替换单个函数并逐测恢复，不抹除真实组件导出；连续 32 次点击即时插入与选中且仅最终正文挂载、不使用 flushSync；正文 Suspense 期间继续新建，乱序回包、失败回退、Canvas 保存、首帧前确认与历史返回均保持最新选择；可见目标不滚动，离屏保留平滑定位
useMemoDocumentLoad.ts: 当前笔记正文请求生命周期边界；目录 ready 后只为未缓存的选中 ID 发起单篇读取，并可复用已在途的意图预取，失败统一送入 Toast
useMemoDocumentPreload.ts: 正文按需架构的空闲预热 Hook；只预取当前笔记阅读顺序相邻的前后两篇，点击/键盘意图预热仍由文件树触发，不扩大目录载荷 执行时跳过后台页、离线、省流和 2G/3G 网络，优先把带宽留给正在打开的正文。
useAccountProfileRefresh.ts: 账户资料生命周期协调器；每次打开只后台刷新一次并保留现有资料，栏目切换不重复请求
useMemoOrganize.ts: AI 整理生命周期协调器；发送前 required flush，按用户恢复最近 Run，编排 plan/apply/reject/undo，并把成功或撤销结果局部归并到 Memo Store、把 stale 诚实反馈给用户。刷新取回的最近 succeeded/undone 以 restored 交回展示层：刷新不是语义事件，因此不重播 fresh、也不强行展开文件库。切 memo 才清除 presentation，而「首帧还没有 currentMemo」不算切换——恢复请求是异步的，把它当切换会在树刚到达时把刚恢复的关系抹掉
useMemoOrganize.test.ts: 锁定 succeeded/undone 唤醒文件库、canonical 目标恒为 memo、路径按当前树重算（memo 被移动后 run 快照不再作为落点来源）、fresh/restored 原样透传、根级人话落点，以及 awaiting_confirmation 唤醒 AI、stale/failed/过程态与 memo 已不在树中都不产生归档展示
useMemoCanvasEntry.ts: memo↔默认 Canvas 路由协调器；真实点击后先 required flush，再依次取得默认 Canvas 身份与完整 detail，等待期间保留原 Paper；detail 写入对应一次性 bootstrap 后才由 navigate 带 viewTransition 导航，失败则留在原页恢复入口状态。返回画布复用同一 memo 纸面名字，且同样先预取 detail 再导航——否则卡片要等画布自己请求完才出现在 DOM 里，浏览器拍新截图时落点那张纸还不存在，整段就只剩硬切；预取失败退回普通跳转，返回本身不被动画绑架
useStandaloneCanvasCreation.ts: standalone Canvas 创建协调器；从当前树读取同级 Canvas 并复用笔记编号算法，ref 门禁同步拒绝重复提交；只接受服务器事务返回的真实身份，再局部并入 tree、登记 standalone 进入语境并导航；创建成功以页面切换反馈，失败才 Toast
useStandaloneCanvasCreation.test.tsx: 真实 Hook/Tree Store 验证同目录连续编号、服务端让号回名、同帧重复提交门禁与失败后可重试
canvasIncrementalLayout.ts: Canvas 候选增量布局纯策略；复用既有分支向外生长并以确定性角度/半径寻找无碰撞位置，人工加入和 AI expansion 共用且永不移动旧节点
canvasIncrementalLayout.test.ts: 锁定候选稳定排序、分支外向生长、无碰撞与旧节点对象/坐标不变
canvasEntryBootstrap.ts: Paper→Canvas 的短命数据交接边界；按 canvasId/userId/token 暂存已经取得的 Canvas detail，30s 后自动失效且只允许对应 Coordinator 消费一次，不持久化也不替代后续重取
canvasEntryBootstrap.test.ts: 锁定 bootstrap 的 canvasId/userId/token/TTL 隔离、一次消费与命中时零重复 getCanvas
canvasPresentation.ts: Canvas V2 图投影纯决策；把服务端 memo_ref/native/墓碑、尺寸、text_scale、关系与 user_moved 视口翻译成 React Flow 数据，允许 UI-only motionState 装饰节点/边但不进入持久文档；按 ID/字段保留未变化对象身份与拖动中瞬时坐标，并集中提供可用视口、成组外接框和手势级坐标回写判据。快照 revision 不再进入视图模型：卡片标题与摘录读的一直是笔记最新内容，据此比出来的「漂移」用户看不见，而快照只在创建时写一次因此那条提示永久消不掉
canvasPresentation.test.ts: 锁定 memo 快照/墓碑/native 空间文字尺寸与 text_scale、未变化节点/无关 Cord 的对象身份、拖动中瞬时坐标保护、revision 漂移、视口钳制、用户视口恢复与跨设备可用性判据、成组外接框的出现时机与并集矩形（框选途中一张即成框、静止单选不成框、自带框在场即让位）、整组坐标回写与 V2 路由识别
organizePresentation.ts: 整理 Run 到 Workspace 工具唤醒及归档展示快照的无副作用策略；路径与存在性一律从当前 memo tree 重推，run.result.target_path 那份快照只证明这条 presentation 为什么存在——memo 之后被移动过它就开始撒谎；memo 已不在 active tree 即语义级清除。OrganizePresentationRun 带 fresh/restored，因为「刚刚发生」与「本来就为真」必须能分开
workspaceLayout.ts: Paper First 浮层几何与宽度持久化边界，集中维护文件库/AI 尺寸约束、CSS 变量类型和 localStorage 校验，AI 默认/最小宽度同源读取 assistantGeometry 的短窗宽度，旧的过小宽度读取时钳制；另持有 Workspace 唯一的覆盖式布局判据 useOverlayPanels（1200 单 Panel / 1400 双开两个断点），由 Dashboard 持有一份 state 下传给 Paper 壳与归档 Overlay——任何在 render 里裸读 window.innerWidth 的地方都会成为漂移的第二真相
viewTransition.ts: 同文档过渡唯一入口，也是纸面命名的唯一真相。卡片↔预览、笔记↔画布、预览↔写作区都只是「把这次 DOM 更新包进一次视图过渡」，截图/变形/交叉淡换全归浏览器；手写那条路要逐项复刻落点的圆角形状、字形抗锯齿、阴影缩放与容器查询字号，那张清单没有尽头。一次手势里只有两个名字：纸壳 paper-<memo> 与纸内正文 paper-body-<memo>——分开是因为壳是纯色圆角矩形拉伸看不出来，而位图化的字一放大就是「字在膨胀」。除此之外任何元素都不许命名：过渡层的兄弟顺序由被捕获的先后决定，与 z-index、DOM 嵌套无关，只在新状态出现的名字一律排到最后，因此一层自带名字的全屏遮罩会稳稳盖住那张正在放大的纸——用户看到的是一整段空白然后结果「跳」出来。名字同时只能属于一个元素，所以卡片/预览/写作区三处永不共存。它只服务纯本地 DOM 更新（配 flushSync 保证新截图拍到的是新 DOM），跨路由三条归 React Router 的 viewTransition：导航是异步的，在外面包一层只会拍到还没换的旧页面。四种方向写进 html[data-paper-transition]，节奏由 CSS 解释
workspaceMotion.ts: 工作台领域适配层，从 DS motion.ts 重导出基础配置；只额外提供 tree FLIP 的 CSS 曲线与 JS 求值，使结构重排、树展开与归档端点共用 210ms 时间轴
workspaceMotion.test.ts: 锁定左右侧栏外侧8px/原220与170ms/全程scale1，禁止Popover缩放回流；无模糊85%遮罩随root同步且不拥有独立过渡身份； 锁定唯一语义时长/spring/stagger 与纸面过渡规矩——承载正文的表面零过冲（控制点 ≤ 1）、纸壳等比取景（cover，非等比会把圆角拉成椭圆）、纸内正文永不缩放只被 image-pair 取景框裁切（object-fit: none + overflow: clip）、两端排版的交接严格互补（浏览器用 plus-lighter 混合，不互补就发灰或叠字）、四个方向的世界都不长于纸的形变、纸面恢复300ms/240ms并保留完整加减速曲线、预览→编辑区与编辑区→Canvas 都必须由路由纸面通道接管、入口 bootstrap 在单次 Canvas 挂载内保持不可变、只有纸与纸内正文拥有过渡身份；另锁画布会话的 deps 只认 (登录用户, 画布)，防止上层记录一次返回描述就 reset Store 并让预览在取景前消失；并跨 Canvas/Panel/Dialog/Cord 样式证明 reduced-motion 只保留 90ms 淡入

职责: 页面层，承载 URL 级 Landing、独立登录、OAuth 回调、受保护 Dashboard、独立订阅流程与不进入生产状态的开发态视觉决策边界；Paper/Canvas 路由编排与 Canvas 增量布局/投影以协调 Hook 和纯函数收口，组件只消费结果。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

本次侧栏生命周期约束：Paper/Canvas 只承载中央内容与工具开关，左右工具由 Dashboard 的 WorkspacePanelLayer 持续挂载；从笔记进入默认画布继承当前工具开关，动画不得重建 AgentPanel。
