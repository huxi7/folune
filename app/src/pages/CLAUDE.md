# app/src/pages/
> L2 | 父级: ../../CLAUDE.md

成员清单
.gitkeep: 保留页面层空目录
CLAUDE.md: 记录页面层职责与文档协议
LandingPage.tsx: / 路由页面，组合顶边贴视口且背景全宽的粘性 Header、紧贴其下并约为 Header 2/3 高的全宽随页 Announcement、与正文 1088px 主轨对齐且仅在 1200px+ 精细指针桌面按边缘到主轨距离 1/5 补充外轨的开放横向骨架、正文 BlueprintFrame RailLayer、显式 14px/贴边 Divider、纯白 Hero、懒加载 LandingSections，并让无末端节点的正文竖轨直接承接无导轨的全宽深蓝 Fat Footer
ColorLabPage.tsx: 仅 DEV `/color-lab` 色彩决策实验页，以同一静态 Paper First/Library/AI DOM、共享生产组件与候选选择、Light/Dark 控制公平比较现有蓝、02 灰蓝、04 标准墨蓝与 05 柔和墨蓝 scoped token，不读取鉴权、业务数据或主题持久化
ExploreLabPage.tsx: 仅 DEV `/explore-lab` 探索态视觉实验台；刻意不自建任何布局或卡片，纸用生产 class、退后用 PaperRetreat、排布用同一求解器、浮层就是 ExploreStage，因此这里看到的观感等于线上观感。控制台只调候选数、置信度分布、等待态、静态清单与暗色，并读出求解器算出的纸缩放与各卡距离；真数据开关复用生产 exploreClient（实时取 token），不另立第二个 HTTP 边界，也不写任何持久化
AuthCallbackPage.tsx: /auth/callback 路由页面，交换 Google OAuth PKCE code，成功进入 /app，失败提供返回登录入口；会话 Spinner 在 reduced-motion 下静止
AppDashboard.tsx: 消费路由 Profile/access token 的 /app 编排层；组合轻量目录、按 ID 正文缓存与互斥的 PaperWorkspace/CanvasWorkspace，为人工/Agent/整理建立 flush 边界，按 Run 状态唤醒文件库或 AI，并把 soft delete/restore/Run 响应局部合并对应 Store。画布与笔记共用同一条 /app/notes/:id 路由且深链都合法，只由选中节点的 node_type 决定挂载 Paper 或无左右 Panel 的全屏 Canvas；深链刷新先用中性全屏等待确认类型，禁止画布前闪出 Paper/Panel，且不持有第二份「当前画布」状态
appDashboardTypes.ts: Dashboard 私有状态类型边界，集中定义 loader、账户/文件夹弹窗、标题草稿与树加载状态，不承载运行时逻辑
memoDeletion.ts: 删除导航纯算法，判定当前编辑 Memo 是否落在待删 subtree，并从剩余 active tree 选择下一路由
memoDeletion.test.ts: 覆盖删除当前 Memo/祖先影响判定及有/无下一 Memo 的路由选择
useOptimisticMemoCreation.ts: 人工新建路由协调器；同步进入临时备忘录并独立跟踪每个并发提交，乱序成功只替换自己的 ID，失败只撤销对应节点并在仍处当前页时回退
useMemoDocumentLoad.ts: 当前笔记正文请求生命周期边界；目录 ready 后只为未缓存的选中 ID 发起单篇读取，切换时中止旧请求并把失败统一送入 Toast
useMemoOrganize.ts: AI 整理生命周期协调器；发送前 required flush，按用户恢复最近 Run，编排 plan/apply/reject/undo，并把成功或撤销结果局部归并到 Memo Store、把 stale 诚实反馈给用户
useMemoOrganize.test.ts: 锁定 succeeded/undone 唤醒文件库与成功/撤销目标快照、awaiting_confirmation 唤醒 AI、stale/failed/过程态不强迫打开工具
useMemoExplore.ts: 探索生命周期协调器；另承载「保存为画布」——那是这片舞台上唯一的写操作，走实时取 token、把新画布就地并入文件树并唤醒文件库，与 useMemoOrganize 并列但刻意更轻——探索只读不写，故不创建 Run、不进审批链、不可撤销，候选只住 explorationStore。承载 ⌘/Ctrl+E 开关、发送前一次 flush（让服务端读到刚写下的那句话）、空白笔记短路、退场计时与焦点归还，并把纸投影为 reading 以让活编辑器在缩放期间隐藏而不卸载。下钻是「导航到那一篇再从它重新展开一层」，因此深度恒为 1
explorePresentation.ts: 探索态排布纯决策；置信度按「绝对值 + 名次阶梯」混合成亲疏，再由求解器搜索纸缩放与扇角，取「纸尽量大、扇尽量宽、且卡片不出视口/不互压/不压纸」的第一组解。距离是这个功能唯一的信息通道，故半径语义在此按用户读到的直线距离重写，而非沿用 radialLayout 自矩形边缘起算的半径
explorePresentation.test.ts: 排布回归测试，锁定窄带置信度仍铺开六成量程、并列置信度仍分得开、距离随亲疏严格递增、卡片与理由注文不出视口不互压、等待期与结果期共享同一纸张缩放，以及窄窗口判为不可行
canvasPresentation.ts: 画布投影纯决策；把服务端画布翻译成 React Flow 的节点与边，并在此判断「能否晋升、锚点是否漂移、目标是否成了墓碑」、视口容错与是否来自真实用户移动。resolveCanvasNodeId 让画布与笔记共用同一条路由——打开哪一种由节点的 node_type 决定，因此不需要第二套路由或第二份当前状态
canvasPresentation.test.ts: 画布投影回归测试，锁定引用卡片不可晋升、摘录卡片可晋升、正文只来自摘要或卡片自己的文字、revision 走前即判漂移、坏视口退回默认、旧程序化视口不恢复与坐标回写过滤 NaN
organizePresentation.ts: 整理 Run 到 Workspace 工具唤醒及归档展示快照的无副作用策略；成功使用服务端目标路径，撤销使用当前树恢复路径
workspaceLayout.ts: Paper First 浮层几何与宽度持久化边界，集中维护文件库/AI 尺寸约束、CSS 变量类型和 localStorage 校验
workspaceMotion.ts: 工作台唯一 Motion 配置，冻结 Panel 220ms 进入/170ms 退出、240ms 工作区布局与 180ms 淡入淡出 Tween，供 Paper/Panel/回执统一消费并避免弹簧回摆

职责: 页面层，承载 URL 级 Landing、OAuth 回调、受保护 Dashboard 与不进入生产状态的开发态视觉决策实验边界；探索与画布两种空间语境的排布/投影决策都以纯函数住在此层，组件只消费结果。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
