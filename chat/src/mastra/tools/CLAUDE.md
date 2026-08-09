# tools/
> L2 | 父级: ../CLAUDE.md

成员清单
celebration.ts: 声明 Agent 可调用的“庆祝”浏览器工具及 zod 输入/输出契约；count 忠实承载用户指定次数且不设产品侧次数上限，真实请求/渲染次数与礼花生命周期由 app 回传
memo.ts: 声明 read_tree/edit_node/read_memo/edit_memo 四个无 execute 客户端工具契约与 edit_node 原子操作枚举；服务端只向模型提供 schema，真实读写由 app 执行
memo.test.ts: 工具协议回归测试，锁定 edit_node 顶层 type:object、无 oneOf/anyOf、按 op 条件必填、禁止 operations 数组与客户端工具无 execute
CLAUDE.md: 记录工具子域的成员、执行边界与 GEB 回环协议

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
