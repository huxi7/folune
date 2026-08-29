# api/test/support/
> L2 | 父级: ../CLAUDE.md

成员清单
CLAUDE.md: 记录测试替身层职责与文档协议
supabase-mock.ts: memo 域两组契约测试共用的内存 Supabase 替身；在测试进程内固定 NODE_ENV/SUPABASE 环境变量，提供 node/content fixture、带 Bearer 的请求构造器，以及按路径分派 /auth/v1/user、memo_nodes、memos、canvases 与 rpc/* 的 fetch mock。它忠实复刻远端的两条标题 partial 唯一索引（含规范化与 deleted_at 排除）并以 PostgREST 的 23505 载荷驳回冲突，也复刻默认画布标题跟随来源笔记的同步触发器，因此重名与同步这两条数据库侧行为都可以在无远端依赖的前提下被测出来

职责: api/test 的共享替身边界；替身只复刻 PostgREST/RPC 的可观测行为与真实数据库约束，不承载业务判断，也不保存或输出真实凭据。多个测试文件共用同一份替身而不是各自复刻一遍，避免两处对同一后端行为的理解慢慢漂移。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
