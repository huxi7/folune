# app/src/shared/api/
> L2 | 父级: ../CLAUDE.md

成员清单
payments.ts: 当前付款的权威查询与旧报价标识；统一校验供应商 HTTPS 链接，Web 同页导航避免弹窗拦截，桌面沿宿主打开系统浏览器。
payments.test.ts: 验证 Web 同页导航、桌面系统浏览器交接，以及协议/主机/凭据/端口非法链接拒绝。
CLAUDE.md: 定义浏览器业务 API 边界、依赖方向与文档回环协议
access-token.ts: 无环境副作用的长会话鉴权决策层，优先当前认证会话，只在无会话时回退显式 access token 快照
client.ts: 匿名只读 publicApiRequest 与鉴权 apiRequest 共用传输/信封/错误/取消边界；唯一后端 HTTP 中枢，以 access-token 策略请求期读取可自动刷新的当前认证会话，统一注入 Bearer、透传 AbortSignal、区分 JSON/FormData、解析信封并收敛错误
client.test.ts: 长会话鉴权回归门禁，锁定刷新后的 session token 覆盖路由旧快照且显式 token 只作无会话兜底
ai.ts: 工具权限、命令与单条消息同步 45 秒响应期限，超时不重放写请求；AI Native V2 HTTP/消息边界，定义 FoluneUIMessage 冻结 context metadata，并集中暴露首开 bootstrap、单会话 content 聚合读取、增量 assistant message PATCH、无归档 Thread/Message/Reference、账号权限、Command 与 Run 命令、今日额度 getAiDailyUsage(GET /ai-usage，返回 token 口径的已用/上限/剩余/exceeded，折算成用户「额度」的职责归 UI 层)
ai-messages.test.ts: AI 消息读取/写入 HTTP 契约测试，锁定首开 bootstrap、切换 content 均为单请求且恢复冻结 context，并保留 approval-responded 兼容写回
ai-command-request.test.ts: 命令请求携带期限/幂等键、取消失联请求且禁止自动重放的 HTTP 门禁
ai-settings.test.ts: 审批设置 HTTP 契约测试，锁定 GET/PATCH 路径、Bearer、body、后端确认模式与失败拒绝语义
memo.ts: 与后端 snake_case 同构的备忘录领域/API 边界，区分不含正文的 active tree summary、单篇 MemoDetail 与正文关键词命中摘要；canvas 树节点附带 MemoCanvasIdentity（kind + origin_node_id），并集中暴露显式 access token 的 CRUD/搜索/回收站命令
memo.mapper.ts: 无副作用 DTO 适配层，把 PostgREST 数字 sort_order 归一为 Store 字符串，并分别收敛轻量 active tree、完整单篇正文与 Trash 响应字段
memo.test.ts: DTO 纯映射回归测试，验证 Trash 最小契约、恢复 subtree 排序归一及正文只存在于 detail 契约
canvas.ts: Canvas V2 唯一 HTTP 边界；定义 protocol 2 身份/节点/边/operation/receipt/context，提供 memo 默认入口、standalone 创建、无正文图读取、空间文字 text_scale、人工/AI 统一 mutation 与 48KiB pagehide keepalive；两个入口把画布身份补回返回的 tree node，使就地并入目录的节点与整树读取携带同一套事实；accessToken 可省，省略时请求期读取当前会话
subscription.ts: 套餐目录经 publicApiRequest 匿名读取供营销与账户共用；权益/购买余额、管理员能力与稳定幂等结账保留鉴权。
useBilling.ts: Dashboard 内以用户为生命周期的 BillingProvider/useBilling Context，并发读取目录/概览、合并在途刷新、15 秒中止、可见性/焦点后按 30 秒新鲜度刷新；刷新保留旧值，卸载中止，禁止跨账户全局缓存
useBilling.test.tsx: 验证多消费者只发一组读取、刷新失败保留旧值和重试、账户 key 切换清空快照并忽略迟到请求，以及 StrictMode 清理重放不锁死在途状态
profile.ts: 五字段 profile 业务 API 边界，以非空 username 统一展示名称、限制 username/bio PATCH；首屏 GET 可随路由取消，并以 multipart 调用后端头像替换接口

职责: 所有非认证业务网络请求必须从此目录进入后端；UI 禁止裸写 fetch，Supabase SDK 只存在于相邻 supabase/ 认证边界。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
