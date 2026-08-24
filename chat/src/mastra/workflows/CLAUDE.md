# chat/src/mastra/workflows/
> L2 | 父级: ../CLAUDE.md

成员清单
organize-memo.ts: 组织单篇笔记的无副作用 Planner 工作流；让供应商生成普通 JSON 文本后由本地 Zod 严格解析、校验目录白名单，并按置信阈值/new_folder 风险输出确认决策
explore-notes.ts: 探索关联笔记的只读工作流；对每篇候选各发一次判断请求并并行等待，因为 12 篇一次判会让推理占满输出预算而吐不出正文。截断（finishReason=length）与解析失败都降级为该篇的 judge_failed，绝不让单篇失败带崩整轮；日志只记 token 形状，正文永不入日志
CLAUDE.md: 记录 Workflow 子域成员、边界与 GEB 回环协议

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
