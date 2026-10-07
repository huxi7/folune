# api/test/
> L2 | 父级: ../CLAUDE.md

成员清单
canvas-chat.test.ts: 验证冻结图、范围、续写只读身份和命令入口拒绝
github-auth.test.ts: 真实路由验证主邮箱唯一、分页、未验证/缺失拒绝、无缓存与凭据隔离。
payment-postgres.py: 验证普通汇率新单不复用固定旧单且保留迟到付款；一次性 PostgreSQL 17 验证并发发放/扣减、金额、退款、周期与真实权限；--http 启动受限 authenticator 的 PostgREST 14.1，结束清理独立容器。
payment-http.ts: 真实 HTTP→router/service/repository→PostgREST→SQL 的支付门禁，覆盖结账、并发回调/扣减、订阅接续、漏通知/创建超时补偿及 RLS；仅 Auth/商户使用替身，外部出站被拒绝。代理重建请求并移除原 Host，避免 Bun 复用入站连接。
payment-scheduler.test.ts: 真实子进程验证本地补查的目标/鉴权、HTTP 失败退出、不跟随重定向与 watch 可终止。
payment-flow.test.ts: 真实 service/router 的验签→权威查询→事务边界、身份和独立调度回归，单独进程运行。
CLAUDE.md: 记录 API 内存集成测试职责与文档协议
auth-cache.test.ts: 通过真实认证调用验证轮换 token 超过 1024 项时淘汰最早身份、重做验证，同时保留近期缓存命中
supabase-storage.test.ts: 验证上传/删除读完响应体、12 秒完整期限、网络错误净化与写操作只尝试一次
billing.test.ts: 验证套餐/六档积分预览报价、JWT、两类 strict checkout 反注入、未付款不升级或造钱包、过期/欠费降级与 billing/Chat 同源真实日额度，存储失败不能伪装零消耗
nowpayments.test.ts: 按用户指定 API 协议验证币种大小写、invoiceId 筛选、商户令牌缓存、重复入金拦截、精确金额及 Invoice/验签，另验证预检显式排序和手续费净额不影响入金判定。
billing-rls.sql: staging PostgreSQL 事务验证订阅 owner 隔离、私有列不可读、用户三种 DML 与匿名读取被拒绝；测试记录全部回滚，不保留伪造付款事实
support/: 测试替身模块，提供 memo 域两组契约测试共用的内存 Supabase Auth/PostgREST/RPC mock，并忠实复刻 memo_nodes 的两条标题 partial 唯一索引与默认画布标题同步触发器
memo.test.ts: 以 Hono app 和共享 mock 验证 active memo 整树、canvas 节点的画布身份与无 canvas 时不多发请求、创建补偿、JWT owner 隔离、标题/正文更新、空白保真、移动防环及回收站端点认证 另验证正文替换不读取旧正文、CORS 预检复用/来源隔离与 gzip 解压逐字一致。
memo-naming.test.ts: 覆盖现存最大编号加一、35 篇后只插入一次与客户端撞号兜底； 命名边界契约；锁定新建默认名撞名顺位让开、用户输入撞名只回 MEMO_TITLE_CONFLICT、不同类型同名合法、标题撞名回 409 但正文已落库、根节点作用域、soft-delete 后名称可复用、来源笔记改名时默认画布留着自己的名字、默认画布自己改名不回落，以及并发提交只成功一个
memo-trash.test.ts: 以内存 RPC/级联模型回归软删、顶层 Trash、批次独立恢复/祖先阻断、正常入口隔离、Folder 永久级联、当前用户清空、重复操作与异常净化
ai.test.ts: 覆盖无引用问答零树读取、冻结引用不重读偏好、历史先失败立即返回；以内存 Auth/PostgREST/RPC 全链路验证无归档 thread CRUD/bootstrap、单会话 content 三路并发聚合、prepare-chat 增量首轮与续写、assistant 定点 PATCH/身份约束、AI 历史 gzip、冻结 snapshot、refs、权限、Command 与 Organize Run 生命周期
profile.test.ts: 以同源内存 mock 验证 Profile 幂等建档、字段白名单、头像格式/体积校验、Storage 生命周期、并发补偿；CAS 响应丢失读回成功恢复，核对失败保留可能已引用的对象，旧文件删除响应丢失仍保留新头像
canvas-v2.test.ts: Canvas V2 HTTP 纵向契约测试；锁定 memo 默认/空白持久入口、连续新建编号、超过 20 个后的最大号分配、同父同类型/owner/回收站隔离、并发撞号后创建成功与非重名错误不重试、strict protocol=2、人工/AI 共用 apply_canvas_mutation、空间文字 text_scale 几何边界、409 当前版本恢复事实与不含正文的可信 expansion context
request-log.test.ts: 验证开发请求卡片、健康探针摘要、生产 JSON 日志，以及控制字符净化与敏感请求信息不落日志
supabase-rest.test.ts: 验证断连含响应体故障、GET 重试真正禁用连接复用、写请求只尝试一次、503 网络错误与主动取消透传

ai-command-concurrency.py: Docker PostgreSQL 17 八连接门禁，验证删除/撤销、revision/owner；另验证默认完全访问迁移只更新旧默认、保留明确选择及重复补丁等价；可传旧 SQL 重现死锁，自动删除测试容器，不访问远端
ai-settings.test.ts: 真实 service/repository 与延迟 PostgREST 替身，验证默认完全访问、显式模式持久化、并发首次读取与迟到初始化不覆盖 PATCH

职责: API 的无远端依赖 HTTP 回归层；通过真实 router/service/repository 调用链验证鉴权、业务不变量和 Supabase REST 请求契约，禁止保存或输出真实凭据。使用 `bun run test`（`bun test --isolate`）隔离每个测试文件的环境/模块缓存，避免本机开售配置与支付替身互相污染。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
