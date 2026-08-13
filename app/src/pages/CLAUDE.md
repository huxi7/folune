# app/src/pages/
> L2 | 父级: ../../CLAUDE.md

成员清单
.gitkeep: 保留页面层空目录
CLAUDE.md: 记录页面层职责与文档协议
LandingPage.tsx: / 路由页面，组合顶边贴视口且背景全宽的粘性 Header、紧贴其下并约为 Header 2/3 高的全宽随页 Announcement、与正文 1088px 主轨对齐且仅在 1200px+ 精细指针桌面按边缘到主轨距离 1/5 补充外轨的开放横向骨架、正文 BlueprintFrame RailLayer、显式 14px/贴边 Divider、纯白 Hero、懒加载 LandingSections，并让无末端节点的正文竖轨直接承接无导轨的全宽深蓝 Fat Footer
AuthCallbackPage.tsx: /auth/callback 路由页面，交换 Google OAuth PKCE code，成功进入 /app，失败提供返回登录入口；会话 Spinner 在 reduced-motion 下静止
AppDashboard.tsx: 消费路由 Profile/access token 的 /app 编排层；组合稳定客户端备忘录身份与 Paper First 舞台，为人工/Agent/整理建立 flush 边界，按 Run 状态唤醒文件库或 AI，并把 soft delete/restore/Run 响应局部合并唯一 Store
appDashboardTypes.ts: Dashboard 私有状态类型边界，集中定义 loader、账户/文件夹弹窗、标题草稿与树加载状态，不承载运行时逻辑
memoDeletion.ts: 删除导航纯算法，判定当前编辑 Memo 是否落在待删 subtree，并从剩余 active tree 选择下一路由
memoDeletion.test.ts: 覆盖删除当前 Memo/祖先影响判定及有/无下一 Memo 的路由选择
useOptimisticMemoCreation.ts: 人工新建路由协调器；同步进入临时备忘录并独立跟踪每个并发提交，乱序成功只替换自己的 ID，失败只撤销对应节点并在仍处当前页时回退
useMemoOrganize.ts: AI 整理生命周期协调器；发送前 required flush，按用户恢复最近 Run，编排 plan/apply/reject/undo，并把成功或撤销结果局部归并到 Memo Store、把 stale 诚实反馈给用户
useMemoOrganize.test.ts: 锁定 succeeded/undone 唤醒文件库、awaiting_confirmation 唤醒 AI、stale/failed/过程态不强迫打开工具
organizePresentation.ts: 整理 Run 到 Workspace 工具唤醒目标的无副作用策略，隔离 Hook 与测试依赖
workspaceLayout.ts: Paper First 浮层几何与宽度持久化边界，集中维护文件库/AI 尺寸约束、CSS 变量类型和 localStorage 校验
workspaceMotion.ts: 工作台唯一 Motion 配置，冻结 panelSpring、paperSpring 与 fadeTransition，供 Paper/Panel/连线/回执统一消费

职责: 页面层，承载 URL 级 Landing、OAuth 回调与受保护 Dashboard 页面边界。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
