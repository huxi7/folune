# app/src/shared/
> L2 | 父级: ../../CLAUDE.md

成员清单
.gitkeep: 保留前端共享层空目录
CLAUDE.md: 记录前端共享层职责与文档协议
design-system/: 本地 design system 目录，承载 icons.tsx 图标语言边界、components/ 基础组件、统一 Skeleton/延迟显示策略、Folune AI ThinkingMark Formation Motion、互斥 AI Activity 家族与 index.css token 使用规则
api/: 唯一业务 HTTP 中枢与资源 API 目录，统一 Bearer 注入、响应信封、错误语义和后端 DTO 映射；订阅目录/概览/结账在此收口，BillingProvider 仅在当前 Dashboard 用户边界共享内存快照
store/: Zustand树/正文状态、命名规则、按用户Paper文件库与跨空间助手薄状态、按画布文件库偏好与Agent权限；聊天消息仍留在会话组件
desktop/: 可选 preload 能力、退出保存注册表与官网平台/架构判断；不引入 Node 到 Web
supabase/: 纯 Supabase Auth 目录，隔离 SDK、环境变量、PKCE、OTP、OAuth 与请求期 access token 读取
locale/: 简中/英文界面偏好，统一文案、Intl 日期数字及 html.lang；展示入口与持久化 Provider 分离，只有正式入口装配浏览器偏好，独立 Demo 默认中文且不依赖存储
theme/: 全局主题状态目录，承载 ThemeProvider、system/light/dark 用户偏好、系统外观监听、浏览器持久化与已提交路由的根级视觉场景同步

职责: 前端共享层，承载唯一业务 API 边界、Zustand 业务/薄 UI 状态、本地设计系统、Supabase 认证基础设施、全局主题与语言；业务 UI 禁止裸写 fetch 或调用 Supabase 数据 API，memo 请求进入 api/，AI 对话由 widgets/AgentPanel 的独立 transport 进入 chat 服务，memo 结构与正文变更分别进入对应 store/。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
