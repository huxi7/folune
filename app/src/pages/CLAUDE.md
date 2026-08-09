# app/src/pages/
> L2 | 父级: ../../CLAUDE.md

成员清单
.gitkeep: 保留页面层空目录
CLAUDE.md: 记录页面层职责与文档协议
LandingPage.tsx: / 路由页面，组合顶边贴视口且背景全宽的粘性 Header、紧贴其下并约为 Header 2/3 高的全宽随页 Announcement、与正文 1088px 主轨对齐且仅在 1200px+ 精细指针桌面按边缘到主轨距离 1/5 补充外轨的开放横向骨架、正文 BlueprintFrame RailLayer、显式 14px/贴边 Divider、纯白 Hero、懒加载 LandingSections，并让无末端节点的正文竖轨直接承接无导轨的全宽深蓝 Fat Footer
AuthCallbackPage.tsx: /auth/callback 路由页面，交换 Google OAuth PKCE code，成功进入 /app，失败提供返回登录入口；会话 Spinner 在 reduced-motion 下静止
AppDashboard.tsx: 消费路由 Profile/access token 的 /app 编排层；在删除当前 Memo/祖先前等待 autosave required flush，成功后停止旧会话、清理用户级 last-memo、选择下一 Memo 或 /app，并把 soft delete/restore 响应直接合并唯一 Store
memoDeletion.ts: 删除导航纯算法，判定当前编辑 Memo 是否落在待删 subtree，并从剩余 active tree 选择下一路由
memoDeletion.test.ts: 覆盖删除当前 Memo/祖先影响判定及有/无下一 Memo 的路由选择

职责: 页面层，承载 URL 级 Landing、OAuth 回调与受保护 Dashboard 页面边界。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
