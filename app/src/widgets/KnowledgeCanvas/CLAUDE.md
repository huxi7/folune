# app/src/widgets/KnowledgeCanvas/
> L2 | 父级: ../CLAUDE.md

成员清单
CLAUDE.md: 记录 Canvas V2 交互子域成员、职责边界与 GEB 回环协议
KnowledgeCanvas.tsx: Canvas 会话内容根；禁用 React Flow 默认 deleteKeyCode，删除只进入既有 requestNodeRemoval 确认/回执协议，节点/关系撤销时长共用 Toast 的六秒默认值，弹层键盘事件不穿透画布；始终挂载受控 React Flow，bootstrap/网络加载、选择、视口、WAL 与 mutation 沿原系统；响应式视口校准以稳定 resize/ResizeObserver 读取 latest nodes，节点拖动不重建 observer且校准不写回持久 viewport；nodesConnectable 只向右下 source/整卡 target 开放，拖/点都委托 useCanvasConnectionSession，临时绳不进文档，合法结束只签发一次 motion receipt + upsert_edge。Card→Preview 仍是纯本地 DOM 视图过渡，删除仍先拍无身份快照再入 WAL，hydration/rebase/save/rerender 不签发动画 图投影按文档引用缓存并由首帧/更新共用，初始化 Flow 只建一次，拖拽与选择不会重复重建初始化图。
CanvasCardView.tsx: 显式输入交互状态的共享纯 UI，完整保留卡片/空间文字/纸面过渡，不导入业务 Store；生产与 Demo 共用
CanvasCardNode.tsx: memo 化的 280x360 memo_ref 卡与 native 空间文字；静态选中只读 React Flow；可用 memo_ref 把可聚焦 Grip source 放在元信息行最右端（宪法 10.3 的「柄只服从最不干扰」——挂在卡片右下角外的小凸起正是最干扰的那种，它破坏纸的完整轮廓；行尾槽位不暗示任何出线方向，且与两个内容动作严格等距——抓手不同族由点阵图标、grab 光标与 hover 变 primary 表达，用间距表达只会被读成没对齐），whole-card target 仍是会话期直接子元素。元信息状态只剩墓碑与回收站两种：两者都是「指向的东西不在库里了」，用户必须知道也有出路；曾经的第三条「原文已更新」比的是入画布那天的 revision 快照，而标题与摘录本来就读最新内容，因此它警告的不一致用户看不见，又因快照只在创建时写一次而永久消不掉。抓手拖拽时由 React Flow connectingfrom 隐藏；正式中心 Handle/CanvasCordEdge 浮动端点不变，正文 hover/focus 仍只预取 memoDocumentStore
CanvasSelectionBorder.tsx: 选中卡片的 Soft Ink 撕纸边装饰；3.5px 实色边缘通过三层噪声与 10px 位移及 0.35px 膨胀形成可见的不规则纸边，以 6 秒周期缓慢起伏。仅过滤原生 squircle 边缘；DS 动态偏好、离屏与后台门禁停掉 animate 但保留静态纸边，不持有选择、不测屏幕尺寸、不写画布状态或布局
ElectricBorder.LICENSE.md: React Bits Electric Border 参考实现的原始版权与 MIT + Commons Clause 许可
CanvasManipulationFeedback.tsx: Flow 内的单一按住手势观察器；按下卡片或已选组时只读 nodeLookup，把边缘 Portal 挂到实际参与搬动的卡片，释放/取消/失焦立即卸载；排除命令、连接、修饰键和 Space 平移，不改变选择与 WAL
CanvasManipulationFeedback.test.tsx: 真实 React Flow 下验证按下/释放、取消/失焦、多选共享、命令与平移排除，并确认视觉不改写静态选择
CanvasManipulationBorder.tsx: 按住期间的单向 Soft Ink 纸边；局部几何与 React Flow 缩放分离，单一帧循环写 SVG path，离屏/后台停绘、Reduced Motion 静态
manipulationBorderGeometry.ts: 按圆角/平滑轮廓采样双向同源边界，噪声随距离与时间连续向左上行进，端点收敛闭合
manipulationBorderGeometry.test.ts: 验证单向传播、双路端点、静态路径与窄尺寸有限值
CanvasCardNode.test.tsx: 卡片结构回归门禁，锁定两个正式中心 Handle、抓手必须落在元信息行之内且排在两个内容动作之后、整卡 target、嵌套纸张、常驻展开入口、AI 忙碌选择器、元信息只剩墓碑/回收站两种状态，以及墓碑/回收站绝不暴露连接命中面
CanvasTitle.tsx: Canvas 顶层安静标题；两种画布共用同一改名分支，只在 draft 从空进入编辑态时聚焦并全选，敲字本身不重复抢焦点；来源语义仍归 memo_ref 卡片
CanvasControls.tsx: React Flow 底部中央命令条，内容/视口动作保持两组同材质；操作说明 Dialog 常驻宿主以完成退出，不读取或修改图数据
CanvasControls.test.tsx: 底部命令形制回归测试，锁定一个 Panel、两个同材质 surface、加入动作只保留语义图标/可访问名称且无 Tonal 常驻底色，以及四个视口动作顺序
CanvasPersistenceStatus.tsx: 正常保存/排队/恢复静默，仅展示尚未同步、版本冲突或恢复异常；异常说明与重试位于工具条上方并保留可访问播报，只解释协调器事实，不参与排队
CanvasPreviewOverlay.tsx: 不卸载 Canvas 的小开本 Paper 预览层；按 ID 读取正文，正文在路上时纸里先放卡片那段摘录（同一篇笔记的开头，放大的始终是同一段字，一个字都没到才退回 Skeleton），reader 纸面由 NotePaper 命名壳与正文。Dialog 使用 motion=none 且遮罩绝不拥有过渡身份——它留在 root 那张截图里，磨砂玻璃因此完整可用（backdrop-filter 采样的就是同一次绘制里身后的画布），而给它单独命名会让它排到过渡层末尾、整段盖住正在放大的纸；纸内只有正文，关闭/编辑一律在纸外
CanvasPreviewOverlay.test.tsx: 预览结构回归门禁，锁定 motion=none bare 表面、单一 reader 纸，以及关闭/编辑原文一律不在纸内
CanvasSelectionBounds.tsx: 成组外接框；只在 React Flow 自带 NodesSelection 缺席的两段时间出现——框选拖动中，以及多选静止但它已放手（抓住组里任意卡片就会让它消失）——与它共用同一条变换公式和同一个 --canvas-selection-line，因此松手只是换主人，框不移动也不闪。纯视觉、不接收指针，矩形判据住在 canvasPresentation
CanvasCordEdge.tsx: 关系路径与理由说明，几何/receipt 仍沿原职责；理由 Popover 用 top placement 的 PresenceSurface 收放，CSS 独立 translate 保持几何居中，保持聚焦/指向/显式展开与删除意图。理由说明有**四条独立理由**可以撑开它——指针在把手上、键盘焦点在把手上、指针在关系线上（命中区 18px 宽，把手就长在它上面）、点一下钉住——因此消散必须一次收掉全部四条，否则"点旁边收起"会经常不生效：那一下落在线上，线的那条仍然成立。**焦点必须与悬浮分开成两个状态**：Escape 会把焦点归还给把手，若焦点直接算作"悬浮"，归还的那一刻它就自己重新打开，Escape 等于没按。线的那条用"压制"而非清空——清了它，指针仍在线上不会重新触发 enter，说明会一直不回来。消散走共享 `useDismissable`（外部 pointerdown + Escape + 焦点归还），与 Select/菜单同一条协议；Escape 分支的 preventDefault 同时是给 PaperWorkspaceShell 壳层守卫让行的仲裁
CanvasCordEdge.test.ts: 浮动端点纯几何回归门禁，锁定目标跨象限拖动时端点从左右边切换到上下边、轴向对齐取直而对角线两个控制点分居弦两侧（S）、卡片朝对角方向的端点收进圆角弧上，并覆盖节点尚未测量时的安全兜底
CanvasElasticConnectionLine.tsx: React Flow 拖拽期纯 UI 渲染层；起点取 fromX/fromY（React Flow 按 handleBounds 算出的抓手中心，因此绳子从被按住的那一点出来），终点取 connection.pointer 并用 viewport transform 反解回画布坐标 —— 绝不消费 toX/toY：本产品的 target handle 覆盖整张卡片，一旦吸附 React Flow 就把 to 换成那个 handle 的中心，线于是贯穿目标正文。吸附对提交是对的（它决定连给谁），对显示是错的（它决定线画到哪）。坐标写 latest ref，单一 rAF 只直接更新三条 path 与 drop cursor 属性，卸载立即取消，Reduced Motion 停相位但继续严格跟手
CanvasElasticConnectionLine.test.ts: 临时绳的坐标所有权门禁，锁定起点是抓手、终点是真实指针、cordAnchor 不再出现，toX/toY 只作 pointer 缺席时的兜底；珠子半径恒定且小，状态只由颜色表达
elasticCordGeometry.ts: 临时编织绳纯几何；两端都是手势本身（抓手落点与实时指针），不再对来源卡片求边界锚点——那是「已成立的关系属于整张卡片」的算法，属于 CanvasCordEdge。波形是基频叠加等幅三次谐波 `sin θ + sin 3θ`：一个周期读作「峰-中线-峰」接「谷-中线-谷」，即一个 M 紧跟一个 W，两个中间转角恰好落在中线上——这是它区别于纯正弦（一周期只有一峰一谷、过于规整）的那一眼。它是弹簧不是麻绳：圈数恒定 3 圈而波长由距离决定，拉长只是把同样这几圈抻开抻平，于是「卷着」与「被拉直」是同一根东西的两个状态；反过来钉死波长、拉长就多长几圈是麻绳（越拉越松越弯，与手上越拉越紧相反），而给圈数设上下限更糟——它会在某个距离上从「多长几圈」切成「波长变长」，同一次拖拽两种行为。三股相位速度各不相同（1 / 1.42 / 2.05，与 CSS 里由深到淡的透明度同序），因此相对位置一直在变，读作三根线真的在缠绕，同速只会得到三条永远平行的波。端点包络非对称：起点严格归零（抓手那头本就压在卡片底下），终点留 tailSpread 残余。绕珠的那点散开另由常量 tailFan 单独给出且与相位无关——波与股距两项都带相位，圈数取整数时尾端恰好回到起始相位、两项正好反向抵消，靠它们的残余就等于让「绕珠」碰运气，而相位 0 正是 Reduced Motion 固定停住的那一档。振幅/股距/线宽随距离单调收敛但都有下限，拉到再远也留着看得见的波浪，靠的是这个下限而不是多长几圈
elasticCordGeometry.test.ts: 临时绳数学门禁，覆盖三股同起点、终点在整段相位扫掠里都绕珠散开且仍贴着珠子（相位 0 单独钉死）、`sin θ + sin 3θ` 一周期六个极值且中间两个恰为零（W 与 M 交替）、圈数不随距离改变、包络起点归零终点留残余、指针绕行 360° 起点一像素不动、距离单调收敛但振幅不收到零、零/极远/非有限输入不产 NaN 与静态相位逐字稳定
canvasConnectionEligibility.ts: 点击/拖拽共用的唯一连接判据；区分节点缺失、自连、非 memo_ref、墓碑/回收站与无向重复 pair，UI/写入层只消费结果
canvasConnectionEligibility.test.ts: 连接判据单测，锁定合法 memo_ref 与所有失败原因，禁止点击/拖拽重新分叉规则
useCanvasConnectionSession.ts: React Flow onConnectStart/onConnect/onConnectEnd/isValidConnection 与点击路径的瞬态状态机；抑制拖拽结束合成 click，同一手势只提交一次正式关系并在结束/取消时清空来源
useCanvasConnectionSession.test.tsx: 连接生命周期 Hook 测试，锁定重复 onConnect 只写一次、合法 receipt/upsert/select，且自连/重复/墓碑零写入
canvasConnectionPresentation.test.ts: 连接命中 CSS 门禁，锁定 whole-card target 只在会话开放、抓手是底栏流内格子且仍以 z-index 压住整卡 target、底栏三个入口共用同一个 gap 变量因此必然等距、候选与预连上两档都只改 1px 细边、临时绳沉到 z-index 0 且该规则必须写在未分层边界（React Flow 的 style.css 不在 cascade layer 里）、珠子实心且描边整圈在外，以及三股透明度由深到淡单调
canvasViewportResize.test.ts: 响应式视口回归测试，锁定窗口/Canvas 尺寸变化时用 latest nodes 自动 fitView、节点拖动不重建 observer且不写回持久 viewport
canvasActions.tsx: 只传递正文预取、Preview、AI、连接抓手、文字编辑/缩放和移除命令的稳定 Context；选择、编辑中 ID 与 AI 状态不得进入 Context 放大节点重渲染
canvasMotionReceipts.ts: 本地手势的瞬时因果动效边界；生成 AI/人工/连接/Canvas 进入 receipt，按来源方向和有界 stagger 装饰 Flow UI data，并提供无真实节点身份的删除 DOM 快照——快照按布局尺寸排版再乘卡片自身 zoom，退场关键帧必须写进基准缩放，否则第一帧就胀回原始布局尺寸。入场编排只属于「第一次进来」：returning 为真时整条 canvas_entry 让路，因为返回时那张图一直在，重播入场只会让用户看着一片空白卡片自己填字，观感上世界被重建了一次；不得进入 API、WAL、数据库或 intent digest
canvasMotionReceipts.test.ts: 锁定来源确认、节点方向偏移、关系 draw、32ms/128ms 编排，以及特殊 node ID 查找、删除快照身份清理与按布局尺寸乘 zoom 的落位
spatialTextGeometry.ts: 空间文字宽高、内容基准尺寸与 text_scale（0.25–8）的约束及等比缩放纯函数，隔离对象自身缩放和 Canvas viewport zoom
spatialTextGeometry.test.ts: 空间文字几何不变量测试，覆盖基准边界、拖拽等比换算和缩放上下限
KnowledgeCanvas.interaction.test.tsx: 真实组件纵向交互测试；验证正常持久化静默、同步异常保留重试，覆盖文件树拖入到 add_memo/WAL、移除/撤销、来源确认、Pane 双击、空间文字、多选成框、关系与 Esc 收束，并锁定左右 Panel 开合不重挂输入、不挪动选择与外接框、不提前入队
useCanvasSessionCoordinator.ts: Canvas 会话基础设施 Hook；优先一次消费 canvas/user/token 均匹配且未过期的 bootstrap detail，否则读取 Canvas，再建立 Store 会话、恢复 IndexedDB WAL、注册 pagehide 与 flush 控制。一次会话的身份只有 (登录用户, 这张画布)，别的东西一律不许结束它：进入语境（bootstrap/entryChrome/restore）与回调都走渲染期 latest ref，写进 deps 的代价是真实的——上层记录一次返回描述就会清理整条 effect，resetSession() 清空文档与预览、dispose() 掐掉正在飞的保存，用户看到的是「点了编辑原文，预览凭空消失，页面直接弹出来」。409/rebase 后续重取仍归 Coordinator，不重播首屏进入
index.ts: 模块稳定出口，隔离 WorkspaceAuxViews 与内部文件布局

职责: Canvas V2 交互空间，只能由 CanvasWorkspace 承载；服务端图不含 content_mdx，memo 正文按需预览，native 空间文字才归 Canvas。建立关系只有卡片底栏行尾那颗抓手一个入口，拖拽与单指针点击两条路径共用判据/正式提交；临时编织绳纯 UI 且两端只有抓手与指针两个真相，正式 CanvasCordEdge 继续独立。组件只产生 intent，人工与 AI 都经 WAL/Coordinator/统一 mutation；选择所有权仍归 React Flow，一次手势的整组坐标必须整组回写。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
