# tools/
> L2 | 父级: ../CLAUDE.md

成员清单
celebration.ts: 声明 Agent 可调用的“庆祝”浏览器工具及 zod 输入/输出契约；count 忠实承载用户指定次数且不设产品侧次数上限，真实请求/渲染次数与礼花生命周期由 app 回传
memo.ts: 五工具模型契约：四个原子工具与明确目标清单的 edit_nodes；批量仅同一种移动/改名/软删除，所有写工具同样经过审批门禁
memo.test.ts: 锁定原子与批量工具暴露面、审批识别与 fail-closed 规则
CLAUDE.md: 记录工具子域的成员、执行边界与 GEB 回环协议

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
