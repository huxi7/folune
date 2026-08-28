# app/src/shared/store/
> L2 | 父级: ../CLAUDE.md

成员清单
CLAUDE.md: 记录客户端状态层的职责边界、成员地图与 GEB 回环协议
agentPanelStore.ts: AgentPanel 权限薄状态，只缓存后端已确认审批模式及 loading/saving/error；可见性统一归 WorkspaceChromeState，禁止复制 AI SDK 消息或文件树
agentPanelStore.test.ts: 锁定审批保存失败保留原值、成功后才更新模式
workspaceChromeStore.ts: Paper First 外壳唯一 UI 状态，按用户持久化 libraryOpen/assistantOpen，新用户双关闭，兼容旧 Agent 开关迁移，并在覆盖式视口保证左右工具互斥
workspaceChromeStore.test.ts: 覆盖按用户 key、首次双关闭、版本化恢复、损坏容错与旧 AI 偏好迁移
canvasChromePolicy.ts: Canvas 侧栏进入策略纯函数，把 memo_default/standalone/tree/direct 四种进入语境与 1200/1400 两个断点翻译成左右两个独立布尔值；新建与从笔记进入都双收起（命名由画布标题原地完成），只有文件树切换继承现状、直接链接恢复快照，进入之后一律以用户操作为准
canvasChromePolicy.test.ts: 逐行锁定状态矩阵与两条断点钳制，并证明左右面板不会被绑成同一个值
canvasChromeStore.ts: Canvas 侧栏状态唯一所有者；登记一次性进入意图、幂等解析进入状态（StrictMode 双渲染同答案）并按用户持久化每画布最近布局，只记录用户亲手的开关而不把进入策略的输出写成假偏好，与 Paper 的用户级偏好完全隔离
canvasChromeStore.test.ts: 覆盖意图只生效一次、解析幂等、切换画布重新解析、每画布快照持久化/按用户隔离与损坏容错
aiRunTree.ts: AI 整理结果的无副作用局部树归并器，移动/改名目标 memo、插入工作流新目录，并在 undo 时恢复原位和删除可安全移除的空目录
aiRunTree.test.ts: 覆盖 apply/undo 局部归并、摘要与 children 保真和工作流创建目录回收
aiCommandTree.ts: 通用 AI Command 无副作用对账器，把 succeeded/undone 的 server node/正文摘要/软删除事实局部归并 active tree，stale/failed 不改变真相
aiCommandTree.test.ts: 覆盖命令改名、软删除、stale 不变、创建撤销与恢复节点归并
aiCommandProjection.ts: AI 写工具乐观逆投影纯函数，以字段 CAS 精确撤销未获批/失败意图，不覆盖用户在途编辑
memoTree.ts: 备忘录树的不可变领域算法，统一递归查找、同级定位、插入、移除、替换、更新、移动、防环与稀疏 sort_order 排序
memoTree.test.ts: 树算法回归测试，覆盖无限嵌套、根/文件夹移动、首尾/中间排序、子树保留与自己/后代防环
memoTreeStore.ts: Zustand 轻量 active tree 唯一数据源；mergeServerNode 让服务端已建成的节点（保存的画布、晋升出的笔记）就地落位而不刷新整棵树；只保存结构与摘要，除真人 CRUD 乐观事务外接收 Worker plan 转换后的结构命令并按 tool_call_id 只投影一次，最终以 command_id+status 对账服务端事实
memoTreeStore.test.ts: 轻量 Tree Store 事务回归测试，覆盖真人 CRUD 并发/回滚、临时 ID 与 Document Store 对账及 AI rename/create 投影去重
memoDocumentStore.ts: Zustand 单篇正文/草稿唯一数据源；按 ID 加载缓存、用 generation/version 拒绝迟到响应，承载临时 ID 对账、保存与 AI 正文投影/回滚
memoDocumentStore.test.ts: 正文生命周期回归测试，锁定只按打开 ID 请求、缓存复用与 reset 后旧响应不回填
canvasDocument.ts: Canvas intent 的纯领域内核；归一连续编辑、空间文字尺寸与 text_scale、乐观投影、服务端回执/alias 对账和冲突 rebase，React、网络与 IndexedDB 禁止进入
canvasDocument.test.ts: 锁定稳定 UUID 合并、空间文字尺寸与 text_scale、create+remove 由数据库判定 no-op、默认根移除清边、alias 对账与 dropped 不固化
canvasWal.ts: 按 user_id+canvas_id 隔离的 IndexedDB WAL；原子保存 draft/queued mutation 与发送状态，不保存 JWT、access token 或组件实例，并提供内存实现供测试
canvasWorkspaceStore.ts: Canvas Workspace 唯一客户端状态源；把服务端文档、交互会话和持久化状态分组三个 slice，不持有网络计时器或 memo 正文
CanvasSaveCoordinator.ts: 单 Canvas 单标签页保存协调器；600ms 封装、100 操作/48KiB 限额、WAL-first、人工先于随后 AI 的严格顺序、稳定 mutation_id、串行重试、receipt 重放、单次 409 rebase、AI stale 丢弃与 pagehide 首批发送均在此收口
CanvasSaveCoordinator.test.ts: 锁定空 WAL 恢复、WAL 失败不伪成功、空间文字 mutation 幂等、人工/AI 版本顺序、响应丢失幂等、409 保留远端事实、pagehide 有界与 source revision 漂移不留 AI 幽灵节点
commandPaletteStore.ts: 全局 Command Palette 唯一状态所有者，只保存开合与 Canvas 会话登记的「加入当前画布」适配器；Sidebar/Paper/Canvas 都只是同一个面板的入口
recentNodesStore.ts: 按用户持久化的最近打开顺序，只保存节点 id；Palette 用它列空查询最近项并为排序提供最近打开档位
canvasReturnStore.ts: 标签页内 Canvas→原文→Canvas 返回描述，只保存路由/视口/选择/临时 Panel，不持久化业务图或 WAL；它是唯一优先于进入策略的语境，因此往返回来看到的是离开前那一刻的样子

职责: 隔离业务 API 与 React 组件之间的客户端领域状态；Canvas 文档、交互、WAL 和传输职责分离，组件只产生 intent 与订阅事实，不维护第二棵树，也不在写成功后重拉整树。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
