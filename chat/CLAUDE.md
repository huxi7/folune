# chat/
> L1 | 父级: ../CLAUDE.md

独立 AI 能力服务，以固定 DeepSeek V4 Flash 的对话 Agent、无工具/无记忆审批 Agent、整理 Planner 和逐篇关联判断器提供笔记协作；chat 不持有业务库，通过当前用户 JWT 获取冻结 context、同步 UIMessage，并只向模型暴露受控能力。Canvas expansion 由 api 重取可信 source/revision/corpus/checkpoint/邻居，再复用 Explore 判断和逐字引文复核，chat 永不直接提交 Canvas mutation。

技术栈: Bun + TypeScript + Mastra + @mastra/ai-sdk + Vercel AI SDK + zod。

成员清单
src/config/: 服务端环境与模型白名单边界，API key 只从进程环境读取
src/lib/: 有完整响应期限的 Auth/Business API HTTP 生命周期、Business API 边界、非序列化 memo context、审批协调/契约、整理与探索领域契约（含摘录逐字复核与服务端置信度排序）以及无敏感信息运行时能力
src/mastra/: Mastra 组合根、对话/审批/Planner/探索 Agents、动态提示词、整理/探索 Workflow 与服务端工具契约
src/middleware/: Supabase JWT 远端验证（已完成身份按 SHA-256(token) 键入 45 秒 TTL 缓存，命中期内不再回源）、可信 RequestContext 身份注入与安全请求日志
src/routes/: POST /v1/chat 的 context/消息持久化与 SSE 桥接（思考/工具/正文均实时透传，正文不等待步骤结束，30 秒无事件则失败，finish 不等待 EOF；错误与单条落库结果决定终态）、POST /v1/organize 的 Run/Workflow 编排、兼容只读 POST /v1/explore，以及 Canvas V2 可信 POST /v1/canvas-expand
src/evals/: 30 条中文真实任务基线与五项指标，外加当前 Explore v1 的 36 条检索场景、七项指标与三路对比 runner；这里只记录和回归现有检索行为，不定义 Canvas V2 的产品目标与验收标准
package.json: 独立 Bun 工程脚本、工具契约测试入口及锁定的 Mastra/AI SDK 兼容依赖
bun.lock: Bun 依赖锁文件，固定可复现安装结果
tsconfig.json: ES2022 + bundler 解析、严格类型与 @/ -> src/ 别名
.env.example: 无真实密钥的启动、鉴权、Business API、CORS、整理阈值和模型预算模板
.gitignore: 排除本地环境变量、依赖、产物、缓存与系统文件

运行边界: 本机可用 `bun run dev`；根 Docker Compose 固定暴露 10002、探测 `/health`，密钥只来自被忽略的 `chat/.env`。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
