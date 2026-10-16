# app/src/app/router/
> L2 | 父级: ../CLAUDE.md

成员清单
WorkspaceEntryTransition.test.tsx: 真实加载层与 Store 的 DOM 生命周期回归，验证进度、inert、底层实例/草稿保留及完成/失败卸载
WorkspaceEntryTransition.tsx: 只使用 Folune SVG 字标的根级品牌加载层，跨 loader 与页面装配保持同一实例；真实进度轻弹推进，100% 后等待 640ms 落定再以 1.8s 鲜艳斜纹彩光单次揭幕，加载期 inert 隔离底层，减少动态只淡出
index.tsx: 桌面仅装配登录/OAuth/工作区，编译期排除营销路由；Web 按需加载公开页面且保留原导航；初始及已提交路由同步根级视觉作用域，loader 等待期间不提前换肤；React Router 路由表，共享 MarketingLayout 的首页、懒加载 /pricing、/login、/terms、/privacy、/blog 与 /updates；价格与法律页无需账号且独立于博客 URL；旧 auth=login 查询和未认证工作区统一导航到 /login。/app loader 并行取得 Profile 与轻量 memo tree，Dashboard 直接消费 bootstrap；`/app/subscription`（含 `/app/subscription/credits` 积分弹窗）与笔记共用父级 loader/Dashboard，独立地址支持直达与刷新；会话/账户/目录/代码节点推进同一次入口，失败/取消立即释放。Web DEV 顶级 /design-system 独立懒加载，不装配登录守卫或业务 loader，并共用 APP 根级主题；生产与桌面不装配。DEV /loading-lab 亦独立懒加载；无结构的代码加载只保留语义 busy。

职责: 路由装配层，连接营销页面、登录、OAuth、Dashboard 与 DEV 独立 Design System/实验页；详情路由在 node_type 未知时保持空间中性。Supabase 只建立会话，/app 是否可进入由后端 Profile 决定，memo/canvas/订阅 URL 与业务数据完全走后端 API。DEV 陈列页不跨越生产状态边界。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
