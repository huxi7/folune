# Folune 开发与生产部署

同一套代码、Dockerfile 和锁文件保留在 main 与 production。分支选择发布版本，运行平台选择数据库；不要在分支之间替换真实 `.env`。

## 线上资源

以下为 2026-09-26 配置完成的资源映射；当前修订版本与构建结果以平台为准。

| 资源 | 正式环境 |
| --- | --- |
| 网站 / Pages 项目 | https://folune.huxi7.com / folune |
| Google Cloud 项目 / 区域 | folune7 / asia-southeast1（新加坡） |
| API | https://folune-api-711201740376.asia-southeast1.run.app |
| Chat | https://folune-chat-711201740376.asia-southeast1.run.app |
| Production Supabase | https://ialqliixbdwwmxackjpr.supabase.co |
| 镜像仓库 | asia-southeast1-docker.pkg.dev/folune7/folune |
| GitHub / 发布分支 | solink7/folune / production |

Pages 以 app 为根目录，执行 `bun install --frozen-lockfile && bun run build`，发布 dist；BUN_VERSION=1.3.14，Preview 自动部署关闭。`folune-api-production` 与 `folune-chat-production` 两个 Cloud Build 触发器均只匹配 `^production$`，分别构建 api/chat 并更新 folune-api/folune-chat。

## 本地开发

根目录执行 `docker compose -f docker-compose.dev.yml up -d --build`。Compose 显式选择两个 Dockerfile 的 dev 阶段，挂载源码与独立依赖卷，分别读取 api/.env、chat/.env。前端读取 app/.env.local，三者继续连接 Staging。

## 生产构建

构建上下文必须是仓库根，Dockerfile 分别为 deploy/docker/api.Dockerfile 与 deploy/docker/chat.Dockerfile。最后的 production 阶段也是默认目标；不挂载本机源码，不使用开发启动命令。API 直接运行 Bun TypeScript，Chat 在镜像内生成 Mastra 产物并用 Bun 执行 index.mjs，以保留鉴权使用的 Bun.CryptoHasher。

Cloud Build 使用 deploy/cloudbuild.yaml。两个 GitHub push 触发器都只匹配 `^production$`，各自提供 `_MODULE`（api/chat）、`_SERVICE`（对应服务名）、`_REGION`、`_REPOSITORY`；共享的流程构建 linux/amd64 镜像、以 COMMIT_SHA 标记、推送并更新对应服务。触发器构建身份需要镜像写入、日志写入、Cloud Run 部署及使用运行服务账号的权限。每次部署保留已有服务配置。

构建身份为 `folune-build@folune7.iam.gserviceaccount.com`，两个运行身份分别为 `folune-api@folune7.iam.gserviceaccount.com`、`folune-chat@folune7.iam.gserviceaccount.com`。构建身份可写入 folune 镜像仓库、写日志、部署 Cloud Run，并可使用这两个运行身份；DeepSeek Secret 的读取权限只授予 Chat 运行身份。

## 首次建立或重建服务

`cloudbuild.yaml` 负责更新镜像，要求 Cloud Run 服务已经带有正确的运行配置。首次建立服务时，先由 Cloud Build 构建并推送镜像，再用对应镜像创建服务：显式指定专用运行账号、下表环境变量、Chat 的 Secret 引用，以及公开 HTTP 入口。服务内部继续验证用户 JWT。

不要将未经配置的空服务直接交给更新流水线：服务不存在时，`gcloud run deploy` 会尝试使用默认 Compute 账号，构建身份未获其 actAs 权限；即使增加这一权限，也仍缺少业务环境变量。应完成服务初始化，随后运行正常触发器验证更新。已完成初始化的日常发布无需重复这些步骤。

## 支付发布配置

NOWPayments 正式 API 可在 main 本地开发联调；它与 Git production 分支及 Supabase 生产库是独立选择。当前供应商默认 production。合并分支只发布代码，不会上传被忽略的 api/.env，也不会自动创建支付表或定时任务。2026-10-07 已准备生产支付 SQL、受限签名身份和 Secret Manager；发布时仍须验证固定线上回调和外部对账调度，详见 [api/NOWPAYMENTS.md](../api/NOWPAYMENTS.md)。开发测试订单留在开发库，不能复制成线上用户权益。

