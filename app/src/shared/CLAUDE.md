# app/src/shared/
> L2 | 父级: ../../CLAUDE.md

成员清单
.gitkeep: 保留前端共享层空目录
CLAUDE.md: 记录前端共享层职责与文档协议
design-system/: 本地 design system 目录，承载 icons.tsx 图标语言边界、components/ 基础组件、统一 Skeleton/延迟显示策略、SuperNote AI ThinkingMark Formation Motion、互斥 AI Activity 家族与 index.css token 使用规则
api/: 唯一业务 HTTP 中枢与资源 API 目录，统一 Bearer 注入、响应信封、错误语义和后端 DTO 映射
store/: Zustand 轻量备忘录树与按 ID 正文两个正交状态源、不可变树算法、按用户 WorkspaceChromeState 与 AgentPanel 权限薄状态；结构/正文分别承载乐观事务、失败回滚和旧响应保护，聊天消息不得进入 Store
supabase/: 纯 Supabase Auth 目录，隔离 SDK、环境变量、PKCE、OTP、OAuth 与请求期 access token 读取
theme/: 全局主题状态目录，承载 ThemeProvider、system/light/dark 用户偏好、系统外观监听与浏览器持久化

职责: 前端共享层，承载唯一业务 API 边界、Zustand 业务/薄 UI 状态、本地设计系统、Supabase 认证基础设施与全局主题；业务 UI 禁止裸写 fetch 或调用 Supabase 数据 API，memo 请求进入 api/，AI 对话由 widgets/AgentPanel 的独立 transport 进入 chat 服务，memo 结构与正文变更分别进入对应 store/。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
