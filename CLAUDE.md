# Folune - AI 自动归档的备忘录软件
Folune 是面向需要长期积累备忘录的用户的 AI Native 备忘录软件，解决随手记录后难以分类、检索和维护文件树的问题。

项目、品牌、软件包、运行标识与部署命名统一为 Folune；服务 API 路径和 Supabase 项目引用继续承担既有连接契约。品牌母图与展示契约见 app/brand-spec.md。

## 本质
Folune 的本质不是普通文本收纳，而是把“随手写”转化为“自动有序沉淀”。

用户只负责记录。系统在消息级冻结当前笔记、@引用与 revision，账号权限默认完全访问并保留用户后续明确选择；智能审批模式才调用无工具无记忆的独立审批 Agent。发送须等当前账号权限确认，初始化不得覆盖已保存选择；所有写操作仍经可撤销命令台账维护文件 tree。模型只在用户显式发送消息或触发整理时运行，autosave 不唤醒模型。

## 商业模式
订阅与积分直购并存。

价格梯度:
- 5 美金: 入门订阅
- 20 美金: 进阶订阅
- 100 美金: 高阶订阅

积分统一为1积分=10,000 Token，日额度为Free 10、Starter 200、Pro 1,000、Studio 5,000积分；订阅按月/年收费、权益每日刷新，不另计对话次数或虚构月到账额度。菜单/设置/订阅共用服务端积分事实，余额最多显示一位小数且不足0.1保留阈值提示。

独立订阅地址 `/app/subscription` 与积分弹窗共用服务端目录/余额。NOWPayments 统一订单、Invoice、验签查单、事务幂等发放/退款、管理审计与独立对账组成唯一支付路径；订阅周期顺延，每日赠送优先消耗。生产支付表与受限服务身份已于 2026-10-07 准备，发布版本为 v1.2.0；开售须在新版 API/Chat 和外部对账就绪后启用。普通汇率支持正式 $5 USDT/BSC Invoice，其他网络最低额由供应商裁决；真实转账到账尚未验证。前端一次点击自动打开收银台，返回焦点主动核对并刷新权益。部署凭据、轮换与验收边界见 [api/NOWPAYMENTS.md](api/NOWPAYMENTS.md)。

## AI 角色
AI 是用户的备忘录协作伙伴与智能档案管理员。

普通问答、写作、改写、规划与整理应按用户指令直接完成；用户要求原样收纳时保持内容保真，要求创作或编辑时允许生成新内容。需要保存备忘录时，AI 判断内容主题并分配到相关文件夹；当现有文件夹不合适时，AI 有权根据主题创建新文件夹，使文件 tree 随内容自然生长。

## 技术栈
全栈 TypeScript，三个云端/Web 业务模块与独立 Electron 桌面宿主组成。

- app: 用户端，Bun + Vite 8 + React 19 + React Router 7 + Zustand 5 + Motion for React 12 + @xyflow/react 12 + CodeMirror 6/Lezer Markdown + react-markdown/remark/rehype-sanitize + Vercel AI SDK 6 (`@ai-sdk/react`) + `@mastra/client-js` + zod 4 + canvas-confetti + Kumo UI 2 + Tailwind CSS v4 + 本地 design system（含同源 Motion token 与完整入退场原语）+ Lucide React + Supabase Auth SDK
- chat: AI 能力服务，Bun + Mastra 1.57 + `@mastra/ai-sdk` + Vercel AI SDK 6 + zod 4；模型白名单只含 DeepSeek V4 Flash 且拒绝任何切换；对话/审批/整理三个 Agent 分离，模型只见 read_tree/read_memo/edit_memo/edit_node 四个原子笔记工具、明确清单的 edit_nodes 批量工具与 celebration
- api: 业务接口服务，Bun + Hono 4 + zod 4 + Supabase REST/PostgREST/Storage HTTP API；普通业务以用户 JWT 访问；支付仓储使用无 BYPASSRLS 的专用 folune_billing JWT，仅获支付/用量权限，禁止 service role、连接串与 ORM

