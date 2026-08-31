# app/src/pages/
> L2 | 父级: ../../CLAUDE.md

成员清单
.gitkeep: 保留页面层空目录
CLAUDE.md: 记录页面层职责与文档协议
LandingPage.tsx: / 路由页面，组合顶边贴视口且背景全宽的粘性 Header、紧贴其下并约为 Header 2/3 高的全宽随页 Announcement、与正文 1088px 主轨对齐且仅在 1200px+ 精细指针桌面按边缘到主轨距离 1/5 补充外轨的开放横向骨架、正文 BlueprintFrame RailLayer、显式 14px/贴边 Divider、纯白 Hero、懒加载 LandingSections，并让无末端节点的正文竖轨直接承接无导轨的全宽深蓝 Fat Footer
ColorLabPage.tsx: 仅 DEV `/color-lab` 色彩决策实验页，以同一静态 Paper First/Library/AI DOM、共享生产组件与候选选择、Light/Dark 控制公平比较现有蓝、02 灰蓝、04 标准墨蓝与 05 柔和墨蓝 scoped token，不读取鉴权、业务数据或主题持久化
AuthCallbackPage.tsx: /auth/callback 路由页面，交换 Google OAuth PKCE code，成功进入 /app，失败提供返回登录入口；会话 Spinner 在 reduced-motion 下静止
AppDashboard.tsx: 消费路由 Profile/access token 的 /app 编排层；以细粒度正文订阅和编辑器本地草稿隔离高频输入，统一 Paper/Canvas 离场 flush，把当前 memo 身份作为纸面过渡身份下传，并在两种内容壳之外持久挂载同一个文件库 React 实例，让 Paper/Canvas 路由交接被浏览器认成同一张纸且不重播树入场
CanvasRouteCoordinator.tsx: `/app/notes/:id` 的 Canvas 路由协调器；把入口 Canvas bootstrap 冻结为本次挂载的不可变快照，避免缓存消费后在浏览器拍新帧前撤掉目标纸面身份，也避免下一轮离场 bootstrap 反向注入仍在场的旧 Canvas 并制造重复 transition name；另统一 Canvas→原文→Canvas 返回描述、画布重命名与会话 flush 暴露，不持有图数据、保存队列或跨路由文件库。画布→写作区那一跳由它的 navigate 带 viewTransition 起——路由状态落地是异步的，谁持有 navigate 谁才能在正确的那一刻开始过渡
DashboardDialogs.tsx: Dashboard 账户与新建文件夹覆盖层组合，只适配受控状态、回调与新文件夹落点，避免主编排重复展开 Dialog 生命周期
appDashboardTypes.ts: Dashboard 私有状态类型边界，集中定义 loader、账户/文件夹弹窗、标题草稿与树加载状态，不承载运行时逻辑
memoDeletion.ts: 删除导航纯算法，区分“当前路由被影响需要导航离开”与“当前路由是 memo 需要等 autosave flush”两件事（画布没有编辑会话可等），并从剩余 active tree 选择下一路由
memoDeletion.test.ts: 覆盖删除当前 Memo/祖先影响判定、删除正在打开的 Canvas 只导航不 flush，及有/无下一 Memo 的路由选择
useMemoNodeDeletion.ts: 软删编排 Hook；沿用调用方共享的 mutating 门禁，删除前对 memo 会话做 required flush、成功后清理正文缓存与 last-memo 记录并按落点导航，失败恢复编辑会话且不改变任何状态
useOptimisticMemoCreation.ts: 人工新建路由协调器；同步进入临时备忘录并独立跟踪每个并发提交，乱序成功只替换自己的 ID，失败只撤销对应节点并在仍处当前页时回退
useMemoDocumentLoad.ts: 当前笔记正文请求生命周期边界；目录 ready 后只为未缓存的选中 ID 发起单篇读取，并可复用已在途的意图预取，失败统一送入 Toast
useMemoDocumentPreload.ts: 正文按需架构的空闲预热 Hook；只预取当前笔记阅读顺序相邻的前后两篇，点击/键盘意图预热仍由文件树触发，不扩大目录载荷
useAccountProfileRefresh.ts: 账户资料生命周期协调器；每次打开只后台刷新一次并保留现有资料，栏目切换不重复请求
useMemoOrganize.ts: AI 整理生命周期协调器；发送前 required flush，按用户恢复最近 Run，编排 plan/apply/reject/undo，并把成功或撤销结果局部归并到 Memo Store、把 stale 诚实反馈给用户
useMemoOrganize.test.ts: 锁定 succeeded/undone 唤醒文件库与成功/撤销目标快照、awaiting_confirmation 唤醒 AI、stale/failed/过程态不强迫打开工具
useMemoCanvasEntry.ts: memo↔默认 Canvas 路由协调器；真实点击后先 required flush，再依次取得默认 Canvas 身份与完整 detail，等待期间保留原 Paper；detail 写入对应一次性 bootstrap 后才由 navigate 带 viewTransition 导航，失败则留在原页恢复入口状态。返回画布复用同一 memo 纸面名字，且同样先预取 detail 再导航——否则卡片要等画布自己请求完才出现在 DOM 里，浏览器拍新截图时落点那张纸还不存在，整段就只剩硬切；预取失败退回普通跳转，返回本身不被动画绑架
useStandaloneCanvasCreation.ts: standalone Canvas 创建协调器；重复提交门禁后只接受服务器事务返回的真实身份，再局部并入 tree、登记 standalone 进入语境并导航
canvasIncrementalLayout.ts: Canvas 候选增量布局纯策略；复用既有分支向外生长并以确定性角度/半径寻找无碰撞位置，人工加入和 AI expansion 共用且永不移动旧节点
canvasIncrementalLayout.test.ts: 锁定候选稳定排序、分支外向生长、无碰撞与旧节点对象/坐标不变
canvasEntryBootstrap.ts: Paper→Canvas 的短命数据交接边界；按 canvasId/userId/token 暂存已经取得的 Canvas detail，30s 后自动失效且只允许对应 Coordinator 消费一次，不持久化也不替代后续重取
canvasEntryBootstrap.test.ts: 锁定 bootstrap 的 canvasId/userId/token/TTL 隔离、一次消费与命中时零重复 getCanvas
canvasPresentation.ts: Canvas V2 图投影纯决策；把服务端 memo_ref/native/墓碑、尺寸、text_scale、关系与 user_moved 视口翻译成 React Flow 数据，允许 UI-only motionState 装饰节点/边但不进入持久文档；按 ID/字段保留未变化对象身份与拖动中瞬时坐标，并集中提供可用视口、成组外接框和手势级坐标回写判据
canvasPresentation.test.ts: 锁定 memo 快照/墓碑/native 空间文字尺寸与 text_scale、未变化节点/无关 Cord 的对象身份、拖动中瞬时坐标保护、revision 漂移、视口钳制、用户视口恢复与跨设备可用性判据、成组外接框的出现时机与并集矩形（框选途中一张即成框、静止单选不成框、自带框在场即让位）、整组坐标回写与 V2 路由识别
organizePresentation.ts: 整理 Run 到 Workspace 工具唤醒及归档展示快照的无副作用策略；成功使用服务端目标路径，撤销使用当前树恢复路径
workspaceLayout.ts: Paper First 浮层几何与宽度持久化边界，集中维护文件库/AI 尺寸约束、CSS 变量类型和 localStorage 校验
viewTransition.ts: 同文档过渡唯一入口，也是纸面命名的唯一真相。卡片↔预览、笔记↔画布、预览↔写作区都只是「把这次 DOM 更新包进一次视图过渡」，截图/变形/交叉淡换全归浏览器；手写那条路要逐项复刻落点的圆角形状、字形抗锯齿、阴影缩放与容器查询字号，那张清单没有尽头。一次手势里只有两个名字：纸壳 paper-<memo> 与纸内正文 paper-body-<memo>——分开是因为壳是纯色圆角矩形拉伸看不出来，而位图化的字一放大就是「字在膨胀」。除此之外任何元素都不许命名：过渡层的兄弟顺序由被捕获的先后决定，与 z-index、DOM 嵌套无关，只在新状态出现的名字一律排到最后，因此一层自带名字的全屏遮罩会稳稳盖住那张正在放大的纸——用户看到的是一整段空白然后结果「跳」出来。名字同时只能属于一个元素，所以卡片/预览/写作区三处永不共存。它只服务纯本地 DOM 更新（配 flushSync 保证新截图拍到的是新 DOM），跨路由三条归 React Router 的 viewTransition：导航是异步的，在外面包一层只会拍到还没换的旧页面。四种方向写进 html[data-paper-transition]，节奏由 CSS 解释
workspaceMotion.ts: 工作台唯一 Motion Language，集中提供 90ms press、160/130ms micro、220/170ms Panel Tween、spatial spring 与 32ms/128ms 有界 stagger；纸张在两处之间的放大缩小归浏览器，这里不再持有任何飞行规格
workspaceMotion.test.ts: 锁定唯一语义时长/spring/stagger 与纸面过渡规矩——承载正文的表面零过冲（控制点 ≤ 1）、纸壳等比取景（cover，非等比会把圆角拉成椭圆）、纸内正文永不缩放只被 image-pair 取景框裁切（object-fit: none + overflow: clip）、两端排版的交接严格互补（浏览器用 plus-lighter 混合，不互补就发灰或叠字）、四个方向的世界都不长于纸的形变、当前 300ms/240ms 曲线保持不变、预览→编辑区与编辑区→Canvas 都必须由路由纸面通道接管、入口 bootstrap 在单次 Canvas 挂载内保持不可变、只有纸与纸内正文拥有过渡身份；另锁画布会话的 deps 只认 (登录用户, 画布)，防止上层记录一次返回描述就 reset Store 并让预览在取景前消失；并跨 Canvas/Panel/Dialog/Cord 样式证明 reduced-motion 只保留 90ms 淡入

职责: 页面层，承载 URL 级 Landing、OAuth 回调、受保护 Dashboard 与不进入生产状态的开发态视觉决策边界；Paper/Canvas 路由编排与 Canvas 增量布局/投影以协调 Hook 和纯函数收口，组件只消费结果。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
