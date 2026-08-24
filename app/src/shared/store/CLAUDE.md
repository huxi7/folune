# app/src/shared/store/
> L2 | 父级: ../CLAUDE.md

成员清单
agentPanelStore.ts: AgentPanel 权限薄状态，只缓存后端已确认审批模式及 loading/saving/error；可见性统一归 WorkspaceChromeState，禁止复制 AI SDK 消息或文件树
agentPanelStore.test.ts: 锁定审批保存失败保留原值、成功后才更新模式
workspaceChromeStore.ts: Paper First 外壳唯一 UI 状态，按用户持久化 libraryOpen/assistantOpen，新用户双关闭，兼容旧 Agent 开关迁移，并在覆盖式视口保证左右工具互斥
workspaceChromeStore.test.ts: 覆盖按用户 key、首次双关闭、版本化恢复、损坏容错与旧 AI 偏好迁移
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
explorationStore.ts: 探索候选与摘录的唯一住所；savedCanvasId 记下这一次是否已保存成画布，连线据此由虚转实；相位机 idle/pending/ready/empty/error/leaving 承载「等待即开场、退场留到动画结束」，用 requestId 作废过期响应。它存在的理由就是让「候选绝不进 memoTreeStore」有物理落点——探索是只读判断，不持久化、不并入目录树、不进 Command 台账
explorationStore.test.ts: 探索相位回归测试，覆盖连按两次时旧响应作废、零结果进 empty、退场期间候选留存与 reset 后清空

职责: 隔离业务 API 与 React 组件之间的客户端领域状态，并容纳不复制服务数据的薄 UI 状态与退出即弃的瞬时判断；组件只发命令和订阅节点，不直接维护第二棵树，也不在写操作成功后重新拉取整树。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
