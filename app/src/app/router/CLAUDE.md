# app/src/app/router/
> L2 | 父级: ../CLAUDE.md

成员清单
index.tsx: React Router 路由表，声明 /、/auth/callback、/app 与共享 `/app/notes/:noteId`，仅在 DEV 暴露无鉴权、无业务写入的 /color-lab 与 /archive-cord-lab（归档线必须能被真实浏览器打开并真的用鼠标操作，否则「端点跟手」就只剩静态字符串测试在替它作证）；/app loader 读取 Supabase Auth access token 并以 GET /profile 验证后端准入。详情深链在 node_type 确认前只绘制中性全屏面，随后由同一 Dashboard 生命周期进入 Paper 或 Canvas

职责: 路由装配层，连接 LandingPage 与懒加载的 AuthCallbackPage/AppDashboard/ColorLabPage/ArchiveCordLabPage；详情路由在 node_type 未知时保持空间中性。Supabase 只建立会话，/app 是否可进入由后端 Profile 决定，memo/canvas URL 与业务数据完全走后端 API，Color Lab 与 Archive Cord Lab 都不跨越生产状态边界。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
