# app/src/widgets/KnowledgeCanvas/
> L2 | 父级: ../CLAUDE.md

成员清单
CLAUDE.md: 记录 Canvas V2 交互子域成员、职责边界与 GEB 回环协议
KnowledgeCanvas.tsx: Canvas V2 会话内容根；始终挂载受控 React Flow，协调空间文字、memo Picker、连接/删除、拖拽/缩放、Preview、显式 AI 增量拓展与保存状态，所有人工/AI 操作只产生 intent 进入同一协调器
CanvasCardNode.tsx: memo_ref 三态卡片与无表面的 native 空间文字节点；memo 正文只经 Preview 按 ID 读取，自由文字以自身 text_scale 和紧贴内容的四角边界在 Canvas 内编辑
CanvasControls.tsx: React Flow 右上角无状态命令条，提供加入、fit、缩放与操作说明，不读写图数据
CanvasMemoPicker.tsx: 全局 Cmd/Ctrl+K Canvas memo Picker；复用 tree/正文搜索，Enter 只打开对象，显式加号才加入/关联且永不把 canvas 当 memo
CanvasPersistenceStatus.tsx: 显示保存、恢复、冲突和显式重试状态，只解释协调器事实，不参与排队
CanvasPreviewOverlay.tsx: 不卸载 Canvas 的 Paper 预览层；用户明确预览时才从 memoDocumentStore 按 ID 读正文，“编辑原文”由外层 flush 后导航
CanvasCordEdge.tsx: 关系交互层；可见线复用 Cord Signature，宽命中区在 hover/选中时显示理由与删除入口
canvasActions.tsx: Preview、AI、连接、自由文字编辑/缩放和移除的稳定 Context 通道，使 React Flow data 保持纯可序列化事实
spatialTextGeometry.ts: 空间文字宽高、内容基准尺寸与 text_scale 的约束及等比缩放纯函数，隔离对象自身缩放和 Canvas viewport zoom
spatialTextGeometry.test.ts: 空间文字几何不变量测试，覆盖基准边界、拖拽等比换算和缩放上下限
useCanvasSessionCoordinator.ts: 读取 Canvas、建立 Store 会话、恢复 IndexedDB WAL、注册 pagehide 与 flush 控制的基础设施 Hook，隔离网络/计时器和交互组件
index.ts: 模块稳定出口，隔离 WorkspaceAuxViews 与内部文件布局

职责: Canvas V2 交互空间，只能由 CanvasWorkspace 承载；服务端图不含 content_mdx，memo 正文按需预览，native 空间文字才归 Canvas，静止时无卡片表面且自身 text_scale 随对象持久化。组件只产生 intent，人工与 AI 都经 WAL/Coordinator/统一 mutation；旧节点不因增量拓展重排，失败必须显式保留可恢复状态。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
