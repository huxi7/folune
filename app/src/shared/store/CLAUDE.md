# app/src/shared/store/
> L2 | 父级: ../CLAUDE.md

成员清单
agentPanelStore.ts: AgentPanel 薄 UI 状态，只保存可见性与 open/close/toggle 命令，禁止复制 AI SDK 消息、错误或流状态
memoTree.ts: 备忘录树的不可变领域算法，统一递归查找、同级定位、插入、移除、替换、更新、移动、防环与稀疏 sort_order 排序
memoTree.test.ts: 树算法回归测试，覆盖无限嵌套、根/文件夹移动、首尾/中间排序、子树保留与自己/后代防环
memoTreeStore.ts: Zustand active 文件树与正文草稿单一数据源，编排整树读取、创建、重命名、移动、合并保存、soft delete subtree 快照移除/精确回滚及 restore subtree 原位合并；写成功不刷新整树
memoTreeStore.test.ts: Store 事务回归测试，覆盖创建/移动/保存并发规则、soft delete 乐观移除与失败回滚、restore 按 parent_id/sort_order 合并且不触发整树读取

职责: 隔离业务 API 与 React 组件之间的客户端领域状态，并容纳不复制服务数据的薄 UI 状态；组件只发命令和订阅节点，不直接维护第二棵树，也不在写操作成功后重新拉取整树。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
