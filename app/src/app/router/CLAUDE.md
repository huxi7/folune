# app/src/app/router/
> L2 | 父级: ../CLAUDE.md

成员清单
WorkspaceEntryTransition.test.tsx: 真实加载层与 Store 的 DOM 生命周期回归，验证进度、inert、底层实例/草稿保留及完成/失败卸载
WorkspaceEntryTransition.tsx: 只使用 Folune SVG 字标的根级品牌加载层，跨 loader 与页面装配保持同一实例；真实进度轻弹推进，100% 后等待 640ms 落定再以 1.8s 鲜艳斜纹彩光单次揭幕，加载期 inert 隔离底层，减少动态只淡出
index.tsx: 初始及已提交路由同步根级视觉作用域，loader 等待期间不提前换肤；React Router 路由表，共享 MarketingLayout 的首页、懒加载 /login、/blog 与 /updates；旧 auth=login 查询和未认证工作区统一导航到 /login。/app loader 仍并行取得 Profile 与轻量 memo tree，Dashboard 直接消费 bootstrap；会话/账户/目录/代码节点推进同一次入口，失败/取消立即释放；OAuth 和 DEV 实验路由边界保留，不引入第二套认证或动态 Outlet 壳。

职责: 路由装配层，连接 MarketingLayout/LandingPage/BlogPage 与懒加载的 LoginPage/AuthCallbackPage/AppDashboard/ColorLabPage/ArchiveCordLabPage；详情路由在 node_type 未知时保持空间中性。Supabase 只建立会话，/app 是否可进入由后端 Profile 决定，memo/canvas URL 与业务数据完全走后端 API，Color Lab 与 Archive Cord Lab 都不跨越生产状态边界。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
