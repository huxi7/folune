# app/src/app/
> L2 | 父级: ../../CLAUDE.md

成员清单
.gitkeep: 保留应用装配层空目录
CLAUDE.md: 记录应用装配层职责与文档协议
router/: React Router 路由装配目录，暴露用户端路由表与仅用于 /app 首次准入的精确三 Panel Skeleton fallback

职责: 应用装配层，承载用户端路由壳、后端身份准入与 `/app/notes/:noteId` 详情地址装配边界；文件树加载归 Dashboard Zustand Store。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
