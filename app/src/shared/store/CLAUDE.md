# app/src/shared/store/
> L2 | 父级: ../CLAUDE.md

成员清单
agentPanelStore.ts: AgentPanel 薄 UI 状态，按用户恢复可见性，并缓存后端已确认审批模式及 loading/saving/error；禁止复制 AI SDK 消息或文件树
agentPanelStore.test.ts: 锁定 Panel 刷新恢复、用户级偏好 key 隔离，以及审批保存失败保留原值、成功后才更新模式
aiRunTree.ts: AI 整理结果的无副作用局部树归并器，移动/改名目标 memo、插入工作流新目录，并在 undo 时恢复原位和删除可安全移除的空目录
aiRunTree.test.ts: 覆盖 apply/undo 局部归并、正文与 children 保真和工作流创建目录回收
aiCommandTree.ts: 通用 AI Command 无副作用对账器，把 succeeded/undone 的 server node/content/软删除事实局部归并 active tree，stale/failed 不改变真相
aiCommandTree.test.ts: 覆盖命令改名、软删除、stale 不变、创建撤销与恢复节点归并
aiCommandProjection.ts: AI 写工具乐观逆投影纯函数，以字段 CAS 精确撤销未获批/失败意图，不覆盖用户在途编辑
memoTree.ts: 备忘录树的不可变领域算法，统一递归查找、同级定位、插入、移除、替换、更新、移动、防环与稀疏 sort_order 排序
memoTree.test.ts: 树算法回归测试，覆盖无限嵌套、根/文件夹移动、首尾/中间排序、子树保留与自己/后代防环
memoTreeStore.ts: Zustand active tree/草稿单一数据源；除真人 CRUD 乐观事务外，接收 Worker plan 转换后的细分命令并按 tool_call_id 只投影一次，拒绝/error/stale 精确回滚，最终以 command_id+status 对账服务端事实
memoTreeStore.test.ts: Store 事务回归测试，覆盖真人 CRUD 并发/回滚及 AI rename/create 投影去重、失败/stale 回滚与 server command 替换

职责: 隔离业务 API 与 React 组件之间的客户端领域状态，并容纳不复制服务数据的薄 UI 状态；组件只发命令和订阅节点，不直接维护第二棵树，也不在写操作成功后重新拉取整树。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
