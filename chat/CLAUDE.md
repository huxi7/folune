# chat/
> L1 | 父级: ../CLAUDE.md

独立 AI 能力服务，以固定 DeepSeek V4 Flash 的对话 Agent、无工具/无记忆审批 Agent 和整理 Planner 提供笔记协作；chat 不持有业务库，通过当前用户 JWT 获取冻结 context、同步 UIMessage，并只向模型暴露 read_tree/read_memo/edit_memo/edit_node。tree 始终是无正文导航结构，明确目标正文按 ID 单取；初次生成与审批/工具续写复用同一 assistant，审批先于浏览器 Worker，细分 Command 仍由 api 状态机执行。

技术栈: Bun + TypeScript + Mastra + @mastra/ai-sdk + Vercel AI SDK + zod。

成员清单
src/config/: 服务端环境与模型白名单边界，API key 只从进程环境读取
src/lib/: Business API 边界、非序列化 memo context、审批协调/契约、整理领域契约与无敏感信息运行时能力
src/mastra/: Mastra 组合根、对话/审批/Planner Agents、动态提示词、整理 Workflow 与服务端工具契约
src/middleware/: Supabase JWT 远端验证、可信 RequestContext 身份注入与安全请求日志
src/routes/: POST /v1/chat 的 context/消息持久化与 SSE 桥接，以及 POST /v1/organize 的 Run/Workflow 编排
src/evals/: 30 条中文真实任务基线与上下文命中、错误工具、人工确认、stale、撤销成功五项指标定义
package.json: 独立 Bun 工程脚本、工具契约测试入口及锁定的 Mastra/AI SDK 兼容依赖
bun.lock: Bun 依赖锁文件，固定可复现安装结果
tsconfig.json: ES2022 + bundler 解析、严格类型与 @/ -> src/ 别名
.env.example: 无真实密钥的启动、鉴权、Business API、CORS、整理阈值和模型预算模板
.gitignore: 排除本地环境变量、依赖、产物、缓存与系统文件

运行边界: 本机可用 `bun run dev`；根 Docker Compose 固定暴露 10002、探测 `/health`，密钥只来自被忽略的 `chat/.env`。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
