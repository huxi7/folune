# app/src/widgets/KnowledgeCanvas/
> L2 | 父级: ../CLAUDE.md

成员清单
CLAUDE.md: 记录 Canvas V2 交互子域成员、职责边界与 GEB 回环协议
KnowledgeCanvas.tsx: Canvas V2 会话内容根；始终挂载受控 React Flow，协调空间文字、连接/移除、拖拽/缩放、Preview、显式 AI 增量拓展与保存状态，不设节点硬上限。移除前从最新文档冻结节点及全部关联边：普通节点/关系以本地 Button Toast 给出十秒局部撤销并原样重放身份、坐标、首次来源、边 ID 与理由；多选 Delete 的全部 remove_node 进入同一 enqueueMany，撤销也以一次原子 intent 组恢复；memo_default 来源身份只消费 canvasDocument 的 isCanvasOriginNode，卡片操作行与 Delete/Backspace 都进入唯一 requestNodeRemoval 守门，后续右键等移除入口也只能复用这条命令；本地 Dialog 解释原笔记无损、永久转独立与二次 Canvas 风险，确认前绝不入队，Esc 只关闭最内层确认。含来源的混合批量仍原子移除，只以「撤销普通节点」恢复不依赖已解除来源的普通节点与关系；来源转换回执永不提供假撤销；target_node_id 为空的永久删除墓碑只给不可撤销回执。键盘加速器在此收口：Enter 预览、Delete 移除、Escape 逐层收束、⌘E 从选中节点拓展（无选择只给轻提示，绝不发请求），全部先让路给输入框与自由文字编辑态，已有自由文字清空后复用 remove_node intent 删除而新建空白仍仅取消，并把「加入当前画布」登记给全局 Command Palette 而不自持第二套 Picker；连接进行中加入一张已在画布上的笔记时，来源与目标一起重新取景，否则关系建好了却在屏幕外（宪法 §10 要求这条流程里来源清楚可见）。选择与几何在此彻底分家：节点几何只跟随文档，选择只有 React Flow 一个所有者、canvasWorkspaceStore 只是它的镜像，程序化改选择一律经 selectOnly 写进它的节点；入口聚焦节点是唯一一次外部写入，每张画布只交一次。一次拖拽手势的整组最终坐标经 enqueueMany 原子回写，抓卡片拖和抓成组框拖都走这一条
CanvasCardNode.tsx: 280x360 纵向 memo_ref 笔记卡与无表面的 native 空间文字节点；关系 Handle 只登记身份，真实端点交给 CanvasCordEdge；自由文字测量显式消费持久化基础 width/height，编辑态稳定聚焦，点出后经统一提交函数保存并按 text_scale 四角缩放
CanvasCardNode.test.tsx: 卡片结构回归门禁，锁定中心重合关系注册 Handle、嵌套纸张骨架、常驻展开入口，以及普通/墓碑/回收站都只向会话层发出唯一移除命令，恢复与来源确认不得泄漏进卡片表现层
CanvasTitle.tsx: Canvas 顶层安静标题；两种画布共用同一改名分支，只在 draft 从空进入编辑态时聚焦并全选，敲字本身不重复抢焦点；来源语义仍归 memo_ref 卡片
CanvasControls.tsx: React Flow 底部中央无状态命令条，提供加入、fit、缩放与操作说明，不读写图数据
CanvasPersistenceStatus.tsx: 显示保存、恢复、冲突和显式重试状态，只解释协调器事实，不参与排队
CanvasPreviewOverlay.tsx: 不卸载 Canvas 的小开本 Paper 预览层；用户明确预览时才按 ID 发一次正文请求，status 是该 effect 的结果而非重启条件，避免 loading 切换立即 cleanup/abort；Dialog/NotePaper 继续拥有模态与纸面职责
CanvasPreviewOverlay.test.tsx: 预览结构回归门禁，锁定 bare 表面、单一 reader 纸，以及关闭/编辑原文一律不在纸内
CanvasSelectionBounds.tsx: 成组外接框；只在 React Flow 自带 NodesSelection 缺席的两段时间出现——框选拖动中，以及多选静止但它已放手（抓住组里任意卡片就会让它消失）——与它共用同一条变换公式和同一个 --canvas-selection-line，因此松手只是换主人，框不移动也不闪。纯视觉、不接收指针，矩形判据住在 canvasPresentation
CanvasCordEdge.tsx: 关系交互层；CanvasCordEdge 通过 useInternalNode 持续读取两张卡片的绝对矩形，以中心射线求随拖拽换边的浮动端点并复用 Cord Signature 的 radial 弯度律，memo_ref 另外带上与 .canvas-card 一致的 16px 圆角（native 空间文字没有表面故不带），使端点不再落在被圆角削掉的尖角上悬空，CanvasEdgeReasonInspector 在曲线中点常驻安静查看圆点。线本身就是理由的指向面：18px 宽命中区接管整线 hover，指针移向中点标记时不熄灭（交接不闪），中点标记只是它常驻可见的把手与键盘入口；人工/AI 来源分别标注，整线 hover、中点 hover、选中、点击保持与键盘聚焦均可完整查看理由及删除关系
CanvasCordEdge.test.ts: 浮动端点纯几何回归门禁，锁定目标跨象限拖动时端点从左右边切换到上下边、轴向对齐取直而对角线两个控制点分居弦两侧（S）、卡片朝对角方向的端点收进圆角弧上，并覆盖节点尚未测量时的安全兜底
canvasActions.tsx: Preview、AI、连接、自由文字编辑/缩放和移除的稳定 Context 通道，使 React Flow data 保持纯可序列化事实
spatialTextGeometry.ts: 空间文字宽高、内容基准尺寸与 text_scale（0.25–8）的约束及等比缩放纯函数，隔离对象自身缩放和 Canvas viewport zoom
spatialTextGeometry.test.ts: 空间文字几何不变量测试，覆盖基准边界、拖拽等比换算和缩放上下限
KnowledgeCanvas.interaction.test.tsx: 真实组件纵向交互测试；覆盖普通节点移除后原子恢复身份/首次来源/坐标/关系理由、Delete 多选单 WAL/单 mutation、墓碑无假撤销、来源卡片取消零入队/确认无假撤销、含来源批量确认与 Esc 不穿透选择，以及 Pane 双击、textarea 提交/再次编辑/清空删除、四角边界、入口聚焦选择稳定、多选成框、关系理由键盘查看和空白/Esc 取消；浮动端点几何由 CanvasCordEdge.test.ts 单独锁定，成框判据与整组坐标回写由 canvasPresentation.test.ts 单独锁定
useCanvasSessionCoordinator.ts: 读取 Canvas、建立 Store 会话、恢复 IndexedDB WAL、注册 pagehide 与 flush 控制的基础设施 Hook，隔离网络/计时器和交互组件
index.ts: 模块稳定出口，隔离 WorkspaceAuxViews 与内部文件布局

职责: Canvas V2 交互空间，只能由 CanvasWorkspace 承载；服务端图不含 content_mdx，memo 正文按需预览，native 空间文字才归 Canvas，静止时无卡片表面且自身 text_scale 随对象持久化。memo_ref 的固定纵向尺寸只来自 canvasPresentation 常量，native 的宽高与 text_scale 是用户数据，卡片改版永不写入或覆盖它们。组件只产生 intent，人工与 AI 都经 WAL/Coordinator/统一 mutation；旧节点不因增量拓展重排，失败必须显式保留可恢复状态。选择的所有权不可再分：几何推导禁止读选择，选择推导禁止写几何，一次手势的整组坐标必须整组回写。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
