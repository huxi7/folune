# SuperNote - AI 自动归档的备忘录软件
SuperNote 是面向需要长期积累备忘录的用户的 AI Native 备忘录软件，解决随手记录后难以分类、检索和维护文件树的问题。

## 本质
SuperNote 的本质不是普通文本收纳，而是把“随手写”转化为“自动有序沉淀”。

用户只负责记录。系统在消息级冻结当前笔记、@引用与 revision，由无工具无记忆的独立审批 Agent 和账号权限模式裁决写操作，以可撤销命令台账安全维护文件 tree。模型只在用户显式发送消息或触发整理时运行，autosave 不唤醒模型。

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
全栈 TypeScript，顶层由三个业务模块组成。

- app: 用户端，Bun + Vite 8 + React 19 + React Router 7 + Zustand 5 + Motion for React 12 + CodeMirror 6/Lezer Markdown + react-markdown/remark/rehype-sanitize + Vercel AI SDK 6 (`@ai-sdk/react`) + `@mastra/client-js` + react-archer 5.1 + canvas-confetti + Kumo UI 2 + Tailwind CSS v4 + 本地 design system + Lucide React + Supabase Auth SDK
- chat: AI 能力服务，Bun + Mastra 1.57 + `@mastra/ai-sdk` + Vercel AI SDK 6 + zod 4；模型白名单只含 DeepSeek V4 Flash 且拒绝任何切换；对话/审批/整理三个 Agent 分离，模型只见 read_tree/read_memo/edit_memo/edit_node 四个胖笔记工具与 celebration
- api: 业务接口服务，Bun + Hono 4 + zod 4 + Supabase REST/PostgREST/Storage HTTP API；只以用户 JWT 访问数据，禁止 service role、连接串与 ORM

## 运行形态
app 跑在本机 Bun/Vite 固定 10000；api 与 chat 由根 Compose 编排为 api-dev(10001)/chat-dev(10002)，各自持有独立健康探针与被 Git 忽略的私有 `.env`。chat 依赖 api 健康后启动，容器内经 `http://api:10001` 访问业务 API；浏览器只接收 `VITE_` 前缀的公开配置。

## 模块地图
| 模块 | 职责 | 文档 |
| --- | --- | --- |
| app | 用户端，以 Paper First 舞台承载唯一常驻写作主体与按需文件库/AI 思考空间；轻量目录与按 ID 正文缓存分离，唯一 @Prompt Bar 冻结上下文，Web Worker 只做纯规划，主线程乐观投影并把命令提交给 api，支持按执行逆序的整轮撤销 | [app/CLAUDE.md](app/CLAUDE.md) |
| chat | AI 能力服务，冻结消息上下文；memo-agent 负责对话，无工具/无记忆的 approval-agent 独立裁决写审批，organize-planner-agent 与 organize-memo Workflow 规划整理；同轮工具/审批续写复用同一 assistant，暴露 GET /health、POST /v1/chat、POST /v1/organize | [chat/CLAUDE.md](chat/CLAUDE.md) |
| api | 业务接口服务，承载用户 profile、轻量备忘录 tree/正文按 ID 读取与关键词命中摘要、回收站、AI 会话/冻结上下文/权限设置/可撤销 Command/整理 Run；经 owner-only RLS 与原子 RPC 构成唯一持久化边界 | [api/CLAUDE.md](api/CLAUDE.md) |
| deploy | 本地部署基础设施，提供 api/chat 的 Bun 开发镜像、固定容器命名与密钥分离契约 | [deploy/CLAUDE.md](deploy/CLAUDE.md) |
| scripts | 本地开发运维入口，统一启动、停止与查看 api-dev/chat-dev 双服务 Docker 日志 | [scripts/CLAUDE.md](scripts/CLAUDE.md) |

## 根配置
| 文件 | 职责 |
| --- | --- |
| .dockerignore | 收窄 api/chat 开发镜像的仓库根构建上下文，排除源码、缓存、密钥与无关模块 |
| .env.example | app/api/chat 无密钥变量总览与根 Compose 可选覆盖模板；服务默认使用各自本地环境文件 |
| .gitignore | 根级本地环境、构建缓存与系统文件忽略规则 |
| docker-compose.dev.yml | 从各模块私有 `.env` 注入凭据并编排 api-dev/chat-dev 双服务、独立健康探针、依赖卷与共享网络；集中维护整理自动应用置信阈值，chat 启动前清理容器 PID 复用导致的陈旧 Mastra 开发锁，并直启 CLI 接收停止信号 |
