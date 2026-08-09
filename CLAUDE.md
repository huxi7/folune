# SuperNote - AI 自动归档的备忘录软件
SuperNote 是面向需要长期积累备忘录的用户的 AI Native 备忘录软件，解决随手记录后难以分类、检索和维护文件树的问题。

## 本质
SuperNote 的本质不是普通文本收纳，而是把“随手写”转化为“自动有序沉淀”。

用户只负责记录；系统负责在保存时理解主题、归入合适文件夹，并持续维护清晰的文件 tree。

## 商业模式
订阅制。

价格梯度:
- 5 美金: 入门订阅
- 20 美金: 进阶订阅
- 100 美金: 高阶订阅

## AI 角色
AI 是备忘录的智能档案管理员。

每次用户保存备忘录时，AI 需要判断内容主题并分配到相关文件夹；当现有文件夹不合适时，AI 有权根据主题创建新文件夹，使文件 tree 随内容自然生长。

## 技术栈
全栈 TypeScript，顶层由三个 L1 业务模块组成。

- app: 用户端，Bun + Vite + React + React Router + Zustand + Vercel AI SDK + Mastra Client + 备忘录规划 Web Worker + canvas-confetti 独立全屏渲染 + Kumo UI + Tailwind CSS v4 + 本地 design system + Supabase Auth SDK
- chat: AI 能力服务，Bun + TypeScript + Mastra + Vercel AI SDK + zod，当前 Agent 可在请求期调用由 app 执行的庆祝与备忘录客户端工具
- api: 业务接口服务，Bun + Hono + TypeScript + zod + Supabase REST/PostgREST/Storage HTTP API

## 模块地图
| 模块 | 职责 | 文档 |
| --- | --- | --- |
| app | 用户端，承载备忘录记录、浏览、文件 tree 交互及 SSE Agent 客户端工具体验；庆祝直达视觉执行器，备忘录工具由 Worker 规划后复用真人乐观 Store 链路 | [app/CLAUDE.md](app/CLAUDE.md) |
| chat | AI 能力服务，承载 Supabase JWT 保护的 Agent、SSE 接口与请求期注入的无 execute 客户端工具契约，不含记忆或业务库写入 | [chat/CLAUDE.md](chat/CLAUDE.md) |
| api | 业务接口服务，承载用户、备忘录、文件夹、订阅与数据持久化边界 | [api/CLAUDE.md](api/CLAUDE.md) |
| deploy | 本地部署基础设施，提供 api/chat 的 Bun 开发镜像、固定容器命名与密钥分离契约 | [deploy/CLAUDE.md](deploy/CLAUDE.md) |
| scripts | 本地开发运维入口，统一启动、停止与查看 api-dev/chat-dev 双服务 Docker 日志 | [scripts/CLAUDE.md](scripts/CLAUDE.md) |

## 根配置
| 文件 | 职责 |
| --- | --- |
| .dockerignore | 收窄 api/chat 开发镜像的仓库根构建上下文，排除源码、缓存、密钥与无关模块 |
| .env.example | app/api/chat 无密钥变量总览与根 Compose 可选覆盖模板；服务默认使用各自本地环境文件 |
| .gitignore | 根级本地环境、构建缓存与系统文件忽略规则 |
| docker-compose.dev.yml | 编排 api-dev/chat-dev 双服务、独立健康探针、依赖卷与共享网络；chat 直启 Mastra CLI 以保证容器停止时释放开发锁 |
