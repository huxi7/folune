# chat/src/evals/
> L2 | 父级: ../../../CLAUDE.md

成员清单
memo-v2.ts: 定义 30 条冻结上下文、原子工具、三档审批、stale/undo 中文真实任务及五项指标聚合器
memo-v2.test.ts: 锁定评测数量、唯一性、能力覆盖和指标算法，模型回放器不得改变基线语义
explore-v1.ts: 定义当前 Explore v1 使用的 60 篇语料标题、36 条检索场景（8 条 A 类字面重合 + 28 条 B 类零字面重合同一意思）与七项对比指标
explore-v1.test.ts: 静态数据完整性门禁；验证场景数量、唯一性、A/B 分类特征、目标标题与指标聚合行为
explore-v1.runner.ts: 唯一联网的一环，按 keyword / hybrid / hybrid_judged 三个通道跑同一批场景并打印对比表；依赖运行中的 api/chat 与一次真人登录拿到的 token，故刻意不进测试套件
CLAUDE.md: 记录离线评测成员与 GEB 回环协议

职责: 当前 Explore v1 的离线检索回归基线；静态门禁保证场景与指标数据自洽，联网 runner 对比现有检索通道。它是迁移调研的实现证据，不是 Canvas V2 的产品契约。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
