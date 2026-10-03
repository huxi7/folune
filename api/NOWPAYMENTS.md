# NOWPayments 支付闭环

2026-10-03：本机 main 已接通 Folune-staging 支付数据库、正式 NOWPayments Invoice、回调窄入口和独立对账；本地账本与开售已开启。用户在本机测试，production 分支/生产支付库未部署。最新修复取消强制固定汇率，新 $5 订单已通过正式 API 生成 USDT/BSC 付款地址（201、waiting）；未进行实际转账或验证到账。

本次以用户提供的 [NOWPayments API 文档 2s93JusNJt](https://documenter.getpostman.com/view/7907941/2s93JusNJt) 的原始 Postman collection 为准。此前主要参考 S1a32n38，创建 Invoice 和验签主流程一致，但币种格式、按发票查询、重复/错币入金和过期处理已按本次核对修正。

代码分支决定发布哪版代码；NOWPAYMENTS_ENV 决定访问哪套供应商 API；SUPABASE_URL 决定数据保存到哪个库，三者互相独立。本地可用正式支付 API 配开发数据库，但订单和回调必须落到创建它的那套服务/数据库，不能把开发订单复制成线上用户购买记录。

## 当前接通状态（2026-10-03，用户接手视觉验收）

用户要求实际接顺前后端后，本轮已把本机 main API/APP 接到 Folune-staging 的支付持久化；未改 Folune-production 数据库或 production Git 分支，未推送部署。

- Staging 已应用 `20261003063924 / billing_payments`，环境绑定 production 表示调用正式 NOWPayments，并不表示使用生产数据库。启用账本后已撤销 authenticated 对旧 increment_ai_usage_daily 的执行权。
- Staging 当前 ECC 用户签名密钥保持不变；新增独立 ECC standby key，已实测其签发的 folune_billing 令牌可经真实 PostgREST 验签并读取支付表。该角色无 BYPASSRLS/LOGIN。签名私钥仅保存在本机仓库外的受限运维目录，不进入应用、镜像或 Git；API 只持有受限令牌，本次有效期至 2026-11-02，届时需续签。
- 本机 API 的账本、开售已开启，登录用户已配置支付管理权限；API/Chat 共用用量密钥，调度另用独立密钥。`payment:check` 实测无缺项、数据库身份通过、checkout_available=true。
- 本地 `payment:gateway` 在 127.0.0.1:10003 仅开放回调与回跳，经 Cloudflare 临时 HTTPS 隧道接到本机。公网健康 200、无签名回调 401、管理路径 404、超大请求 413；回跳 302 到 localhost:10000 的同一订单。隧道地址已写入私有 api/.env；重启临时隧道地址会改变，须同步配置，旧 Invoice 仍保留旧回调地址。
- 独立 `payment:watch` 已启动，手动本地对账实测 HTTP 200。使用期间须保持 API、gateway、cloudflared 与 watch 进程运行。
- 前端订阅和积分购买已改为打开收银台后跟踪对应订单；pending 不再永久显示准备中，返回窗口时主动核对，已付款/退款刷新共享权益。
- 已从真实页面创建 Starter $5 Invoice 4858142599（内部订单 a1d310cf-0f6b-4c6f-8a4b-329215ab3281）与 500 积分 $5 Invoice 4338312803（内部订单 02b6b266-5660-4967-8d2c-c521b32306db），均尚未付款，不得当作发放验证。

**最低额根因与修复：** 原 `is_fixed_rate=true` 强制固定换汇流程，导致 $5 订单被 amountTo is too small 拒绝。2026-10-03 同参数实测：USDT/BSC 固定模式约 $8.97，普通模式约 $0.09；USDT/Tron 普通模式仍约 $11.41。这些数值是当时报价，不是永久限额，最终以供应商为准。现创建 Invoice 显式传 `is_fixed_rate=false`，继续由商户承担手续费；商品 USD 标价、积分数与足额判断保持不变。

Staging 已应用 `20261003092113 / billing_variable_rate`：旧 Invoice 保存 `is_fixed_rate=true` 事实，新订单默认 false；新购买不复用旧固定报价，但相同幂等键仍返回原订单，旧单迟到款仍可核对和发放。旧未付款收银台链接不再通过订单接口展示，页面引导重新选购。旧供应商 URL 自身不会被代码修改，测试时须从 Folune 重新发起。

正式 API 验证：Starter $5 新内部订单 `78d9d502-eea6-4cd5-b0de-ab454c6e6fb7`，Invoice `5809375569`，payment `5842104267`；`invoice-payment` 以 usdtbsc 返回 201/waiting 和实际付款地址，当时报价 5.00111555 USDT。未转账，不表示已到账。视觉验收继续由用户负责。

验证：本轮前端16项购买/订单测试通过，APP与开发gateway类型检查通过；API34项网关/计费及9项编排测试通过。上轮隔离PostgreSQL/PostgREST八组链路测试仍是受控商户替身证据。Staging安全检查没有新增支付表RLS告警，仅有既有的泄露密码保护未开启提示。

## 自查与设计决定

原模型只有 `billing_subscriptions` 和 `ai_usage_daily`，原 NOWPayments 文件只做状态/币种预检。没有第二套支付实现。沿用唯一网络适配器和服务端价格目录，删除旧 PaymentProvider 空接口与积分固定 preview 门禁。

- 统一 `billing_orders` 保存不可由客户端定价的 SKU、USD 美分、环境与幂等键。
- `billing_events` 保存签名通知/查单/创建/管理结果和摘要，不保存完整通知、支付地址、签名或密钥。管理员可看无订单的验签失败记录。
- `billing_credit_ledger` 是追加式购买/消费/退款记录，`billing_wallets` 是事务内更新的余额；一积分等于 10,000 Token，按 Token 精度扣减。
- `billing_subscription_periods` 按订单记录已付款周期；按购买顺序接续，当前权益优先读此表，兼容旧订阅表已有权益。不自动扣款，购买不同套餐从现有已付周期之后开始；退款只撤销对应周期，不重排其他已确认周期。
- 先扣每日赠送额度，再扣长期有效购买积分；每日赠送 UTC 00:00 刷新。购买退款追加全额冲正，已消耗部分形成负余额，后续购买先抵扣。负购买余额不取消当天免费额度。
- `billing_usage_receipts` 让同一次 Chat 上报只扣一次。Chat 等待记账且在新账本下按相同 ID 重试一次；不再静默丢弃失败。模型调用仍是调用前门禁/调用后实记，多个并发调用可能超额形成欠额，未实现预授权额度预留。
- 环境由 `billing_environment` 单行绑定；运行 ENV 不匹配时拒绝访问，供应商沙箱/正式凭据不得混用；开发/线上订单和回调仍按部署隔离。

## 代码入口与接口

| 层 | 位置 / 职责 |
| --- | --- |
| 网关 | `src/lib/nowpayments.ts`：固定官方主机、12 秒完整响应期限、拒绝重定向、Invoice 写请求不自动重放、无损数字解析 |
| 金额 | `src/lib/payment-amount.ts`：整数美分与精确十进制，不容忍分以下误差 |
| 编排 | `src/service/payment.service.ts`：统一订单、权威查单、身份/管理员判断、对账 |
| 数据 | `src/repository/payment.repository.ts`：统一 PostgREST 传输 + 专用 `folune_billing` JWT |
| 事务 | `supabase/billing-payments.sql`：环境、订单、账本、周期、事件、用量收据、INVOKER RPC 和权限 |
| 用户 | 订阅页“订单记录”，支付在新标签/系统浏览器打开；回跳 `?order=` 只打开订单视图 |
| 管理 | 订阅页“支付管理”，仅 `PAYMENT_ADMIN_IDS` 中的已验证账号可见/可访问 |

- `POST /billing/checkout`：plan_id、billing_interval、可选 UUID idempotency_key。
- `POST /billing/credits/checkout`：pack_id、可选 UUID idempotency_key。
- `GET /billing/orders`、`GET /billing/orders/:id`：只读本人订单。
- `POST /billing/orders/:id/refresh`：服务端核对，已有核对结果 30 秒内复用。
- `POST /billing/webhooks/nowpayments`：公开服务入口，64 KiB 上限、HMAC SHA-512 恒定时间比较，验签后查询 `/v1/payment/:id`。
- `POST /billing/internal/reconcile`：`X-Folune-Reconcile-Key` 服务密钥；领取持久队列，一次最多 10 单，5 分钟租约，独立于浏览器。部分失败返回 503，调度器可重试。
- `GET /billing/admin/orders`、`GET /billing/admin/events`、`GET /billing/admin/orders/:id/events`：管理员最近 100 条记录。
- `POST /billing/admin/orders/:id/refresh`：body `{}` 常规查单；必要时传 `{ "payment_id": "平台付款ID" }`，依然从网关查权威状态并核对绑定，不能人工声明成功。

状态：created → creating → pending/confirming/partially_paid → paid；异常为 failed/expired/review；已发放只允许退款冲正，旧状态不回退已付款。`confirmed` 不代表可发放，必须 `finished` 且权威 USD 金额、order/invoice/payment、足额链上金额一致。数据库 wallet → order 固定锁顺序，order/reference 唯一约束和同一事务防止重复发放。

Invoice 创建超时不重发：可能已经成功。订单保留 creating，5 分钟后进入 review，管理员需到供应商核实；若已经付款，按 order_id 发现并查单可补发。parent_payment_id 或 REPEATED/WRONG_ASSET 标记在通知、列表与权威查询中均拒绝自动发放；多个 payment attempt 不自动合并，进入人工核查；管理员可指定某笔完整足额付款再由网关验证。跨币种分次补款、部分退款自动折算尚不支持。

官方描述付款窗口为七天；代码不再按本地 48 小时无记录提前判过期。expired 以供应商状态为准，过期后仍纳入定时查单，因为官方明确说明过期后的到账不再发送 IPN。

## 商户设置与资金去向（2026-10-03 截图核对）

用户最新截图显示 USD、加价 0%、payment covering 0%、提现手续费 Receiver、错币自动处理关闭、默认部分付款、托管开启；重复充值页签未展开，不推断其设置。这是截图状态，未通过后台写入或当前设置 API 核验。

托管开启的正常付款按平台确认/结算后进入 NOWPayments 商户余额，后续提现另设目标钱包。关闭错币自动处理不会把异常资金直接计入可提现余额：官方说明受支持资产/网络的 Wrong Asset 需要人工处理，不支持的资产不保证可恢复。链上地址收到转账、平台识别、商户余额入账是三个不同状态。异常款不能自动视为销售利润，应保留待核查并根据恢复结果补足权益或退款；资金移动由平台决定，Folune 当前不执行转账/提币/自动退款。

Folune 对 parent_payment_id/重复或错币标记拒绝自动发放并记录异常；普通付款按实际入金而非商户净额判足额：应付 5 实收 1 或 4.99 不开通；实收 5 但平台扣费后净额 4.99 正常开通；同一正常付款实收 6 只发原订单权益一次，多余部分不自动换积分或退回。具体币种数量以收银台报价为准，$5 不等于一定支付 5 USDT。

订单 API 现显式传 is_fixed_rate=false、is_fee_paid_by_user=false；这是收款定价/费用设置，不应和后台的提现 Receiver/Sender 混为一谈。

商户 API Key 和独立邮箱/密码已填，本次正式 /auth 与付款列表均返回 200。付款列表最简参数曾返回 500，显式 sortBy/orderBy 后通过，预检已跟随修正；不是用户密码错误。IPN Secret 仍待真实通知验证。八个内部字段都有用途，管理员 ID 可为空，其余由开发部署处理；本轮仅添加逐项中文说明，未变更密钥、开售/账本值或远端商户设置。

## 环境与凭据

只填 `api/.env` 或云端环境/Secret Manager；不要发送到聊天。API Key 与 IPN Secret 不同。这份文档以 Primary/Custody 商户余额收款为主；结算币种、网络和提币钱包在 NOWPayments 后台管理，不承诺付款一定直接进入外部钱包，不向 Folune 提供助记词/私钥。

| 变量 | 用途 |
| --- | --- |
| NOWPAYMENTS_ENV | 默认 production；sandbox 仅为可选测试能力 |
| NOWPAYMENTS_API_KEY / NOWPAYMENTS_IPN_SECRET | 对应环境的商户 API 访问/通知验签 |
| NOWPAYMENTS_EMAIL / NOWPAYMENTS_PASSWORD | 官方 `/auth` 换取短期商户 JWT，用于付款列表发现；仅服务端，不能用 Folune 用户 JWT 替代 |
| PAYMENT_APP_ORIGIN / PAYMENT_API_ORIGIN | 固定公网 HTTPS origin，无尾斜线；本地联调用公网 HTTPS 隧道；发布后改线上地址，回调不能指错订单数据库 |
| PAYMENT_DB_JWT | 项目签发、role=folune_billing 且未过期的专用 JWT；禁止 service_role；Supabase 对签名最终验证 |
| PAYMENT_RECONCILE_SECRET | 仅调度器与 API 共享的高熵随机密钥 |
| BILLING_USAGE_SECRET | 仅 API 与 Chat 共享的独立高熵密钥，鉴别真实服务记账 |
| PAYMENT_ADMIN_IDS | 逗号分隔已验证用户 UUID，不能从可编辑 user_metadata 授权 |
| BILLING_LEDGER_ENABLED | 数据库迁移和 Chat 记账配置完成后启用；上线后保持，不能靠关闭它回滚已购买权益 |
| PAYMENT_CHECKOUT_ENABLED | 开售开关；可关新订单，但应继续处理付款、对账、权益与退款 |

NOWPayments 官方付款列表除了 API Key 还要求 Bearer JWT。只有 payment ID 时可凭 API Key 查单；首条 IPN 丢失时，已有 invoice_id 就按 invoiceId 查；创建响应丢失才按时间完整分页找内部 order_id。登录 JWT 官方有效期为 5 分钟，适配器仅缓存 4 分钟，认证失败清除缓存。不能把缺少商户认证的轮询当成可用兜底。

专用数据库角色：SQL 创建 NOLOGIN/NOINHERIT 的 `folune_billing` 并授予 authenticator 切换权限，仅有支付表和用量表权限，无 BYPASSRLS、无笔记/Storage/Auth 权限。用目标项目受信任的 JWT 签名流程生成限定 role 的短期令牌并制定轮换；不要让应用持有项目签名私钥。部署前实测 PostgREST 验签与 role 切换，令牌过期必须告警。不能拿普通用户 token 或 service role 填入。

## 正式 API 的本地联调

商户用户目前只需提供 API Key、IPN Secret；自动发现遗漏付款还需商户邮箱/密码，均只填 api/.env。其余数据库、角色、回调、调度配置由开发处理。

1. 保留 `NOWPAYMENTS_ENV=production` 与已有正式凭据；无需另开沙箱。商户后台确认 Primary balance、结算币种/网络与 payment covering 配置。
2. 对开发数据库依次应用 `supabase/billing-payments.sql` 与 `supabase/billing-variable-rate.sql`，绑定其供应商环境为 production；开发库仍是开发库，不因为使用正式支付 API 就切换所有业务到生产数据库。正式支付是真实资金，测试订单要保留明确归属和核对记录。
3. 准备受限数据库身份、API/Chat 用量密钥、管理员 ID；本地 API 通过公网 HTTPS 地址接收通知。NOWPayments 无法向普通 localhost 发送回调。
4. 运行 `bun run --cwd api payment:check`。本轮正式 Key、币种与商户登录/付款列表查询通过；输出缺失的 origin/数据库身份和独立开关状态。IPN Secret 的正确性只能用真实通知确认。
5. 本地用 `bun run --cwd api payment:reconcile --local` 单次补查，或 `bun run --cwd api payment:watch` 独立持续补查；两者都需要支付数据库与共享调度密钥。生产仍配置外部定时任务每 2 分钟请求对账入口，本地 watch 不替代上线调度。
6. 内部配置完成后创建正式 Invoice，核对美元价格、order_id、invoice_id 和回跳地址，打开托管收银台。小额付款验证需记录实际支付与权益对应关系，不能以进入成功页作为到账依据。
7. 在本地受控测试覆盖失败、少付、重复/乱序、错币、重复入金、退款、数据库故障与权限；真实联调验证创建/回调/查单/到账/漏通知补偿。不会为了覆盖异常主动制造不可恢复转账。

本地回归命令：

```sh
bun run --cwd api typecheck
bun run --cwd app typecheck
bun run --cwd chat typecheck
bun test api/test/nowpayments.test.ts api/test/billing.test.ts
bun test api/test/payment-flow.test.ts
bun run --cwd api payment:test:db
bun run --cwd api payment:test:http
bun test api/test/payment-scheduler.test.ts
```

payment-flow 单独进程运行，避免测试模块的进程配置缓存互相污染。真实 RLS/唯一约束/锁由 Docker PostgreSQL 测试覆盖；网关测试是受控替身，不等于已完成真实商户付款联调。

## Production 切换清单

- [ ] 正式 API 的本地联调通过，保留订单/平台/事件证据；解决所有 review 状态。无需沙箱前置。
- [ ] 确认正式商户账户、结算钱包网络、可用币种、最小支付额和费用；重点验证 $5 档不会低于最低支付额。发布退款/订阅周期/税费说明。
- [ ] 对 Production 单独依次应用 billing-payments.sql 与 billing-variable-rate.sql，绑定 environment=production；不复制开发测试钱包、订单或支付事件。
- [ ] 签发 Production 专用 folune_billing JWT，实测权限和过期轮换；Supabase Data API 能正确使用此角色，普通用户无法调用写 RPC。
- [ ] 生产 API Secret Manager 注入商户 Key/IPN/登录凭据、DB JWT、对账密钥、用量密钥；Chat 仅获得用量密钥。Pages 无支付秘密；镜像与日志无秘密。
- [ ] 发布兼容的 Chat（带用量密钥与幂等 ID），然后迁移/配置 API 开账本，最后前端。切换前处理完在途旧 Chat 请求。
- [ ] 配置正式 APP/API origin，NOWPAYMENTS_ENV=production，ADMIN UUID 白名单；先保持开售 false。
- [ ] 建 Cloud Scheduler 每 2 分钟 POST；超时/重试窗口不超过租约，给 503 和长期未核对订单告警。验证真实调度请求成功、并发触发不重复发放。
- [ ] 启用后撤销旧 `increment_ai_usage_daily(uuid,bigint)` 对 authenticated 的执行权限，避免用户绕过服务记账；若回滚必须与旧 API 配对恢复。
- [ ] 开售后由指定测试账号做一笔小额正式付款及退款，对照实际钱包、订单、账本和权益；未完成不宣布支付已上线。
- [ ] 检查 Cloudflare/Cloud Build/Cloud Run 实际 SHA 与版本，确认三个发布完成；出现异常先关 PAYMENT_CHECKOUT_ENABLED，继续 IPN/对账/已付权益，不能关账本或直接回滚数据库。

## 已知边界

当前管理列表为最近 100 条；全量财务导出、争议工单、自动发票/税务、跨币种分次补款、部分退款、订阅即时按比例升级均不在首版。多个并发模型请求没有预授权额度锁，仍可能超额；已发生的用量不会被抹掉，欠额保留。IPN 签名算法按官方 JSON 解码后递归排序重编码示例实现，真实通知仍须在正式联调中验证。

官方依据：[用户指定 Payment API](https://documenter.getpostman.com/view/7907941/2s93JusNJt)、[商户设置](https://nowpayments.io/help/about-nowpayments/how-to-start/how-to-set-up-an-account)。此前文档核对曾验证 API 类型检查与 41 项支付/计费测试；最新续接结果见本文“本轮续接”，不把历史测试计数作为当前运行结果。未进行真实付款或浏览器视觉验收。

2026-10-03 直接读取用户指定 2s93JusNJt 原始 collection：Invoice 参数、HMAC-SHA512、付款列表的 invoiceId 与登录认证、parent_payment_id/origin_type、七天窗口与过期后无 IPN；正式 merchant/coins 实测返回 selectedCurrencies 大写币种，适配器已兼容并规范化。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
