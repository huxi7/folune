# app/src/shared/store/
> L2 | 父级: ../CLAUDE.md

成员清单
workspaceEntryStore.ts: 首次准入的短期 UI 状态；会话/账户/目录/代码/首屏按真实完成累加，编号隔离旧请求，失败/取消与揭幕后释放
workspaceEntryStore.test.ts: 真实节点乱序、首屏 100% 门禁、重复通知与取消/旧入口隔离回归
CLAUDE.md: 记录客户端状态层的职责边界、成员地图与 GEB 回环协议
agentPanelStore.ts: 当前账号的权限薄状态，首屏默认完全访问；同账号重读保留显示、切账号隔离，isPermissionReady 只在当前账号 API 确认后允许发送；可见性归 WorkspaceChromeState
agentPanelStore.test.ts: 锁定默认完全访问、加载/保存门禁、账号隔离、保存失败保留显示与成功确认
workspaceChromeStore.ts: 显式还原短窗清除当前场景自定义高度/位置，胶囊开合仍保留自由尺寸；按账号持久化笔记自定义浮窗高度/位置（宽度沿工作台共享偏好）、Paper文件库、跨空间助手可见性与笔记尺寸；普通画布进入短窗，全高只保持当次主动选择或明确返回快照，关闭后跨场景保持胶囊
workspaceChromeStore.test.ts: 旧全高偏好还原短窗、刷新不复发与画布/笔记尺寸隔离；自定义窗口收起/刷新保留； 账号/旧偏好恢复及助手跨场景短窗、全高、主动关闭、明确返回与持久化隔离门禁
canvasChromePolicy.ts: Canvas文件库四种进入意图与窄屏钳制纯策略；助手可见性/尺寸由workspaceChromeStore裁决，画布快照不覆盖它
canvasChromePolicy.test.ts: 文件库继承、新建关闭、直达恢复与窄屏钳制；不再制造画布助手的第二真相
canvasChromeStore.ts: Canvas文件库一次性进入意图、只读预览与幂等解析，按账号保存每画布最近文件库开关；读取旧快照时丢弃助手字段，避免全高被恢复成画布常态
canvasChromeStore.test.ts: 旧快照助手字段丢弃与文件库恢复门禁；覆盖意图只生效一次、只读预览不消费意图、解析幂等、切换画布重新解析、每画布快照持久化/按用户隔离与损坏容错
aiRunTree.ts: AI 整理结果的无副作用局部树归并器，移动/改名目标 memo、插入工作流新目录，并在 undo 时恢复原位和删除可安全移除的空目录
aiRunTree.test.ts: 覆盖 apply/undo 局部归并、摘要与 children 保真和工作流创建目录回收
aiCommandTree.ts: 通用 AI Command 无副作用对账器，把 succeeded/undone 的 server node/正文摘要/软删除事实局部归并 active tree，stale/failed 不改变真相
aiCommandTree.test.ts: 覆盖命令改名、软删除、stale 不变、创建撤销与恢复节点归并
aiCommandProjection.ts: AI 写工具乐观逆投影纯函数，以字段 CAS 精确撤销未获批/失败意图，不覆盖用户在途编辑
memoTitleRules.ts: 命名规则纯策略，与 api/supabase/memo-naming.sql 的 memo_title_norm 同语义；提供规范化、同父同类型重名判据与服务端 MEMO_TITLE_CONFLICT 识别。它只负责即时反馈，重名的最终真相永远是数据库唯一索引；命名零特例，因此这里不再有「谁不可改名」与「谁的标题跟随谁」两类判据
memoTitleRules.test.ts: 命名规则门禁，覆盖空白/大小写折叠、跨类型与笔记-默认画布同名合法、根节点作用域与 parent 缺失时不误报冲突
memoTree.ts: 笔记/画布共用默认名算法，按同级同类型现存最大编号加一，不填空号，空白/Canvas 大小写与命名约束同语义； 备忘录树的不可变领域算法，统一递归查找、同级定位、插入、移除、替换、更新、移动、防环与稀疏 sort_order 排序 查询使用线性栈，排序/删除保留未变化子树引用。
memoTree.test.ts: 覆盖笔记/画布默认名最大编号及同级同类型、子目录、空白/大小写边界； 树算法回归测试，覆盖无限嵌套、根/文件夹移动、首尾/中间排序、子树保留与自己/后代防环 验证排序、插入、删除不重建未变化分支。
memoTreeStore.ts: 默认笔记名同步占号，临时节点参与且首帧即完整名称； Zustand 轻量 active tree 唯一数据源；路由 loader 的轻量 tree 通过 hydrateTree 注入，mergeServerNode 让服务端已建成的节点（保存的画布、晋升出的笔记）就地落位而不刷新整棵树；memo 与 folder 乐观创建成功都登记 getMemoClientKey 映射，使临时→真实 id 替换对文件树是同一身份、行不重挂；只保存结构与摘要，除真人 CRUD 乐观事务外接收 Worker plan 转换后的结构命令并按 tool_call_id 只投影一次，最终以 command_id+status 对账服务端事实
memoTreeStore.test.ts: 覆盖连续八次创建不等网络即得到完整编号、乱序回包不改名； 轻量 Tree Store 事务回归测试，覆盖真人 CRUD 并发/回滚、临时 ID 与 Document Store 对账及 AI rename/create 投影去重
memoDocumentStore.ts: Zustand 单篇正文共享数据源；按 ID 加载缓存、意图预取与在途合并，用 generation/version 拒绝迟到响应，并承载保存、临时 ID 对账与 AI 正文投影/回滚；逐键草稿留在编辑会话，保存边界才投影回来 预取/点击/多阅读者共用同一在途请求，每个阅读者独立取消，最后一个离开才中止传输；删除与 reset 门禁迟到响应，已有草稿不被读响应覆盖。
memoDocumentStore.test.ts: 正文生命周期回归测试，锁定按打开 ID 请求、预取/点击合并、缓存复用、reset 门禁与临时 ID 对账 覆盖双向合并、独立取消、取消重开、删除失效与草稿保护。
canvasDocument.ts: Canvas intent 的纯领域内核；以 isCanvasOriginNode 暴露唯一来源判据；线性索引合并同一生命周期内的编辑，删除/重建隔断索引，关系更新保留首次身份与未显式清除的理由，保证快速删除/撤销和原序投影一致；归一空间文字尺寸/text_scale、回执/alias 与冲突 rebase，禁止 React、网络与 IndexedDB 进入
canvasDocument.test.ts: 锁定关系创建/删除/撤销、节点删除/恢复后的编辑顺序等价、关系身份/理由保真、稳定 UUID 与文字尺寸合并；保留 create+remove 的服务端 no-op 判定、默认根清边、alias 对账与 dropped 不固化
canvasWal.ts: 按 user_id+canvas_id 隔离的 Folune IndexedDB WAL；首次打开时安全迁移旧数据库中的 draft/queued mutation，原子保存发送状态，不保存 JWT、access token 或组件实例，并提供内存实现供测试
canvasWorkspaceStore.ts: Canvas Workspace 唯一客户端状态源；把服务端文档、交互会话和持久化状态分组三个 slice，不持有网络计时器或 memo 正文
CanvasSaveCoordinator.ts: 单 Canvas 单标签页保存协调器；恢复读取与 enqueueMany 共享 WAL 锁，避免首屏新手势被旧恢复快照覆盖；一次手势原子入账，600ms 封装、100 操作/48KiB 限额、人工先于 AI、稳定 mutation_id、串行重试/receipt/单次 rebase 在此收口；dispose 后隔离迟到读取/保存/WAL/冲突回调并停止后续重试，未确认记录保留给下次同 ID 重放，pagehide 只发首批
CanvasSaveCoordinator.test.ts: 锁定恢复期间新手势不丢、离场后恢复/保存/WAL/退避/两类冲突不影响新画布、旧 mutation 同 ID 重放；同时覆盖空恢复、WAL 失败不伪成功、整组手势原子入账、文字幂等、响应丢失重试、409 远端保真、pagehide 有界与 AI 过期丢弃
commandPaletteStore.ts: 全局 Command Palette 唯一状态所有者，只保存开合与 Canvas 会话登记的「加入当前画布」适配器；Sidebar/Paper/Canvas 都只是同一个面板的入口
recentNodesStore.ts: 按用户持久化的最近打开顺序，只保存节点 id；Palette 用它列空查询最近项并为排序提供最近打开档位
canvasReturnStore.ts: 标签页内 Canvas→原文→Canvas 返回描述，只保存路由/视口/选择/临时 Panel，不持久化业务图或 WAL；它是唯一优先于进入策略的语境，因此往返回来看到的是离开前那一刻的样子

职责: 隔离业务 API 与 React 组件之间的客户端领域状态；Canvas 文档、交互、WAL 和传输职责分离，组件只产生 intent 与订阅事实，不维护第二棵树，也不在写成功后重拉整树。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

本次侧栏生命周期约束：Paper/Canvas 只承载中央内容与工具开关，左右工具由 Dashboard 的 WorkspacePanelLayer 持续挂载；从笔记进入默认画布继承当前工具开关，动画不得重建 AgentPanel。
