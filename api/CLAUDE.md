# api/
> L2 | 父级: ../CLAUDE.md

业务接口服务模块，负责承载产品业务 API、业务权限与基于用户 JWT/RLS 的 Supabase REST/PostgREST/Storage 数据访问边界。

技术栈: Bun + Hono + TypeScript + zod + Web fetch API + Supabase Storage。

成员清单
src/index.ts: Bun 进程入口，固定执行启动序列并用 6MiB 请求体上限在 multipart 解析前拦截异常上传
src/app.ts: Hono 组装根，注册请求日志、CORS、X-Request-Id 跨域暴露、错误处理与 router
src/router/: HTTP 路由层，提供 /health、/profile、active memo/trash 与 AI threads/context/settings/commands/runs 的 JWT 资源接口
src/dto/: DTO 层，定义 Auth/profile/memo/AI/PostgREST-RPC 响应与严格 HTTP body/query/param 的 zod schema/infer 类型
src/model/: 领域模型层，定义 AuthUser、Profile、Memo tree、AI 会话/上下文/权限/Command/Run、健康状态与响应信封类型
src/service/: 业务服务层，负责 JWT 认证、profile/头像、active memo/Trash 及 AI 会话/冻结上下文/权限/Command/Run 编排
src/repository/: 数据访问层，携带已验证用户 JWT 通过 Supabase REST 提供 profiles、memo、AI 持久化与受控原子 RPC
src/middleware/: HTTP 横切层，提供请求 ID、开发态彩色 ASCII 请求卡片、生产态 JSON 日志与统一错误处理
src/common/: 通用层，提供 HttpError 与统一响应 helper
src/config/: 配置层，集中校验 API 环境变量
src/lib/: 基础设施层，提供 Supabase Auth/PostgREST/Storage HTTP 适配器与启动横幅
supabase/: 数据库契约层，保存 profiles、带 revision 的 memo tree、AI 会话/设置/Command/Run、删除批次与可撤销原子 RPC、级联约束及 owner-only RLS SQL 契约
test/: Bun 内置 API 回归测试，使用内存 Supabase HTTP/RPC mock 验证认证、profile/头像、memo/Trash 及 AI 会话/权限/Command/Run 生命周期
.env.example: 无真实凭据的本地环境变量模板，使用 Supabase Publishable key、后端端口 10001、前端 CORS 来源端口 10000
.gitignore: api 模块忽略规则
package.json: Bun scripts（含 typecheck/test）与 hono、zod 运行依赖清单
bun.lock: Bun 锁定依赖版本
tsconfig.json: TypeScript 严格类型检查约束，覆盖 src 与 test

分层禁令
router/: 禁止业务判断，禁止直接访问 Supabase REST
dto/: 禁止 import Hono
model/: 禁止 import Hono、zod
service/: 禁止依赖 Hono Context，业务权限只允许在此层判断；content_mdx 必须逐字原样写入，摘要/字数只能从副本派生且不得回写正文；token 仅作请求期下传，禁止记录、返回或持久化
repository/: 禁止写业务权限，只允许携带已验证用户 JWT 通过 lib/supabase-rest.ts 访问数据
middleware/: 禁止打印 JWT、完整 Authorization header、查询串或完整 Publishable key；进入终端的外部字符串必须净化控制字符
config/: Publishable key 只从 api 环境变量读取；禁止 service_role、secret key、硬编码凭据或向响应暴露
lib/: Supabase 访问只允许 Auth/PostgREST/Storage HTTP API，禁止数据库连接串、驱动、ORM 与 service role
supabase/: SQL 必须与远端实际 schema、RLS、policy、grants 保持一致

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
