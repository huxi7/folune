# api/
> L2 | 父级: ../CLAUDE.md

业务接口服务模块，负责承载产品业务 API、业务权限与基于用户 JWT/RLS 的 Supabase REST/PostgREST/Storage 数据访问边界。

技术栈: Bun + Hono + TypeScript + zod + lossless-json + Web fetch API + Supabase Storage。

成员清单
src/index.ts: Bun 进程入口，固定执行启动序列并用 6MiB 请求体上限在 multipart 解析前拦截异常上传
src/app.ts: Hono 组装根，注册请求日志、CORS、X-Request-Id 跨域暴露、错误处理与 router；CORS 预检缓存十分钟，memo-tree/memos/canvases 与 AI bootstrap/content/context/messages JSON 按 Accept-Encoding 压缩且保留 Vary。
src/router/: HTTP 路由层，提供 /health、/profile、公开套餐目录与 JWT 订阅概览/checkout、memo、Trash、AI 状态机与 Canvas V2 默认/空白入口、读取、人工/AI mutation、expansion context 的资源接口
src/dto/: DTO 层，定义 Auth/profile/billing/memo/AI/Canvas V2/PostgREST-RPC 响应与严格 HTTP body/query/param 的 zod schema/infer 类型
src/model/: 领域模型层，定义 AuthUser、Profile、套餐/只读付款事实/支付接缝、Memo、AI 状态机、Canvas V2 身份/图/回执/context、健康状态与响应信封类型
src/service/: GitHub 主邮箱 userinfo 与业务服务层，负责 JWT、profile、支付订单/事务发放/有效订阅权益与共享日额度、memo/Trash、AI 状态机及 Canvas V2 入口/读取/统一 mutation/context 的稳定 HTTP 编排
src/repository/: 数据访问层，携带已验证用户 JWT 通过 Supabase REST 提供 profiles、只读订阅公开列、memo、AI 与 Canvas V2 受控 RPC
src/middleware/: HTTP 横切层，提供请求 ID、开发态彩色 ASCII 请求卡片、生产态 JSON 日志与统一错误处理
src/common/: 通用层，提供 HttpError、统一响应 helper 与命名冲突翻译/默认名分配
src/config/: 配置层，集中校验 API 环境变量并提供唯一套餐目录与四档日额度
src/lib/: 请求期只读 GitHub 身份验证与基础设施层，提供 Supabase Auth/PostgREST/Storage 共享完整响应期限/只读重试、Storage HTTP 适配器、NOWPayments Invoice/查单/验签/连通预检、统一支付适配器与启动横幅
supabase/: 数据库契约层，保存 profiles、只读付款事实、memo tree/检索/命名唯一约束（画布命名零特例，标题不跟随任何东西）、AI 状态机、Canvas V2 schema/入口/统一 mutation/cutover/rollback、owner-only RLS 与原子 RPC；旧 Canvas SQL 定义仅为显式代码回滚面
test/: Bun 内置 API 回归、订阅真实 PostgreSQL RLS 回滚验证与显式 Docker PostgreSQL 并发锁门禁；内存 Supabase HTTP/RPC mock 验证认证、profile、订阅/用量、memo/Trash/命名重名、AI 生命周期与 Canvas V2 唯一写内核契约
.env.example: 无真实凭据的本地环境变量模板，使用 Supabase Publishable key、后端端口 10001、前端 CORS 来源端口 10000，以及默认正式环境的 NOWPayments 字段；逐项说明商户凭据与开发内部配置的分工
BILLING.md: 订阅接口、金额/额度口径、付款事实/RLS、未接支付边界与未来可信事件接入要求；记录staging验证与2026-10-03生产用量/订阅迁移的版本、权限复核及后续环境的部署顺序
NOWPAYMENTS.md: 已实现支付闭环、数据/服务身份边界、正式 API 联调步骤和 Production 清单，记录生产迁移、受限身份、Secret 轮换、开售顺序和真实付款验收边界
.gitignore: api 模块忽略规则
package.json: Bun scripts（含 typecheck/test/payment:check/payment:reconcile/payment:watch/payment:test:db/payment:test:http）与 hono、zod、lossless-json 运行依赖清单；test 用 --isolate 隔离各文件环境与模块缓存，payment:gateway 提供开发回调窄入口，payment:watch 独立运行开发补查，HTTP 门禁只用隔离本地数据库
bun.lock: Bun 锁定依赖版本
tsconfig.json: TypeScript 严格类型检查约束，覆盖 src 与 test

分层禁令
router/: 禁止业务判断，禁止直接访问 Supabase REST
dto/: 禁止 import Hono
model/: 禁止 import Hono、zod
service/: 禁止依赖 Hono Context，业务权限只允许在此层判断；content_mdx 必须逐字原样写入，摘要/字数只能从副本派生且不得回写正文；token 仅作请求期下传，禁止记录、返回或持久化
repository/: 禁止业务权限判断；普通数据用用户 JWT，payment.repository 独占受限 folune_billing JWT，经同一 supabase-rest 访问支付 RPC
middleware/: 禁止打印 JWT、完整 Authorization header、查询串或完整 Publishable key；进入终端的外部字符串必须净化控制字符
config/: Publishable key 与 NOWPayments 凭据只从 api 环境变量读取；禁止 Supabase service_role、Supabase secret key、硬编码凭据或向响应暴露
lib/: Supabase 访问只允许 Auth/PostgREST/Storage HTTP API，禁止数据库连接串、驱动、ORM 与 service role
supabase/: SQL 必须与远端实际 schema、RLS、policy、grants 保持一致

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md

## Canvas 只读问答

同一 Folune AI 支持当前画布与 @画布。
问答范围可选整图或精确笔记清单。
画布选中仅在显式命令时复制为来源。
发送前同步画布，API 冻结范围与图版本。
Chat 只注入分页读取和引文核对工具。
正文按段读取，引用须匹配本轮已读原文。
引用证据随回复 parts 保存，底部浮层查看。
Canvas 问答不执行笔记或画布写命令。
普通历史写操作仍保留原有撤销。
