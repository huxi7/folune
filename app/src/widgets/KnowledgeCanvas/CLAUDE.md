# app/src/widgets/KnowledgeCanvas/
> L2 | 父级: ../CLAUDE.md

成员清单
useCanvasCitationFocus.ts: 提供引用触发的卡片居中导航
CLAUDE.md: 记录 Canvas V2 交互子域成员、职责边界与 GEB 回环协议
KnowledgeCanvas.tsx: Shift 与 Cmd/Ctrl 共用多选，引用定位只调整视口且不进入持久化；界面命令/提示通过 useLocale 中英切换，用户笔记与关系原文保持；Canvas 会话内容根；禁用 React Flow 默认 deleteKeyCode，删除只进入既有 requestNodeRemoval 确认/回执协议，节点/关系撤销时长共用 Toast 的六秒默认值，弹层键盘事件不穿透画布；始终挂载受控 React Flow，bootstrap/网络加载、选择、视口、WAL 与 mutation 沿原系统；响应式视口校准以稳定 resize/ResizeObserver 读取 latest nodes，节点拖动不重建 observer且校准不写回持久 viewport；nodesConnectable 只向右下 source/整卡 target 开放，拖/点都委托 useCanvasConnectionSession，临时绳不进文档，合法结束只签发一次 motion receipt + upsert_edge。Card→Preview 仍是纯本地 DOM 视图过渡，删除仍先拍无身份快照再入 WAL，hydration/rebase/save/rerender 不签发动画 图投影按文档引用缓存并由首帧/更新共用，初始化 Flow 只建一次，拖拽与选择不会重复重建初始化图。
CanvasCardView.tsx: 阅读/拓展/移除/连接抓手统一 asChild WarmTooltip，不改变 Handle DOM、ref 或拖拽； 界面命令/提示通过 useLocale 中英切换，用户笔记与关系原文保持；显式输入交互状态的共享纯 UI，完整保留卡片/空间文字/纸面过渡，不导入业务 Store；生产与 Demo 共用
CanvasCardNode.tsx: memo 化的 280x360 memo_ref 卡与 native 空间文字；静态选中只读 React Flow；可用 memo_ref 把可聚焦 Grip source 放在元信息行最右端（宪法 10.3 的「柄只服从最不干扰」——挂在卡片右下角外的小凸起正是最干扰的那种，它破坏纸的完整轮廓；行尾槽位不暗示任何出线方向，且与两个内容动作严格等距——抓手不同族由点阵图标、grab 光标与 hover 变 primary 表达，用间距表达只会被读成没对齐），whole-card target 仍是会话期直接子元素。元信息状态只剩墓碑与回收站两种：两者都是「指向的东西不在库里了」，用户必须知道也有出路；曾经的第三条「原文已更新」比的是入画布那天的 revision 快照，而标题与摘录本来就读最新内容，因此它警告的不一致用户看不见，又因快照只在创建时写一次而永久消不掉。抓手拖拽时由 React Flow connectingfrom 隐藏；正式中心 Handle/CanvasCordEdge 浮动端点不变，正文 hover/focus 仍只预取 memoDocumentStore
CanvasManipulationFeedback.tsx: Flow 内的单一按住手势观察器；按下卡片或已选组时只读 nodeLookup，把边缘 Portal 挂到实际参与搬动的卡片，释放/取消/失焦立即卸载；排除命令、连接、修饰键和 Space 平移，不改变选择与 WAL
CanvasManipulationFeedback.test.tsx: 真实 React Flow 下验证按下即反馈、松手/取消/失焦清理、组选共享、命令/修饰键/平移排除，以及视觉绝不改写静态选择
CanvasManipulationBorder.tsx: 原始 ElectricBorder 的配置入口，直接传 speed=0.6、chaos=0.04、thickness=2.75、maxDisplacement=2px 局部位移软上限、DS 颜色/平滑圆角、右下至左上 flow 与 Reduced Motion；不维护任何自定义波形或参数换算
electricBorderFrames.ts: 手势期共享 rAF 与栅格调度；按尺寸、DPR、颜色和波形参数分组，同规格每帧只画一份，其他 Canvas 复制；最后一个订阅释放即取消帧，不留缓存
ElectricBorder.tsx: React Bits 上游组件副本（源码引用见文件头）；保留十层 noise2D/octavedNoise、原始 speed 时间乘数与 chaos 振幅；同规格通过 electricBorderFrames 共享逐帧栅格，有限位移按描边外溢缩小缓冲区，定向模式仅将采样坐标映射为右下发起、两路向左上收束，同时继续推进原始噪声时间，波纹沿路径移动时仍持续变形；描边前按二维向量长度软限幅，避免偶发大尖刺；另适配 Flow 本地尺寸、线宽、squircle、currentColor 与暂停/离屏生命周期
electricBorderFlow.ts: 上游顺时针周长到右下/左上两路距离的纯映射；保留 8 倍空间尺度与 0.3 时间频率，端点渐收保证轮廓连接；位移软上限保留阈值一半以内的小毛边，超出后平滑趋近上限，不改上游噪声
electricBorderFlow.test.ts: 验证右下起点/左上终点、两路单调同步、时间持续前移、闭合接缝，以及全方向限幅/小纹理保真/接点连续
ElectricBorder.test.tsx: 另锁定 50 卡单帧一次噪声绘制、移除主绘制卡后的连续接管、全部释放取消帧及不同外观/暂停隔离；记录 Canvas 绘制点并恢复原型替身，避免污染 WebGL 流光测试；扣除方向平移后验证波形仍改变，锁定暂停不排帧
ElectricBorder.css: 上游 Canvas/辉光/内容分层样式，放入 components layer；品牌材质覆盖归 knowledge-canvas.css
ElectricBorder.LICENSE.md: React Bits Electric Border 上游组件的原始版权与 MIT + Commons Clause 许可
CanvasCardNode.test.tsx: 卡片结构回归门禁，锁定两个正式中心 Handle、抓手必须落在元信息行之内且排在两个内容动作之后、整卡 target、嵌套纸张、常驻展开入口、AI 忙碌选择器、元信息只剩墓碑/回收站两种状态，以及墓碑/回收站绝不暴露连接命中面
CanvasTitle.tsx: 完整名称与改名说明统一 WarmTooltip； 界面命令/提示通过 useLocale 中英切换，用户笔记与关系原文保持；Canvas 顶层安静标题；两种画布共用同一改名分支，只在 draft 从空进入编辑态时聚焦并全选，敲字本身不重复抢焦点；来源语义仍归 memo_ref 卡片
CanvasControls.tsx: 复用页面级提示组，与Paper/侧栏共享单一浮层和温热窗口；界面命令/提示通过 useLocale 中英切换，用户笔记与关系原文保持；React Flow 底部中央命令条，两个中性 surface 共用 WarmTooltip 的连续提示，加入笔记显示真实 mod+K 键帽；帮助开合/外部点击/Escape/焦点归还统一由命令条协调，不读取图数据或另设快捷键
CanvasControls.test.tsx: 底部命令形制门禁，锁定一个 Panel、两个同材质 surface、图标语义与真实加入快捷键；浏览器提示替代原生 title，动作顺序保持
CanvasHelpPopover.tsx: 补充 Shift 点击增减单篇选择的可发现说明；界面命令/提示通过 useLocale 中英切换，用户笔记与关系原文保持；工具栏上方的非模态操作速查，区分画布手势/搜索结果中的加入/选中笔记后的命令；两列短句与共享键帽，不呈现存储实现，不注册业务按键
CanvasHelpPopover.css: 帮助面板 384px 最大宽度、短行对齐与窄屏/短屏内部滚动；底部锚定、无全屏遮罩，与主画布样式分离
CanvasHelpPopover.interaction.test.tsx: 覆盖已打开帮助切换英语后原浮层实例和真实快捷键保持；命令条帮助层的 Portal 开合回归，锁定内容内点击、外部消散、Escape 焦点归还与不触及后端的键位说明
CanvasPersistenceStatus.tsx: 界面命令/提示通过 useLocale 中英切换，用户笔记与关系原文保持；正常保存/排队/恢复静默，仅展示尚未同步、版本冲突或恢复异常；异常说明与重试位于工具条上方并保留可访问播报，只解释协调器事实，不参与排队
CanvasPreviewOverlay.tsx: 引用预览接受已核验正文，隐藏编辑入口并提示版本变化、定位引文段落；关闭入口只保留无障碍名称，编辑工具复用原位 WarmTooltip 并显示于模态上方； 界面命令/提示通过 useLocale 中英切换，用户笔记与关系原文保持；不卸载 Canvas 的小开本 Paper 预览层；按 ID 读取正文，正文在路上时纸里先放卡片那段摘录（同一篇笔记的开头，放大的始终是同一段字，一个字都没到才退回 Skeleton），reader 纸面由 NotePaper 命名壳与正文。Dialog 使用 motion=none 且遮罩绝不拥有过渡身份——它留在 root 那张截图里，磨砂玻璃因此完整可用（backdrop-filter 采样的就是同一次绘制里身后的画布），而给它单独命名会让它排到过渡层末尾、整段盖住正在放大的纸；纸内只有正文，关闭/编辑一律在纸外 无正文及摘录时复用 180ms 延迟细行骨架。
CanvasPreviewOverlay.test.tsx: 预览结构回归门禁，锁定 motion=none bare 表面、单一 reader 纸，以及关闭/编辑原文一律不在纸内 首帧隐藏正文占位，编辑原文继续禁用且动作位置保持。
CanvasSelectionBounds.tsx: 选择外接框；单张笔记的选框与卡片同源平滑圆角，多对象范围框保留矩形，原生/补画两层由同一 CSS 选择事实驱动；只在 React Flow 自带 NodesSelection 缺席的两段时间出现——框选拖动中，以及多选静止但它已放手（抓住组里任意卡片就会让它消失）——与它共用同一条变换公式和同一个 --canvas-selection-line，因此松手只是换主人，框不移动也不闪。纯视觉、不接收指针，矩形判据住在 canvasPresentation
CanvasCordEdge.tsx: 理由/删除入口统一原位 WarmTooltip，理由展开时提示让位； 界面命令/提示通过 useLocale 中英切换，用户笔记与关系原文保持；关系路径与理由说明，几何/receipt 仍沿原职责；理由 Popover 用 top placement 的 PresenceSurface 收放，CSS 独立 translate 保持几何居中，保持聚焦/指向/显式展开与删除意图。理由说明有**四条独立理由**可以撑开它——指针在把手上、键盘焦点在把手上、指针在关系线上（命中区 18px 宽，把手就长在它上面）、点一下钉住——因此消散必须一次收掉全部四条，否则"点旁边收起"会经常不生效：那一下落在线上，线的那条仍然成立。**焦点必须与悬浮分开成两个状态**：Escape 会把焦点归还给把手，若焦点直接算作"悬浮"，归还的那一刻它就自己重新打开，Escape 等于没按。线的那条用"压制"而非清空——清了它，指针仍在线上不会重新触发 enter，说明会一直不回来。消散走共享 `useDismissable`（外部 pointerdown + Escape + 焦点归还），与 Select/菜单同一条协议；Escape 分支的 preventDefault 同时是给 PaperWorkspaceShell 壳层守卫让行的仲裁
CanvasCordEdge.test.ts: 浮动端点纯几何回归门禁，锁定目标跨象限拖动时端点从左右边切换到上下边、轴向对齐取直而对角线两个控制点分居弦两侧（S）、卡片朝对角方向的端点收进圆角弧上，并覆盖节点尚未测量时的安全兜底
CanvasElasticConnectionLine.tsx: React Flow 拖拽期纯 UI 渲染层；起点取 fromX/fromY（React Flow 按 handleBounds 算出的抓手中心，因此绳子从被按住的那一点出来），终点取 connection.pointer 并用 viewport transform 反解回画布坐标 —— 绝不消费 toX/toY：本产品的 target handle 覆盖整张卡片，一旦吸附 React Flow 就把 to 换成那个 handle 的中心，线于是贯穿目标正文。吸附对提交是对的（它决定连给谁），对显示是错的（它决定线画到哪）。坐标写 latest ref，单一 rAF 只直接更新三条 path 与 drop cursor 属性，卸载立即取消，Reduced Motion 停相位但继续严格跟手
CanvasElasticConnectionLine.test.ts: 临时绳的坐标所有权门禁，锁定起点是抓手、终点是真实指针、cordAnchor 不再出现，toX/toY 只作 pointer 缺席时的兜底；珠子半径恒定且小，状态只由颜色表达
elasticCordGeometry.ts: 临时编织绳纯几何；两端都是手势本身（抓手落点与实时指针），不再对来源卡片求边界锚点——那是「已成立的关系属于整张卡片」的算法，属于 CanvasCordEdge。波形是基频叠加等幅三次谐波 `sin θ + sin 3θ`：一个周期读作「峰-中线-峰」接「谷-中线-谷」，即一个 M 紧跟一个 W，两个中间转角恰好落在中线上——这是它区别于纯正弦（一周期只有一峰一谷、过于规整）的那一眼。它是弹簧不是麻绳：圈数恒定 3 圈而波长由距离决定，拉长只是把同样这几圈抻开抻平，于是「卷着」与「被拉直」是同一根东西的两个状态；反过来钉死波长、拉长就多长几圈是麻绳（越拉越松越弯，与手上越拉越紧相反），而给圈数设上下限更糟——它会在某个距离上从「多长几圈」切成「波长变长」，同一次拖拽两种行为。三股相位速度各不相同（1 / 1.42 / 2.05，与 CSS 里由深到淡的透明度同序），因此相对位置一直在变，读作三根线真的在缠绕，同速只会得到三条永远平行的波。端点包络非对称：起点严格归零（抓手那头本就压在卡片底下），终点留 tailSpread 残余。绕珠的那点散开另由常量 tailFan 单独给出且与相位无关——波与股距两项都带相位，圈数取整数时尾端恰好回到起始相位、两项正好反向抵消，靠它们的残余就等于让「绕珠」碰运气，而相位 0 正是 Reduced Motion 固定停住的那一档。振幅/股距/线宽随距离单调收敛但都有下限，拉到再远也留着看得见的波浪，靠的是这个下限而不是多长几圈
elasticCordGeometry.test.ts: 临时绳数学门禁，覆盖三股同起点、终点在整段相位扫掠里都绕珠散开且仍贴着珠子（相位 0 单独钉死）、`sin θ + sin 3θ` 一周期六个极值且中间两个恰为零（W 与 M 交替）、圈数不随距离改变、包络起点归零终点留残余、指针绕行 360° 起点一像素不动、距离单调收敛但振幅不收到零、零/极远/非有限输入不产 NaN 与静态相位逐字稳定
canvasConnectionEligibility.ts: 点击/拖拽共用的唯一连接判据；区分节点缺失、自连、非 memo_ref、墓碑/回收站与无向重复 pair，UI/写入层只消费结果
canvasConnectionEligibility.test.ts: 连接判据单测，锁定合法 memo_ref 与所有失败原因，禁止点击/拖拽重新分叉规则
useCanvasConnectionSession.ts: React Flow onConnectStart/onConnect/onConnectEnd/isValidConnection 与点击路径的瞬态状态机；抑制拖拽结束合成 click，同一手势只提交一次正式关系并在结束/取消时清空来源
useCanvasConnectionSession.test.tsx: 连接生命周期 Hook 测试，锁定重复 onConnect 只写一次、合法 receipt/upsert/select，且自连/重复/墓碑零写入
canvasConnectionPresentation.test.ts: 中性 canvas-interaction-ink 轮廓的连接命中 CSS 门禁，锁定 whole-card target 只在会话开放、抓手是底栏流内格子且仍以 z-index 压住整卡 target、底栏三个入口共用同一个 gap 变量因此必然等距、候选与预连上两档都只改 1px 细边、临时绳沉到 z-index 0 且该规则必须写在未分层边界（React Flow 的 style.css 不在 cascade layer 里）、珠子实心且描边整圈在外，以及三股透明度由深到淡单调
canvasViewportResize.test.ts: 响应式视口回归测试，锁定窗口/Canvas 尺寸变化时用 latest nodes 自动 fitView、节点拖动不重建 observer且不写回持久 viewport
canvasActions.tsx: 只传递正文预取、Preview、AI、连接抓手、文字编辑/缩放和移除命令的稳定 Context；选择、编辑中 ID 与 AI 状态不得进入 Context 放大节点重渲染
canvasMotionReceipts.ts: 本地手势的瞬时因果动效边界；生成 AI/人工/连接/Canvas 进入 receipt，按来源方向和有界 stagger 装饰 Flow UI data，并提供无真实节点身份的删除 DOM 快照——快照按布局尺寸排版再乘卡片自身 zoom，退场关键帧必须写进基准缩放，否则第一帧就胀回原始布局尺寸。入场编排只属于「第一次进来」：returning 为真时整条 canvas_entry 让路，因为返回时那张图一直在，重播入场只会让用户看着一片空白卡片自己填字，观感上世界被重建了一次；不得进入 API、WAL、数据库或 intent digest
canvasMotionReceipts.test.ts: 锁定来源确认、节点方向偏移、关系 draw、32ms/128ms 编排，以及特殊 node ID 查找、删除快照身份清理与按布局尺寸乘 zoom 的落位
spatialTextGeometry.ts: 空间文字宽高、内容基准尺寸与 text_scale（0.25–8）的约束及等比缩放纯函数，隔离对象自身缩放和 Canvas viewport zoom
spatialTextGeometry.test.ts: 空间文字几何不变量测试，覆盖基准边界、拖拽等比换算和缩放上下限
KnowledgeCanvas.interaction.test.tsx: 真实组件纵向交互测试；验证正常持久化静默、同步异常保留重试，覆盖文件树拖入到 add_memo/WAL、移除/撤销、来源确认、Pane 双击、空间文字、多选成框、关系与 Esc 收束，并锁定左右 Panel 开合不重挂输入、不挪动选择与外接框、不提前入队
useCanvasSessionCoordinator.ts: 返回描述只保存画布视口/选择/文件库，助手尺寸由外层场景默认规则裁决； 向首次入口过渡报告内容就绪或失败； Canvas 会话基础设施 Hook；优先一次消费 canvas/user/token 均匹配且未过期的 bootstrap detail，否则读取 Canvas，再建立 Store 会话、恢复 IndexedDB WAL、注册 pagehide 与 flush 控制。一次会话的身份只有 (登录用户, 这张画布)，别的东西一律不许结束它：进入语境（bootstrap/entryChrome/restore）与回调都走渲染期 latest ref，写进 deps 的代价是真实的——上层记录一次返回描述就会清理整条 effect，resetSession() 清空文档与预览、dispose() 掐掉正在飞的保存，用户看到的是「点了编辑原文，预览凭空消失，页面直接弹出来」。409/rebase 后续重取仍归 Coordinator，不重播首屏进入
index.ts: 模块稳定出口，隔离 WorkspaceAuxViews 与内部文件布局

职责: Canvas V2 交互空间，只能由 CanvasWorkspace 承载；服务端图不含 content_mdx，memo 正文按需预览，native 空间文字才归 Canvas。建立关系只有卡片底栏行尾那颗抓手一个入口，拖拽与单指针点击两条路径共用判据/正式提交；临时编织绳纯 UI 且两端只有抓手与指针两个真相，正式 CanvasCordEdge 继续独立。组件只产生 intent，人工与 AI 都经 WAL/Coordinator/统一 mutation；选择所有权仍归 React Flow，一次手势的整组坐标必须整组回写。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
