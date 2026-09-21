# app/src/app/router/
> L2 | 父级: ../CLAUDE.md

成员清单
index.tsx: React Router 路由表，声明共享 MarketingLayout 的首页、/blog、/updates 两个独立目录与各自 :slug 阅读页，共用 BlogPage、OAuth、受保护 /app 及共享笔记/Canvas 详情；/app loader 并行取得 Profile 与轻量 memo tree，Dashboard 直接消费 bootstrap，避免准入后重复请求目录；DEV 额外暴露无业务写入的 /color-lab、/archive-cord-lab 与 /motion-lab。全局页面切换使用 Router 原生 View Transition，不添加以动态 Outlet 延迟卸载的第二路由壳。

职责: 路由装配层，连接 MarketingLayout/LandingPage/BlogPage 与懒加载的 AuthCallbackPage/AppDashboard/ColorLabPage/ArchiveCordLabPage；详情路由在 node_type 未知时保持空间中性。Supabase 只建立会话，/app 是否可进入由后端 Profile 决定，memo/canvas URL 与业务数据完全走后端 API，Color Lab 与 Archive Cord Lab 都不跨越生产状态边界。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
