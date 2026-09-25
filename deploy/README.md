# Folune 开发与生产部署

同一套代码、Dockerfile 和锁文件保留在 main 与 production。分支选择发布版本，运行平台选择数据库；不要在分支之间替换真实 `.env`。

## 本地开发

根目录执行 `docker compose -f docker-compose.dev.yml up -d --build`。Compose 显式选择两个 Dockerfile 的 dev 阶段，挂载源码与独立依赖卷，分别读取 api/.env、chat/.env。前端读取 app/.env.local，三者继续连接 Staging。

## 生产构建

构建上下文必须是仓库根，Dockerfile 分别为 deploy/docker/api.Dockerfile 与 deploy/docker/chat.Dockerfile。最后的 production 阶段也是默认目标；不挂载本机源码，不使用开发启动命令。API 直接运行 Bun TypeScript，Chat 在镜像内生成 Mastra 产物并用 Bun 执行 index.mjs，以保留鉴权使用的 Bun.CryptoHasher。

Cloud Build 使用 deploy/cloudbuild.yaml。两个 GitHub push 触发器都只匹配 `^production$`，各自提供 `_MODULE`（api/chat）、`_SERVICE`（对应服务名）、`_REGION`、`_REPOSITORY`；共享的流程构建 linux/amd64 镜像、以 COMMIT_SHA 标记、推送并更新对应服务。触发器构建身份需要镜像写入、日志写入、Cloud Run 部署及使用运行服务账号的权限。每次部署保留已有服务配置。

## 运行配置

| 位置 | 生产配置 |
| --- | --- |
| API Cloud Run | NODE_ENV=production、SUPABASE_URL、SUPABASE_PUBLISHABLE_KEY、CORS_ORIGINS=正式网站 origin |
| Chat Cloud Run | NODE_ENV=production、SUPABASE_URL、SUPABASE_PUBLISHABLE_KEY、ALLOWED_ORIGINS=正式网站 origin、BUSINESS_API_BASE_URL=正式 API HTTPS 地址 |
| Secret Manager | DEEPSEEK_API_KEY，仅授权 Chat 运行身份读取，在容器启动时注入 |
| Cloudflare Pages Production | VITE_SUPABASE_URL、VITE_SUPABASE_PUBLISHABLE_KEY、VITE_API_BASE_URL、VITE_CHAT_BASE_URL，修改后重新构建 |

两个后端读取 Cloud Run 注入的 PORT；平台开放 HTTP 入口，业务接口仍通过 Supabase 用户 JWT 鉴权。Production 的 Supabase URL 与 Publishable key 必须在前端、API、Chat 保持同项目。Google OAuth 回调、Site URL、邮件与 Storage 配置属于各 Supabase 项目，不能从数据库迁移记录推断其就绪。

Chat 的生产入口仅开放 /health 及四个 /v1 业务路径，关闭 Mastra 默认 /api/agents、/api/workflows 等接口；本地 dev 不注册这一限制。

## 发布与验证

先检查生产镜像的 /health、业务接口无 token 的 401、CORS 与实际业务链路，再将验证后的代码从 main 合入 production。Cloudflare 和 Cloud Build 独立触发，不保证完成顺序；跨层变化必须兼容旧版本，或按数据库迁移、后端、前端分步发布。

容器构建不执行数据库 SQL。api/supabase 中包含历史、回滚及开发种子脚本，禁止整目录自动执行；两库现有迁移基线须单独对齐后才能启用增量迁移。构建成功只证明镜像可用，正式业务验收还须验证 Production 用户登录、读写与 AI。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
