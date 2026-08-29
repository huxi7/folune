# app/src/widgets/KnowledgeCanvas/
> L2 | 父级: ../CLAUDE.md

成员清单
CLAUDE.md: 记录 Canvas V2 交互子域成员、职责边界与 GEB 回环协议
KnowledgeCanvas.tsx: Canvas V2 会话内容根；始终挂载受控 React Flow，协调空间文字、连接/删除、拖拽/缩放、Preview、显式 AI 增量拓展与保存状态。键盘加速器在此收口：Enter 预览、Delete 移除、Escape 逐层收束、⌘E 从选中节点拓展（无选择只给轻提示，绝不发请求），全部先让路给输入框与自由文字编辑态，已有自由文字清空后复用 remove_node intent 删除而新建空白仍仅取消，并把「加入当前画布」登记给全局 Command Palette 而不自持第二套 Picker；连接进行中加入一张已在画布上的笔记时，来源与目标一起重新取景，否则关系建好了却在屏幕外（宪法 §10 要求这条流程里来源清楚可见）。选择与几何在此彻底分家：节点几何只跟随文档，选择只有 React Flow 一个所有者、canvasWorkspaceStore 只是它的镜像，程序化改选择一律经 selectOnly 写进它的节点；入口聚焦节点是唯一一次外部写入，每张画布只交一次。一次拖拽手势的整组最终坐标经 enqueueMany 原子回写，抓卡片拖和抓成组框拖都走这一条
CanvasCardNode.tsx: 280x360 纵向 memo_ref 笔记卡与无表面的 native 空间文字节点；source/target Handle 只登记关系身份，真实端点交给 CanvasCordEdge 读取节点矩形求解；卡片内嵌共享 NotePaper thumbnail、只读快照标题/摘录并以连续透明度与失焦渐隐过渡到固定高度元信息行，展开与上下文操作常驻 DOM 只靠透明度浮现；自由文字编辑态稳定聚焦且完全无边框，点出后经同一提交函数保存，选中才以等距紧贴内容的四角边界按 text_scale 缩放
CanvasCardNode.test.tsx: 卡片结构回归门禁，锁定中心重合关系注册 Handle、嵌套纸张骨架、常驻展开入口、空/超长/墓碑/回收站/漂移五种数据下骨架逐字一致
CanvasTitle.tsx: Canvas 顶层安静标题；两种画布共用同一个可改名分支，零特例，长标题截断并以 tooltip 给出全名。回到来源笔记不在这里——它是画布上那张 memo_ref 卡片的职责，摘掉那张卡片画布就自动转为 standalone
CanvasControls.tsx: React Flow 底部中央无状态命令条，提供加入、fit、缩放与操作说明，不读写图数据
CanvasPersistenceStatus.tsx: 显示保存、恢复、冲突和显式重试状态，只解释协调器事实，不参与排队
CanvasPreviewOverlay.tsx: 不卸载 Canvas 的小开本 Paper 预览层；复用 Dialog bare 表面获得 Esc/遮罩/滚动锁定/焦点归还，中央只出现一张比写作区更小、以均匀柔影悬浮的 NotePaper reader，纸内只有正文；关闭与“编辑原文”住在与纸顶右角对齐的纸外 32px 圆形工具列（窄屏 44px 横排），因此正文再长也不会把任何入口推出视野；用户明确预览时才按 ID 读正文，“编辑原文”由外层 flush 后导航
CanvasPreviewOverlay.test.tsx: 预览结构回归门禁，锁定 bare 表面、单一 reader 纸，以及关闭/编辑原文一律不在纸内
CanvasSelectionBounds.tsx: 成组外接框；只在 React Flow 自带 NodesSelection 缺席的两段时间出现——框选拖动中，以及多选静止但它已放手（抓住组里任意卡片就会让它消失）——与它共用同一条变换公式和同一个 --canvas-selection-line，因此松手只是换主人，框不移动也不闪。纯视觉、不接收指针，矩形判据住在 canvasPresentation
CanvasCordEdge.tsx: 关系交互层；CanvasCordEdge 通过 useInternalNode 持续读取两张卡片的绝对矩形，以中心射线求随拖拽换边的浮动端点并复用 Cord Signature 的 radial 弯度律，memo_ref 另外带上与 .canvas-card 一致的 16px 圆角（native 空间文字没有表面故不带），使端点不再落在被圆角削掉的尖角上悬空，CanvasEdgeReasonInspector 在曲线中点常驻安静查看圆点。线本身就是理由的指向面：18px 宽命中区接管整线 hover，指针移向中点标记时不熄灭（交接不闪），中点标记只是它常驻可见的把手与键盘入口；人工/AI 来源分别标注，整线 hover、中点 hover、选中、点击保持与键盘聚焦均可完整查看理由及删除关系
CanvasCordEdge.test.ts: 浮动端点纯几何回归门禁，锁定目标跨象限拖动时端点从左右边切换到上下边、轴向对齐取直而对角线两个控制点分居弦两侧（S）、卡片朝对角方向的端点收进圆角弧上，并覆盖节点尚未测量时的安全兜底
canvasActions.tsx: Preview、AI、连接、自由文字编辑/缩放和移除的稳定 Context 通道，使 React Flow data 保持纯可序列化事实
spatialTextGeometry.ts: 空间文字宽高、内容基准尺寸与 text_scale（0.25–8）的约束及等比缩放纯函数，隔离对象自身缩放和 Canvas viewport zoom
spatialTextGeometry.test.ts: 空间文字几何不变量测试，覆盖基准边界、拖拽等比换算和缩放上下限
KnowledgeCanvas.interaction.test.tsx: 真实组件纵向交互测试；覆盖 Pane 双击、textarea 聚焦/点出提交、WAL/协调器/mutation、再次编辑、已有文字清空删除、四角边界、带聚焦节点进入后选择静止在同一答案（选择两个所有者互为输入时这里会直接抛 Maximum update depth exceeded）、多选立刻成框且不与自带框并存、关系注册与理由的键盘/保持查看，以及新建空白/Esc 取消；浮动端点几何由 CanvasCordEdge.test.ts 单独锁定，成框判据与整组坐标回写由 canvasPresentation.test.ts 单独锁定
useCanvasSessionCoordinator.ts: 读取 Canvas、建立 Store 会话、恢复 IndexedDB WAL、注册 pagehide 与 flush 控制的基础设施 Hook，隔离网络/计时器和交互组件
index.ts: 模块稳定出口，隔离 WorkspaceAuxViews 与内部文件布局

职责: Canvas V2 交互空间，只能由 CanvasWorkspace 承载；服务端图不含 content_mdx，memo 正文按需预览，native 空间文字才归 Canvas，静止时无卡片表面且自身 text_scale 随对象持久化。memo_ref 的固定纵向尺寸只来自 canvasPresentation 常量，native 的宽高与 text_scale 是用户数据，卡片改版永不写入或覆盖它们。组件只产生 intent，人工与 AI 都经 WAL/Coordinator/统一 mutation；旧节点不因增量拓展重排，失败必须显式保留可恢复状态。选择的所有权不可再分：几何推导禁止读选择，选择推导禁止写几何，一次手势的整组坐标必须整组回写。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
