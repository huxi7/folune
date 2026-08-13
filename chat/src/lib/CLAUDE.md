# chat/src/lib/
> L2 | 父级: ../../CLAUDE.md

成员清单
banner.ts: 启动时输出一次定宽 ASCII Banner，只呈现服务名、运行时、端口、Agent、模型 ID 与路由等非敏感摘要
business-api.ts: chat→api 唯一业务 HTTP client，请求期转发当前 Bearer JWT，校验 thread/frozen-context/settings/tree/memo/command/run 资源，绝不记录或持久化 token
approval-contracts.ts: approval-agent 的 approve/manual/deny + risk + reason 严格结构化契约与非法输出手工兜底
approval-coordinator.ts: Chat 独立审批协调器，仅在智能审批实验调用 approvalAgent；综合用户原话、冻结来源、胖工具参数、实际目标与影响范围，失败/非法/manual/deny 一律转人工
memo-agent-context.ts: 在 RequestContext 中短暂承载可信 ResolvedContext 的非序列化盒；toJSON 主动隐藏正文，供动态 Agent instructions 请求期读取
organize-contracts.ts: 定义严格 OrganizePlan/PlannerInput schema，把整树裁剪为目标正文和文件夹导航投影；兼容纯 JSON/JSON fence 文本后仍经 Zod/目录白名单校验，并以置信阈值和 new_folder 规则确定确认风险
organize-contracts.test.ts: 锁定整理最小投影、供应商无 response_format 时的 JSON 文本严格解析、低置信/new_folder 确认和模型伪造 folder ID 拒绝
CLAUDE.md: 记录 chat 通用运行时能力的职责边界与 GEB 回环协议

职责: 承载不属于业务、路由或配置的服务端运行时能力；任何输出都必须保持密钥、JWT 与完整鉴权材料不可见。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
