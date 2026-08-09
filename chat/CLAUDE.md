# chat/
> L1 | 父级: ../CLAUDE.md

独立 AI 能力服务，以一个固定使用 DeepSeek V4 Flash、无工具、无记忆的中文备忘录 Agent 建立聊天地基，并通过 Supabase JWT 保护的 AI SDK v6 SSE 协议对外服务。

技术栈: Bun + TypeScript + Mastra + @mastra/ai-sdk + Vercel AI SDK + zod。

成员清单
src/config/: 服务端环境与模型白名单边界，API key 只从进程环境读取
src/lib/: 不接触凭据的运行时辅助能力，当前负责一次性 ASCII 启动 Banner
src/mastra/: Mastra 组合根、Agent 定义与独立提示词资产
src/middleware/: Supabase JWT 远端验证、可信 RequestContext 身份注入与安全请求日志
src/routes/: POST /v1/chat 的 UIMessage 校验和 SSE 响应桥接
package.json: 独立 Bun 工程脚本及锁定的 Mastra/AI SDK 兼容依赖
bun.lock: Bun 依赖锁文件，固定可复现安装结果
tsconfig.json: ES2022 + bundler 解析、严格类型与 @/ -> src/ 别名
.env.example: 无真实密钥的启动、鉴权、CORS 和模型预算模板
.gitignore: 排除本地环境变量、依赖、产物、缓存与系统文件

运行边界: 本机可用 `bun run dev`；根 Docker Compose 固定暴露 10002、探测 `/health`，密钥只来自被忽略的 `chat/.env`。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
