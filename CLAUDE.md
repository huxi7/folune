# SuperNote - AI 自动归档的备忘录软件
SuperNote 是面向需要长期积累备忘录的用户的 AI Native 备忘录软件，解决随手记录后难以分类、检索和维护文件树的问题。

## 本质
SuperNote 的本质不是普通文本收纳，而是把“随手写”转化为“自动有序沉淀”。

用户只负责记录；V2 在消息级冻结当前笔记与 @引用，以独立审批 Agent、账号权限模式、revision 和可撤销命令台账安全维护文件 tree，不在每次 autosave 时自动运行模型。

## 商业模式
订阅制。

价格梯度:
- 5 美金: 入门订阅
- 20 美金: 进阶订阅
- 100 美金: 高阶订阅

## AI 角色
AI 是用户的备忘录协作伙伴与智能档案管理员。

普通问答、写作、改写、规划与整理应按用户指令直接完成；用户要求原样收纳时保持内容保真，要求创作或编辑时允许生成新内容。需要保存备忘录时，AI 判断内容主题并分配到相关文件夹；当现有文件夹不合适时，AI 有权根据主题创建新文件夹，使文件 tree 随内容自然生长。

## 技术栈
全栈 TypeScript，顶层由三个 L1 业务模块组成。

- app: 用户端，Bun + Vite + React + React Router + Zustand + Motion for React + Vercel AI SDK + Mastra Client + canvas-confetti 独立全屏渲染 + Kumo UI + Tailwind CSS v4 + 本地 design system + Supabase Auth SDK
- chat: AI 能力服务，Bun + TypeScript + Mastra + Vercel AI SDK + zod，主 Agent 与无工具/无记忆审批 Agent 分离，模型只看到四个胖工具
- api: 业务接口服务，Bun + Hono + TypeScript + zod + Supabase REST/PostgREST/Storage HTTP API

## 模块地图
| 模块 | 职责 | 文档 |
| --- | --- | --- |
| app | 用户端，以 Paper First 舞台承载唯一写作主体与按需文件库/AI 思考空间，并以唯一 @Prompt Bar 统一上下文、后端确认权限、Worker 纯规划、命令投影与整轮撤销 | [app/CLAUDE.md](app/CLAUDE.md) |
| chat | AI 能力服务，冻结消息上下文，协调独立审批 Agent 与 Mastra 原生 approval，同轮工具/审批续写复用 assistant，只向模型暴露 read_tree/read_memo/edit_memo/edit_node | [chat/CLAUDE.md](chat/CLAUDE.md) |
| api | 业务接口服务，承载用户、备忘录、AI 会话/上下文/权限设置/通用命令/整理 Run 与唯一持久化边界 | [api/CLAUDE.md](api/CLAUDE.md) |
| deploy | 本地部署基础设施，提供 api/chat 的 Bun 开发镜像、固定容器命名与密钥分离契约 | [deploy/CLAUDE.md](deploy/CLAUDE.md) |
| scripts | 本地开发运维入口，统一启动、停止与查看 api-dev/chat-dev 双服务 Docker 日志 | [scripts/CLAUDE.md](scripts/CLAUDE.md) |

## 根配置
| 文件 | 职责 |
| --- | --- |
| .dockerignore | 收窄 api/chat 开发镜像的仓库根构建上下文，排除源码、缓存、密钥与无关模块 |
| .env.example | app/api/chat 无密钥变量总览与根 Compose 可选覆盖模板；服务默认使用各自本地环境文件 |
| .gitignore | 根级本地环境、构建缓存与系统文件忽略规则 |
| docker-compose.dev.yml | 从各模块私有 `.env` 注入凭据并编排 api-dev/chat-dev 双服务、独立健康探针、依赖卷与共享网络；chat 直启 Mastra CLI 以保证容器停止时释放开发锁 |
| AI_NATIVE_V1_PRD.md | AI Native V1 的产品目标、锁定边界、实施阶段、测试计划与持续完成状态 |
