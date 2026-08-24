# app/src/widgets/KnowledgeCanvas/
> L2 | 父级: ../CLAUDE.md

成员清单
KnowledgeCanvas.tsx: 已保存画布内容根；在 CanvasWorkspace 的确定全屏尺寸内读取画布，仅恢复带 user_moved 标记的真实用户视口，首次或旧版污染视口重新 fit 全图；程序化移动不落库，真实拖拽与平移合并成一次防抖布局回写。它协调卡片晋升并把新笔记就地并入文件树；刻意不开 `onlyRenderVisibleElements`，nodeTypes/edgeTypes 提到模块级以免每次渲染重建节点
CanvasCardNode.tsx: 只读卡片节点；引用卡片只提供「打开这一篇」，摘录/原生卡片提供「成为笔记」，正文限高并渐隐——卡片永不原地展开，因为展开等于把画布变成第二个编辑器，而正文只有一个家
CanvasCordEdge.tsx: 连线适配层，把 React Flow 给的端点坐标包成零尺寸盒交给共享 Cord；画布态与探索态因此是同一条 Signature，实线代表已写入关系表。理由用 EdgeLabelRenderer 落在弦的中点，与线同时可见而不是 hover 才出现
canvasActions.tsx: 跳转与晋升两个命令的 Context 通道；回调塞进 node data 会让每次 setState 重建全部节点，故与数据分离
index.ts: 模块稳定出口，隔离 WorkspaceAuxViews 与内部文件布局

职责: 已保存画布的只读空间内容，只能由独立全屏 CanvasWorkspace 承载；此处允许 pan/zoom 与极淡点阵，因为没有活编辑器。画布只持有卡片自己的文字与被引用笔记的标题/摘要，永不持有 content_mdx；坐标与视口的持久化是安静的，失败不打断阅读。嵌套深度恒为 1——卡片只跳转，不展开。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
