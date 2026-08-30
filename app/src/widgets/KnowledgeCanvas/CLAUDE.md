# app/src/widgets/KnowledgeCanvas/
> L2 | 父级: ../CLAUDE.md

成员清单
CLAUDE.md: 记录 Canvas V2 交互子域成员、职责边界与 GEB 回环协议
KnowledgeCanvas.tsx: Canvas 会话内容根；始终挂载受控 React Flow，服务端快照经 canvasPresentation 增量对账后只替换真实变化的节点/边，AI 拓展用 Store 快照作全局并发门禁且把提示隔离为独立订阅，动作 Context 不随 loading 改变；文件树 memo 按屏幕落点转换坐标并复用 add_memo/WAL，延迟显示真实比例占位；选择归 React Flow、Store 只镜像，图修改经统一协调器，Card→Preview 只为当前节点启动原生空间过渡；移除/撤销、空间文字、连接、AI 拓展与键盘收束沿既有唯一命令路径
CanvasCardNode.tsx: memo 化的 280x360 memo_ref 卡与 native 空间文字；动作 Context 只含稳定命令，编辑状态按节点 ID 订阅，AI 状态选择器只让本次源卡片从 false 变 true，避免一次选择或拓展重渲染所有卡片
CanvasCardNode.test.tsx: 卡片结构回归门禁，锁定中心重合关系注册 Handle、嵌套纸张骨架、常驻展开入口、源卡片 AI 忙碌选择器，以及普通/墓碑/回收站都只向会话层发出唯一移除命令，恢复与来源确认不得泄漏进卡片表现层
CanvasTitle.tsx: Canvas 顶层安静标题；两种画布共用同一改名分支，只在 draft 从空进入编辑态时聚焦并全选，敲字本身不重复抢焦点；来源语义仍归 memo_ref 卡片
CanvasControls.tsx: React Flow 底部中央无状态命令条，提供加入、fit、缩放与操作说明，不读写图数据
CanvasPersistenceStatus.tsx: 显示保存、恢复、冲突和显式重试状态，只解释协调器事实，不参与排队
CanvasPreviewOverlay.tsx: 不卸载 Canvas 的小开本 Paper 预览层；按 ID 读取正文，并与来源卡片共享唯一 View Transition 视觉身份
CanvasPreviewOverlay.test.tsx: 预览结构回归门禁，锁定 bare 表面、单一 reader 纸，以及关闭/编辑原文一律不在纸内
CanvasSelectionBounds.tsx: 成组外接框；只在 React Flow 自带 NodesSelection 缺席的两段时间出现——框选拖动中，以及多选静止但它已放手（抓住组里任意卡片就会让它消失）——与它共用同一条变换公式和同一个 --canvas-selection-line，因此松手只是换主人，框不移动也不闪。纯视觉、不接收指针，矩形判据住在 canvasPresentation
CanvasCordEdge.tsx: 关系交互层；CanvasCordEdge 通过 useInternalNode 持续读取两张卡片的绝对矩形，以中心射线求随拖拽换边的浮动端点并复用 Cord Signature 的 radial 弯度律，memo_ref 另外带上与 .canvas-card 一致的 16px 圆角（native 空间文字没有表面故不带），使端点不再落在被圆角削掉的尖角上悬空，CanvasEdgeReasonInspector 在曲线中点常驻安静查看圆点。线本身就是理由的指向面：18px 宽命中区接管整线 hover，指针移向中点标记时不熄灭（交接不闪），中点标记只是它常驻可见的把手与键盘入口；人工/AI 来源分别标注，整线 hover、中点 hover、选中、点击保持与键盘聚焦均可完整查看理由及删除关系
CanvasCordEdge.test.ts: 浮动端点纯几何回归门禁，锁定目标跨象限拖动时端点从左右边切换到上下边、轴向对齐取直而对角线两个控制点分居弦两侧（S）、卡片朝对角方向的端点收进圆角弧上，并覆盖节点尚未测量时的安全兜底
canvasActions.tsx: 只传递 Preview、AI、连接、文字编辑/缩放和移除命令的稳定 Context；选择、编辑中 ID 与 AI 状态不得进入 Context 放大节点重渲染
canvasPreviewTransition.ts: Card/Preview 共享的 CSS custom-ident 命名器，只建立视觉身份，不持有预览状态
spatialTextGeometry.ts: 空间文字宽高、内容基准尺寸与 text_scale（0.25–8）的约束及等比缩放纯函数，隔离对象自身缩放和 Canvas viewport zoom
spatialTextGeometry.test.ts: 空间文字几何不变量测试，覆盖基准边界、拖拽等比换算和缩放上下限
KnowledgeCanvas.interaction.test.tsx: 真实组件纵向交互测试；覆盖文件树拖入到 add_memo/WAL、移除/撤销、来源确认、Pane 双击、空间文字、多选成框、关系与 Esc 收束
useCanvasSessionCoordinator.ts: 读取 Canvas、建立 Store 会话、恢复 IndexedDB WAL、注册 pagehide 与 flush 控制的基础设施 Hook，隔离网络/计时器和交互组件
index.ts: 模块稳定出口，隔离 WorkspaceAuxViews 与内部文件布局

职责: Canvas V2 交互空间，只能由 CanvasWorkspace 承载；服务端图不含 content_mdx，memo 正文按需预览，native 空间文字才归 Canvas，静止时无卡片表面且自身 text_scale 随对象持久化。memo_ref 的固定纵向尺寸只来自 canvasPresentation 常量，native 的宽高与 text_scale 是用户数据，卡片改版永不写入或覆盖它们。组件只产生 intent，人工与 AI 都经 WAL/Coordinator/统一 mutation；旧节点不因增量拓展重排，失败必须显式保留可恢复状态。选择的所有权不可再分：几何推导禁止读选择，选择推导禁止写几何，一次手势的整组坐标必须整组回写。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
