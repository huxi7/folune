# app/src/widgets/KnowledgeCanvas/
> L2 | 父级: ../CLAUDE.md

成员清单
CLAUDE.md: 记录 Canvas V2 交互子域成员、职责边界与 GEB 回环协议
KnowledgeCanvas.tsx: Canvas 会话内容根；始终挂载受控 React Flow，bootstrap/网络加载、选择、视口、WAL 与 mutation 仍沿原系统；只有本地进入/新增/连接/AI 手势签发一次性 motion receipt，Card→Preview 是一次纯本地 DOM 更新，因此由它自己包一次视图过渡并交出方向（收起比展开更短）；离开画布只发出跳转意图，那次过渡归持有 navigate 的路由层。删除先捕获无身份屏幕快照再立即入 WAL，hydration/rebase/save/rerender 不签发动画
CanvasCardNode.tsx: memo 化的 280x360 memo_ref 卡与 native 空间文字；预览打开时把纸面身份让给预览那张纸（一个名字同时只能属于一个元素，让出去浏览器才认得出这是同一张纸），命名由 NotePaper 按稳定 target identity 完成而卡片只交出身份，不向外交出 DOM；本地新增只在卡片内部使用 spatialSpring 并让纸面先于正文落位，正文 hover/focus 只预取 memoDocumentStore，拖拽/resize 继续由 React Flow 1:1 接管
CanvasCardNode.test.tsx: 卡片结构回归门禁，锁定中心重合关系注册 Handle、嵌套纸张骨架、常驻展开入口、源卡片 AI 忙碌选择器，以及普通/墓碑/回收站都只向会话层发出唯一移除命令，恢复与来源确认不得泄漏进卡片表现层
CanvasTitle.tsx: Canvas 顶层安静标题；两种画布共用同一改名分支，只在 draft 从空进入编辑态时聚焦并全选，敲字本身不重复抢焦点；来源语义仍归 memo_ref 卡片
CanvasControls.tsx: React Flow 底部中央无状态命令条，提供加入、fit、缩放与操作说明，不读写图数据
CanvasPersistenceStatus.tsx: 显示保存、恢复、冲突和显式重试状态，只解释协调器事实，不参与排队
CanvasPreviewOverlay.tsx: 不卸载 Canvas 的小开本 Paper 预览层；按 ID 读取正文，正文在路上时纸里先放卡片那段摘录（同一篇笔记的开头，放大的始终是同一段字，一个字都没到才退回 Skeleton），reader 纸面由 NotePaper 命名壳与正文。Dialog 使用 motion=none 且遮罩绝不拥有过渡身份——它留在 root 那张截图里，磨砂玻璃因此完整可用（backdrop-filter 采样的就是同一次绘制里身后的画布），而给它单独命名会让它排到过渡层末尾、整段盖住正在放大的纸；纸内只有正文，关闭/编辑一律在纸外
CanvasPreviewOverlay.test.tsx: 预览结构回归门禁，锁定 motion=none bare 表面、单一 reader 纸，以及关闭/编辑原文一律不在纸内
CanvasSelectionBounds.tsx: 成组外接框；只在 React Flow 自带 NodesSelection 缺席的两段时间出现——框选拖动中，以及多选静止但它已放手（抓住组里任意卡片就会让它消失）——与它共用同一条变换公式和同一个 --canvas-selection-line，因此松手只是换主人，框不移动也不闪。纯视觉、不接收指针，矩形判据住在 canvasPresentation
CanvasCordEdge.tsx: 关系交互层；持续读取节点绝对矩形并以中心射线求浮动端点，复用 Cord Signature 的 radial 弯度与 receipt draw，UI-only edge motionState 只决定本地新关系的单次延后绘制；理由查看/删除与既有几何命中区不变
CanvasCordEdge.test.ts: 浮动端点纯几何回归门禁，锁定目标跨象限拖动时端点从左右边切换到上下边、轴向对齐取直而对角线两个控制点分居弦两侧（S）、卡片朝对角方向的端点收进圆角弧上，并覆盖节点尚未测量时的安全兜底
canvasActions.tsx: 只传递正文预取、Preview、AI、连接、文字编辑/缩放和移除命令的稳定 Context；选择、编辑中 ID 与 AI 状态不得进入 Context 放大节点重渲染
canvasMotionReceipts.ts: 本地手势的瞬时因果动效边界；生成 AI/人工/连接/Canvas 进入 receipt，按来源方向和有界 stagger 装饰 Flow UI data，并提供无真实节点身份的删除 DOM 快照——快照按布局尺寸排版再乘卡片自身 zoom，退场关键帧必须写进基准缩放，否则第一帧就胀回原始布局尺寸。入场编排只属于「第一次进来」：returning 为真时整条 canvas_entry 让路，因为返回时那张图一直在，重播入场只会让用户看着一片空白卡片自己填字，观感上世界被重建了一次；不得进入 API、WAL、数据库或 intent digest
canvasMotionReceipts.test.ts: 锁定来源确认、节点方向偏移、关系 draw、32ms/128ms 编排，以及特殊 node ID 查找、删除快照身份清理与按布局尺寸乘 zoom 的落位
spatialTextGeometry.ts: 空间文字宽高、内容基准尺寸与 text_scale（0.25–8）的约束及等比缩放纯函数，隔离对象自身缩放和 Canvas viewport zoom
spatialTextGeometry.test.ts: 空间文字几何不变量测试，覆盖基准边界、拖拽等比换算和缩放上下限
KnowledgeCanvas.interaction.test.tsx: 真实组件纵向交互测试；覆盖文件树拖入到 add_memo/WAL、移除/撤销、来源确认、Pane 双击、空间文字、多选成框、关系与 Esc 收束，并锁定左右 Panel 开合不重挂输入、不挪动选择与外接框、不提前入队
useCanvasSessionCoordinator.ts: Canvas 会话基础设施 Hook；优先一次消费 canvas/user/token 均匹配且未过期的 bootstrap detail，否则读取 Canvas，再建立 Store 会话、恢复 IndexedDB WAL、注册 pagehide 与 flush 控制。一次会话的身份只有 (登录用户, 这张画布)，别的东西一律不许结束它：进入语境（bootstrap/entryChrome/restore）与回调都走渲染期 latest ref，写进 deps 的代价是真实的——上层记录一次返回描述就会清理整条 effect，resetSession() 清空文档与预览、dispose() 掐掉正在飞的保存，用户看到的是「点了编辑原文，预览凭空消失，页面直接弹出来」。409/rebase 后续重取仍归 Coordinator，不重播首屏进入
index.ts: 模块稳定出口，隔离 WorkspaceAuxViews 与内部文件布局

职责: Canvas V2 交互空间，只能由 CanvasWorkspace 承载；服务端图不含 content_mdx，memo 正文按需预览，native 空间文字才归 Canvas，静止时无卡片表面且自身 text_scale 随对象持久化。memo_ref 的固定纵向尺寸只来自 canvasPresentation 常量，native 的宽高与 text_scale 是用户数据，卡片改版永不写入或覆盖它们。组件只产生 intent，人工与 AI 都经 WAL/Coordinator/统一 mutation；旧节点不因增量拓展重排，失败必须显式保留可恢复状态。选择的所有权不可再分：几何推导禁止读选择，选择推导禁止写几何，一次手势的整组坐标必须整组回写。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