## 运行配置

| 位置 | 生产配置 |
| --- | --- |
| API Cloud Run | NODE_ENV=production、SUPABASE_URL、SUPABASE_PUBLISHABLE_KEY、CORS_ORIGINS=正式网站 origin 与 folune-app://app |
| Chat Cloud Run | NODE_ENV=production、SUPABASE_URL、SUPABASE_PUBLISHABLE_KEY、ALLOWED_ORIGINS=正式网站 origin 与 folune-app://app、BUSINESS_API_BASE_URL=正式 API HTTPS 地址 |
| Secret Manager | DEEPSEEK_API_KEY，仅授权 Chat 运行身份读取，在容器启动时注入 |
| Cloudflare Pages Production | VITE_SUPABASE_URL、VITE_SUPABASE_PUBLISHABLE_KEY、VITE_API_BASE_URL、VITE_CHAT_BASE_URL，修改后重新构建 |

两个后端读取 Cloud Run 注入的 PORT；平台开放 HTTP 入口，业务接口仍通过 Supabase 用户 JWT 鉴权。Production 的 Supabase URL 与 Publishable key 必须在前端、API、Chat 保持同项目。Google OAuth 回调、Site URL、邮件与 Storage 配置属于各 Supabase 项目，不能从数据库迁移记录推断其就绪。

Chat 的生产入口仅开放 /health 及四个 /v1 业务路径，关闭 Mastra 默认 /api/agents、/api/workflows 等接口；本地 dev 不注册这一限制。

当前 API 为 1 vCPU / 512 MiB、并发 80、请求超时 300 秒；Chat 为 1 vCPU / 1 GiB、并发 20、请求超时 900 秒。两者最小实例数为 0、最大为 3；空闲可缩到零，首次请求可能有冷启动。Chat 通过 Secret Manager 的 `folune-deepseek-api-key:latest` 注入 DEEPSEEK_API_KEY。

Production Supabase 的 Site URL 为 `https://folune.huxi7.com`，重定向白名单为 `https://folune.huxi7.com/auth/callback`；Google 登录已启用。更换登录提供商或调整邮件、Storage 时，仍需单独核实对应服务配置。

GitHub OAuth App 与两库 Provider 已配置，代码沿用 Google 的 PKCE 链路。多个账号匹配时通过登录选择与官方身份绑定继续，两库已启用手动关联；验收与发布边界见 [OAUTH.md](OAUTH.md)。

## 发布与验证

先检查生产镜像的 /health、业务接口无 token 的 401、CORS 与实际业务链路，再将验证后的代码从 main 合入 production。Cloudflare 和 Cloud Build 独立触发，不保证完成顺序；跨层变化必须兼容旧版本，或按数据库迁移、后端、前端分步发布。

待发布代码在 main 验证并提交、工作区干净且 main 已推送后，逐条执行；任一步失败先处理原因，不继续发布：

```sh
git fetch origin
git switch production
git merge --ff-only origin/production
git merge --ff-only main
git push origin production
git switch main
```

推送后在 Pages 检查 Production 构建，在 Cloud Build 检查两个触发器的构建；三个构建都应对应这次 production 提交。更新镜像会保留运行账号、变量、密钥和资源限制。无需切换本机 `.env`，也无需本机打包或上传镜像。

可以只重跑失败的后端触发器；以下命令发布 production 分支当前版本：

```sh
gcloud builds triggers run folune-api-production --project=folune7 --region=asia-southeast1 --branch=production
gcloud builds triggers run folune-chat-production --project=folune7 --region=asia-southeast1 --branch=production
```

需要回退时，Cloud Run 可将流量切回此前健康修订，Pages 可回退到此前 Production 部署；随后在 main 修复或 revert，并将修复合入 production，避免下一次自动发布重新引入问题。代码回退不会自动回滚数据库。

容器构建不执行数据库 SQL。api/supabase 中包含历史、回滚及开发种子脚本，禁止整目录自动执行；两库现有迁移基线须单独对齐后才能启用增量迁移。构建成功只证明镜像可用，正式业务验收还须验证 Production 用户登录、读写与 AI。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
