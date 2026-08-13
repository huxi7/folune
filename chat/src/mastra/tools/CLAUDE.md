# tools/
> L2 | 父级: ../CLAUDE.md

成员清单
celebration.ts: 声明 Agent 可调用的“庆祝”浏览器工具及 zod 输入/输出契约；count 忠实承载用户指定次数且不设产品侧次数上限，真实请求/渲染次数与礼花生命周期由 app 回传
memo.ts: 定义模型唯一可见的 read_tree/read_memo/edit_memo/edit_node 客户端工具工厂、五种 op 校验、审批 key 与 namespaced 写工具识别；内部 command 不暴露给模型
memo.test.ts: 锁定四工具暴露面、一个胖 edit_node、审批协调边界、审批 key 稳定、namespaced 识别及三档 fail-closed 规则
CLAUDE.md: 记录工具子域的成员、执行边界与 GEB 回环协议

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