认证分流：OAuth 无匹配建号、单账号匹配自动关联。多个账号匹配时，用户先登录目标账号，再确认绑定 GitHub。账号选择不枚举匿名候选，不合并笔记、余额或订阅。Supabase 两库启用官方手动关联能力。

## 运行形态
app 跑在本机 Bun/Vite 固定 10000；api 与 chat 由 folune Compose 项目编排为 folune-api-dev(10001)/folune-chat-dev(10002)，各自持有独立健康探针与被 Git 忽略的私有 `.env`。chat 依赖 api 健康后启动，容器内经 `http://api:10001` 访问业务 API；浏览器只接收 `VITE_` 前缀的公开配置。

同一组 Dockerfile 同时提供 dev 与 production 阶段：Compose 显式选择 dev，生产镜像包含运行代码或 Mastra 构建产物、以非 root 用户启动并读取平台 PORT。生产环境值由部署平台注入，镜像不包含本地 `.env`。

线上 app 由 Cloudflare Pages 从 production 分支构建；API/Chat 由同分支的两个 Cloud Build 触发器独立发布到 folune7 项目的 Cloud Run，三者连接同一个 Production Supabase。开发仍使用 main 与 Staging；正式地址、首次建服务要求和发布步骤见 [deploy/README.md](deploy/README.md)，实际发布状态以平台为准。

2026-09-02 app 形制投影：Paper 归档线由 fixed `ArchiveCordOverlay` 承载，不再依赖 react-archer；Canvas 连接临时绳与 Paper 归档 Overlay 都是 UI 层，正式持久化仍只经既有 app WAL/Coordinator/API 边界。

## Canvas V2
Canvas V2 是一级持久知识 Workspace：memo 默认 Canvas 与 standalone Canvas 使用同一身份和唯一原子 mutation 内核，浏览器先写 IndexedDB WAL，再串行提交并在冲突时重放。产品定律见 [CANVAS_CONSTITUTION.md](CANVAS_CONSTITUTION.md)；旧阶段规划只保留历史，不构成当前需求来源。

## 模块地图
| 模块 | 职责 | 文档 |
| --- | --- | --- |
| desktop | Electron + Forge 桌面宿主，复用 app；macOS arm64 DMG 与 Windows x64 Squirrel，私有源码构建、公开二进制发布 | [desktop/CLAUDE.md](desktop/CLAUDE.md) |
| .github | 桌面 Tag 构建与跨仓库 Release 发布，Web/后端仍沿原 production 分支发布 | [.github/CLAUDE.md](.github/CLAUDE.md) |
| app | 用户端，五栏设置与独立订阅页共用用户级计费快照；以 Paper First 舞台承载写作与共享左右工具；Canvas 路由切换到始终挂载同一 React Flow 实例的独立 Workspace，支持 memo Picker、预览/返回、自由文字、连接/删除/框选/整组移动/缩放、显式 AI 增量拓展与可靠自动保存；服务端文档、交互会话、WAL/传输状态分别收口，选择只有 React Flow 一个所有者，正文只按 memo ID 读取 | [app/CLAUDE.md](app/CLAUDE.md) |
| chat | AI 能力服务，冻结消息上下文；聊天流原样透传推理，APP 直接以纯文本将原始推理与真实工具进度交错展示，不添加摘要模型调用，明确批量请求由共享八并发队列执行且可停止，转圈与实际运行同构，完成记录一次展开，正文首分块触发前端一次性收起过程，不等待步骤结束；对话、审批、整理与逐篇关联判断职责分离；Canvas expansion 只从 api 重取可信 context/正文/语料版本，复用 Explore 判断和逐字引文复核后返回候选，最终写入仍由浏览器经 api 统一 mutation 提交 | [chat/CLAUDE.md](chat/CLAUDE.md) |
| api | 业务接口服务，承载 profile、服务端套餐目录、统一支付订单/账本/周期/审计与共享 AI 额度、memo、回收站、AI 状态机与 Canvas V2 默认/空白入口、无正文图读取、expansion context、人工/AI 共用 mutation；owner-only RLS、行锁、version、稳定 intent digest、receipt、原子 checkpoint 与同父同类型标题唯一索引共同构成唯一持久化边界，重名由数据库裁决；两种 Canvas 共用一条命名规则，标题不跟随任何东西 | [api/CLAUDE.md](api/CLAUDE.md) |
| deploy | 后端构建基础设施，提供 API/Chat 共用的开发与生产多阶段镜像及运行时配置隔离契约 | [deploy/CLAUDE.md](deploy/CLAUDE.md) |
| scripts | 本地开发运维入口，统一管理双服务 Docker 日志/生命周期，并复用 API 执行 NOWPayments 只读连接预检 | [scripts/CLAUDE.md](scripts/CLAUDE.md) |

