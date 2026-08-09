# api/src/service/
> L2 | 父级: ../../CLAUDE.md

成员清单
CLAUDE.md: 记录业务服务层职责与文档协议
auth.service.ts: 将 router 提取的用户 access token 转换为经 Supabase Auth 校验的可信 AuthUser
health.service.ts: 提供不依赖 Hono Context 的健康状态用例
memo.service.ts: 以内存邻接表组装 active tree 或 RPC 返回的 detached restored subtree，编排 CRUD、父类型/防环规则与正文派生统计
memo-trash.service.ts: 回收站业务规则层，筛选已删除祖先下不可见的删除根、生成原路径/摘要，并把软删、恢复、永久删除、清空 RPC 状态映射为稳定 404/409
profile.service.ts: 以 Web Crypto 生成单一默认 username 与头像 UUID 路径，执行幂等建档、owner 校验、5MB/JPEG-PNG-WebP 签名验证、avatar_url CAS、失败补偿与旧 Storage 对象清理

职责: 业务编排与权限判断层；禁止依赖 Hono Context，数据访问通过 repository，token 禁止记录、返回或持久化。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
