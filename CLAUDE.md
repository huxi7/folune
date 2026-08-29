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

- app: 用户端，Bun + Vite 8 + React 19 + React Router 7 + Zustand 5 + Motion for React 12 + @xyflow/react 12 + CodeMirror 6/Lezer Markdown + react-markdown/remark/rehype-sanitize + Vercel AI SDK 6 (`@ai-sdk/react`) + `@mastra/client-js` + react-archer 5.1 + canvas-confetti + Kumo UI 2 + Tailwind CSS v4 + 本地 design system + Lucide React + Supabase Auth SDK
- chat: AI 能力服务，Bun + Mastra 1.57 + `@mastra/ai-sdk` + Vercel AI SDK 6 + zod 4；模型白名单只含 DeepSeek V4 Flash 且拒绝任何切换；对话/审批/整理三个 Agent 分离，模型只见 read_tree/read_memo/edit_memo/edit_node 四个胖笔记工具与 celebration
- api: 业务接口服务，Bun + Hono 4 + zod 4 + Supabase REST/PostgREST/Storage HTTP API；只以用户 JWT 访问数据，禁止 service role、连接串与 ORM

## 运行形态
app 跑在本机 Bun/Vite 固定 10000；api 与 chat 由根 Compose 编排为 api-dev(10001)/chat-dev(10002)，各自持有独立健康探针与被 Git 忽略的私有 `.env`。chat 依赖 api 健康后启动，容器内经 `http://api:10001` 访问业务 API；浏览器只接收 `VITE_` 前缀的公开配置。

## Canvas V2
Canvas V2 是一级持久知识 Workspace：memo 的默认 Canvas 与 standalone Canvas 从创建、增量拓展、自动保存到重开始终使用同一 `memo_nodes.id === canvases.node_id` 身份。人工编辑与 AI expansion 共用带 version、mutation_id 和 receipt 的唯一原子 mutation 内核；浏览器先把 intent 写入 IndexedDB WAL，再串行提交并在冲突时保留意图重放。旧 Explore 生产入口和旧 HTTP 写路径已经移除，旧 SQL 函数只作为显式代码回滚面保留且 V2 运行期无执行权。目标契约见 [CANVAS_V2_CONTRACT.md](CANVAS_V2_CONTRACT.md)，MVP 外方向见 [CANVAS_V2_PHASE2_BACKLOG.md](CANVAS_V2_PHASE2_BACKLOG.md)。

## 模块地图
| 模块 | 职责 | 文档 |
| --- | --- | --- |
| app | 用户端，以 Paper First 舞台承载写作与共享左右工具；Canvas 路由切换到始终挂载同一 React Flow 实例的独立 Workspace，支持 memo Picker、预览/返回、自由文字、连接/删除/拖拽/缩放、显式 AI 增量拓展与可靠自动保存；服务端文档、交互会话、WAL/传输状态分别收口且正文只按 memo ID 读取 | [app/CLAUDE.md](app/CLAUDE.md) |
| chat | AI 能力服务，冻结消息上下文；对话、审批、整理与逐篇关联判断职责分离；Canvas expansion 只从 api 重取可信 context/正文/语料版本，复用 Explore 判断和逐字引文复核后返回候选，最终写入仍由浏览器经 api 统一 mutation 提交 | [chat/CLAUDE.md](chat/CLAUDE.md) |
| api | 业务接口服务，承载 profile、memo、回收站、AI 状态机与 Canvas V2 默认/空白入口、无正文图读取、expansion context、人工/AI 共用 mutation；owner-only RLS、行锁、version、稳定 intent digest、receipt、原子 checkpoint 与同父同类型标题唯一索引共同构成唯一持久化边界，重名与默认画布标题跟随都由数据库裁决 | [api/CLAUDE.md](api/CLAUDE.md) |
| deploy | 本地部署基础设施，提供 api/chat 的 Bun 开发镜像、固定容器命名与密钥分离契约 | [deploy/CLAUDE.md](deploy/CLAUDE.md) |
| scripts | 本地开发运维入口，统一启动、停止与查看 api-dev/chat-dev 双服务 Docker 日志 | [scripts/CLAUDE.md](scripts/CLAUDE.md) |

## 根配置
| 文件 | 职责 |
| --- | --- |
| CANVAS_V2_CONTRACT.md | Canvas V2 产品目标真相源与常驻门禁；冻结一级持久 Workspace、同构画布、显式 AI、增量图、添加/连接/自由文字、自动保存及 MVP 边界，并以第 16 节十条宪法级验收问题约束后续任何改动。状态已收口为 MVP 已落地，Phase 2 未开始 |
| CANVAS_V2_PHASE2_BACKLOG.md | MVP 后增强方向清单；记录 MiniMap、文件库拖入、整理/Undo、导航与视觉打磨，其中被 MVP 顺带交付的部分已就地标注段次。它明确不是 Plan 2，条目的保留/删除/合并须待新 Plan 会话基于真实代码与验收结果裁决 |
| .dockerignore | 收窄 api/chat 开发镜像的仓库根构建上下文，排除源码、缓存、密钥与无关模块 |
| .env.example | app/api/chat 无密钥变量总览与根 Compose 可选覆盖模板；服务默认使用各自本地环境文件 |
| .gitignore | 根级本地环境、构建缓存与系统文件忽略规则 |
| .mcp.json | 团队共享的 Supabase MCP 接入声明。八个 feature 组全开（account/branching/database/debugging/development/docs/functions/storage）；**无 `project_ref`** 故 account 组可用、作用域为账号下全部项目；**无 `read_only`** 故具备完整写能力。`[决策: 所有者 · 2026-08-23]` —— 「api 是唯一持久化边界」对**运行时代码**依然绝对有效，MCP 写能力仅是部署与运维动作的通道，不构成绕过 api 读写业务数据的许可。文件不含密钥，OAuth 凭据留在本地 keychain |
| docker-compose.dev.yml | 从各模块私有 `.env` 注入凭据并编排 api-dev/chat-dev 双服务、独立健康探针、依赖卷与共享网络；集中维护整理自动应用置信阈值，chat 启动前清理容器 PID 复用导致的陈旧 Mastra 开发锁，并直启 CLI 接收停止信号 |