## 根配置
| 文件 | 职责 |
| --- | --- |
| CANVAS_CONSTITUTION.md | Canvas 产品宪法与常驻门禁，回答「为什么不能」而不是「现在是什么」；冻结一级持久 Workspace、同构画布、显式 AI、增量图、添加/连接/自由文字、自动保存与产品边界，并以第 14 节十一条验收问题约束后续任何改动。它与 CLAUDE.md 职责相反：CLAUDE.md 必须跟随代码，本文件绝不跟随代码，因此只有它能指出实现走偏了。不含进度、不含实施计划 |
| CANVAS_V2_PHASE2_BACKLOG.md | 历史阶段清单，仅用于追溯当时取舍；已完成项与主动放弃项都不得被后续 Agent 自动还原成需求 |
| PAPER_CONSTITUTION.md | Paper 产品宪法与常驻门禁，与 CANVAS_CONSTITUTION.md 并列且同样绝不跟随代码。冻结 Stage/Paper/Panel 的三层关系（Panel 压在 Paper 上，因此 Paper 不参照 Panel 的顶部边界）、写作纸的开本比例与「短内容与 Panel 同构、长文只向下生长」、与纸同表面且不画底边线的 sticky 顶栏、整理作为唯一核心 AI 动作、只用文字标签表达层级并共享中性 Ghost 反馈、状态与动作分离，以及归档线「真实 memo → 结构可见代表 → viewport 边缘投影」的生命周期与渲染边界，并以第 8 节验收问题约束后续改动。视觉数值归 app/brand-spec.md，产品定律归本文件 |
| package.json | 桌面依赖安装、开发、打包与测试的根命令入口 |
| .dockerignore | 收窄后端镜像的仓库根构建上下文，允许生产源码，排除缓存、密钥与无关模块 |
| .env.example | app/api/chat 无密钥变量总览与根 Compose 可选覆盖模板；服务默认使用各自本地环境文件 |
| .gitignore | 根级本地环境、构建缓存、系统文件与未接入路由的图标研究页忽略规则 |
| .mcp.json | 团队共享的 Supabase MCP 接入声明。八个 feature 组全开（account/branching/database/debugging/development/docs/functions/storage）；**无 `project_ref`** 故 account 组可用、作用域为账号下全部项目；**无 `read_only`** 故具备完整写能力。`[决策: 所有者 · 2026-08-23]` —— 「api 是唯一持久化边界」对**运行时代码**依然绝对有效，MCP 写能力仅是部署与运维动作的通道，不构成绕过 api 读写业务数据的许可。文件不含密钥，OAuth 凭据留在本地 keychain |
| docker-compose.dev.yml | 固定 Compose 项目名、容器名、镜像网络和依赖卷前缀为 folune；从各模块私有 `.env` 注入凭据并编排 Folune API/Chat 双服务与独立健康探针；集中维护整理自动应用置信阈值，chat 启动前清理容器 PID 复用导致的陈旧 Mastra 开发锁，并直启 CLI 接收停止信号 |
