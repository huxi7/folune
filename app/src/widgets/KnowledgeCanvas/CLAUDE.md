# app/src/widgets/KnowledgeCanvas/
> L2 | 父级: ../CLAUDE.md

成员清单
CLAUDE.md: 记录 Canvas V2 交互子域成员、职责边界与 GEB 回环协议
KnowledgeCanvas.tsx: Canvas V2 会话内容根；始终挂载受控 React Flow，协调空间文字、连接/删除、拖拽/缩放、Preview、显式 AI 增量拓展与保存状态，已有自由文字清空后复用 remove_node intent 删除而新建空白仍仅取消，并把「加入当前画布」登记给全局 Command Palette 而不自持第二套 Picker
CanvasCardNode.tsx: 280x360 纵向 memo_ref 笔记卡与无表面的 native 空间文字节点；卡片内嵌共享 NotePaper thumbnail、只读快照标题/摘录并以渐隐过渡到固定高度元信息行，展开与上下文操作常驻 DOM 只靠透明度浮现；自由文字编辑态稳定聚焦且完全无边框，点出后经同一提交函数保存，选中才以等距紧贴内容的四角边界按 text_scale 缩放
CanvasCardNode.test.tsx: 卡片结构回归门禁，锁定嵌套纸张骨架、常驻展开入口、空/超长/墓碑/回收站/漂移五种数据下骨架逐字一致
CanvasTitle.tsx: Canvas 顶层安静标题；默认 Canvas 的标题只读跟随来源笔记，并且它本身就是回到原文的入口，独立 Canvas 才能在此原地重命名，长标题截断并以 tooltip 给出全名
CanvasControls.tsx: React Flow 底部中央无状态命令条，提供加入、fit、缩放与操作说明，不读写图数据
CanvasPersistenceStatus.tsx: 显示保存、恢复、冲突和显式重试状态，只解释协调器事实，不参与排队
CanvasPreviewOverlay.tsx: 不卸载 Canvas 的小开本 Paper 预览层；复用 Dialog bare 表面获得 Esc/遮罩/滚动锁定/焦点归还，中央只出现一张比写作区更小、以均匀柔影悬浮的 NotePaper reader，纸内只有正文；关闭与“编辑原文”住在与纸顶右角对齐的纸外 32px 圆形工具列（窄屏 44px 横排），因此正文再长也不会把任何入口推出视野；用户明确预览时才按 ID 读正文，“编辑原文”由外层 flush 后导航
CanvasPreviewOverlay.test.tsx: 预览结构回归门禁，锁定 bare 表面、单一 reader 纸，以及关闭/编辑原文一律不在纸内
CanvasCordEdge.tsx: 关系交互层；可见线复用 Cord Signature，宽命中区在 hover/选中时显示理由与删除入口
canvasActions.tsx: Preview、AI、连接、自由文字编辑/缩放和移除的稳定 Context 通道，使 React Flow data 保持纯可序列化事实
spatialTextGeometry.ts: 空间文字宽高、内容基准尺寸与 text_scale（0.25–8）的约束及等比缩放纯函数，隔离对象自身缩放和 Canvas viewport zoom
spatialTextGeometry.test.ts: 空间文字几何不变量测试，覆盖基准边界、拖拽等比换算和缩放上下限
KnowledgeCanvas.interaction.test.tsx: 真实组件纵向交互测试；覆盖 Pane 双击、textarea 聚焦/点出提交、WAL/协调器/mutation、再次编辑、已有文字清空删除、四角边界与新建空白/Esc 取消
useCanvasSessionCoordinator.ts: 读取 Canvas、建立 Store 会话、恢复 IndexedDB WAL、注册 pagehide 与 flush 控制的基础设施 Hook，隔离网络/计时器和交互组件
index.ts: 模块稳定出口，隔离 WorkspaceAuxViews 与内部文件布局

职责: Canvas V2 交互空间，只能由 CanvasWorkspace 承载；服务端图不含 content_mdx，memo 正文按需预览，native 空间文字才归 Canvas，静止时无卡片表面且自身 text_scale 随对象持久化。memo_ref 的固定纵向尺寸只来自 canvasPresentation 常量，native 的宽高与 text_scale 是用户数据，卡片改版永不写入或覆盖它们。组件只产生 intent，人工与 AI 都经 WAL/Coordinator/统一 mutation；旧节点不因增量拓展重排，失败必须显式保留可恢复状态。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
