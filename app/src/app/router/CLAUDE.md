# app/src/app/router/
> L2 | 父级: ../CLAUDE.md

成员清单
index.tsx: React Router 路由表，声明 /、/auth/callback、/app 与 /app/notes/:noteId；/app loader 读取 Supabase Auth access token 并以 GET /profile 验证后端准入，直接首屏等待只绘制唯一 Paper Skeleton，详情子路由共享 Dashboard/Store 生命周期，整树 GET 由 Dashboard 进入时发起

职责: 路由装配层，连接 LandingPage 与懒加载的 AuthCallbackPage/AppDashboard；只有主体结构明确且无可保留内容的 /app 首次准入使用页面级 Skeleton，Supabase 只建立会话，/app 是否可进入由后端 Profile 决定，memo URL 与业务数据完全走后端 API。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
