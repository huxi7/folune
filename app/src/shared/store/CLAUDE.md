# app/src/shared/store/
> L2 | 父级: ../CLAUDE.md

成员清单
agentPanelStore.ts: AgentPanel 薄 UI 状态，只保存可见性与 open/close/toggle 命令，禁止复制 AI SDK 消息、错误或流状态
memoTree.ts: 备忘录树的不可变领域算法，统一递归查找、同级定位、插入、移除、替换、更新、移动、防环与稀疏 sort_order 排序
memoTree.test.ts: 树算法回归测试，覆盖无限嵌套、根/文件夹移动、首尾/中间排序、子树保留与自己/后代防环
memoTreeStore.ts: Zustand active 文件树与正文草稿单一数据源；`beginCreateMemo` 同步返回临时节点与独立提交 Promise，以稳定客户端 key 解析临时/真实 ID，提交期保存先等待真实 ID，服务端响应只合并未被继续编辑的字段；另编排整树读取、重命名、移动、soft delete 精确回滚及 restore 原位合并，写成功不刷新整树
memoTreeStore.test.ts: Store 事务回归测试，覆盖并发创建同步插入、乱序完成、单项失败回滚、临时 ID 期间编辑/保存、移动/保存并发、soft delete 回滚与 restore 局部合并

职责: 隔离业务 API 与 React 组件之间的客户端领域状态，并容纳不复制服务数据的薄 UI 状态；组件只发命令和订阅节点，不直接维护第二棵树，也不在写操作成功后重新拉取整树。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
