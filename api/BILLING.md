# 订阅与支付接入边界

套餐价格、权益与当前订阅由 API 统一提供。设置、用户菜单和独立订阅页读取同一事实；点击方案不会改变套餐，也不会清空已用额度。

## 当前接口

所有响应沿用 `{ code, message, data }` 信封。

| 路径 | 认证 | 行为 |
| --- | --- | --- |
| `GET /billing/plans` | 无 | 返回 Free、Starter、Pro、Studio 套餐目录与支付可用性 |
| `GET /billing/overview` | 用户 JWT | 返回有效订阅、UTC 今日原始 token 计数/上限/剩余/重置时间与支付可用性 |
| `POST /billing/checkout` | 用户 JWT | 严格接受 `plan_id` 与 `billing_interval`；网关未配置时 unavailable；启用后生成/复用内部订单与 Invoice |
| `GET /billing/credits/packs` | 无 | 六档积分包、USD 美分报价、换算及 `status: preview`；开售状态由完整支付配置决定 |
| `POST /billing/credits/checkout` | 用户 JWT | 严格只接受白名单 `pack_id`，未配置时 unavailable；启用后走统一订单与积分发放账本 |
| `GET /ai-usage` | 用户 JWT | Chat 门禁与 billing 概览消费相同的权益与用量解析 |

`checkout` 请求只接受 `starter | pro | studio` 和 `monthly | yearly`。金额、用户 ID、订单状态、回跳地址均不由客户端传入。价格单位是 USD 美分：每月 500 / 2000 / 10000；年付统一优惠 20%，全年金额为 4800 / 19200 / 96000 美分（$48 / $192 / $960）。

日额度由环境配置：Free 10 万、Starter 200 万、Pro 1000 万、Studio 5000 万 token。API 按 10,000 token 折算 1 积分，套餐 credits 提供 daily/monthly，概览 credits 提供 daily/monthly/used/balance/tokens_per_credit/resets_at；套餐目录也提供 tokens_per_credit，前端只展示服务端换算的积分。当前每月额外赠送为 0；每日未用赠送额度于 UTC 00:00 刷新。新账本启用时余额包含购买积分，购买部分不随每日重置；它不是现金钱包。授权仍以原始 token 及 `exceeded` 为准。计数沿用现有 Chat 记账：普通对话读取模型 usage，整理、探索与 Canvas 在取不到精确 usage 时保守估算；展示的是数据库已记账用量，不应解释为精确对话次数。套餐之间复用当前已有功能，目录不承诺团队、协作或其他尚未提供的能力。

## 文本积分与额度决策（2026-10-02）

Folune 的对话、写作、整理和探索使用同一种积分，不再叠加“对话次数”限制。每次对话的上下文和输出长度不同，按次数不能公平代表消耗。1 积分 = 10,000 Token（输入与输出总和）；数据库仍记原始 Token，本次没有迁移或重置历史用量。

| 方案 | 月费 | 每日积分 | 每日 Token |
| --- | ---: | ---: | ---: |
| Free | $0 | 10 | 100,000 |
| Starter | $5 | 200 | 2,000,000 |
| Pro | $20 | 1,000 | 10,000,000 |
| Studio | $100 | 5,000 | 50,000,000 |

订阅周期是月/年，权益发放周期是每天；月赠当前为0，不把每日额度乘30冒充月到账余额，也不承诺未使用额度跨日累积。购买包为整百/整千积分、整数美元，统一100积分/$1。充值账本已接通本机 main 与 Staging；生产尚未接通，默认配置仍关闭开售，当前验证边界见 NOWPAYMENTS.md。

展示统一由 `shared/locale/credits.ts` 处理：整数不补 `.0`，用量/余额向下保留一位小数（例如9.99显示9.9），0 < 余额 < 0.1 显示 `<0.1`。不按每次调用向上取整扣积分；门禁继续使用真实Token和 `exceeded`。

定价参考于2026-10-02直接读取的[DeepSeek官方中文价格页](https://api-docs.deepseek.com/zh-cn/quick_start/pricing)：V4.1 Flash每百万缓存输入¥0.02/0.04、未缓存输入¥1/2、输出¥4/8（空闲/高峰）。旧deepseek-v4-flash请求已由V4.1 Flash承接。输入/输出比例、缓存命中和时段会改变综合成本；此额度是面向真实使用率的宽松产品方案，不代表满额消耗时必然盈利。正式开售前需用真实成本数据验证，当前没有销售或扣款。

## 付款事实与权益

`billing_subscriptions` 是每个用户当前的付款事实。无记录即免费；只有 `active` 且当前时间在已确认的计费周期内才使用付费额度。欠费、到期、已结束的取消状态回落免费；`cancel_at_period_end` 不提前收回已经支付的本周期权益。UTC 用量始终保留，订阅变化不会重置计数。

用户 JWT 只能读取本人公开订阅列。平台订阅 ID、最后验证事件 ID 等列不可读；`anon`、`authenticated` 和 `service_role` 都没有付款事实写权限。用户自定义 metadata、客户端选择、URL 参数都不参与权益判断。

`payment-provider.ts` 统一供应商 client 与开售门禁。账本读取独立于开售开关，关闭新订单后仍处理 IPN、补偿、已付权益和退款。旧预览模式只在配置关闭时保留。

购买积分与每日赠送分开记账；展示余额由服务端返回合计，同时提供 purchased/daily_remaining。退款通过追加负向账本，不能直接减每日用量或抹掉已花积分。

## NOWPayments 支付实现（2026-10-03）

订阅和积分共用内部订单、Invoice、验签/权威查单、事务发放与退款冲正。已购买积分长期有效，先消耗每日赠送；订阅按购买顺序接续，一个月/一年单次付款。金额、订单归属、开售状态和权益只由服务端决定。精确实现、环境字段、正式 API 联调与 Production 清单见 [NOWPAYMENTS.md](NOWPAYMENTS.md)。

旧 `billing_subscriptions` 是历史兼容只读事实；新权益来自 `billing_subscription_periods`。API 普通资源仍走用户 JWT，新支付仓储仅使用无 BYPASSRLS 的 `folune_billing` 受限 JWT。支付 SQL 已应用 Staging，本机已开启开售；生产尚未部署，不能把开发环境验证当作生产已上线。

## 数据库与发布

2026-09-29，`billing.sql` 已以 migration `20260929113054 / billing_readonly_subscriptions` 应用到 **Folune-staging**（`buauzrzxifgdacntisfq`）。2026-10-03 发布前，已在 **Folune-production**（`ialqliixbdwwmxackjpr`）依次应用 `20261002173654 / ai_usage_daily_quota` 与 `20261002173658 / billing_readonly_subscriptions`，复核两表 RLS、owner-only 策略、订阅公开列可读/私有列不可读及 INSERT/UPDATE/DELETE 被拒绝、用量 RPC 仅 authenticated 可执行。未来目标环境发布 API 前仍须先确认这两项契约存在；服务不会把数据库错误伪装为免费或零消耗。

`test/billing-rls.sql` 在 staging 的真实 PostgreSQL 中验证本人可读、跨用户隔离、支付私有列不可读、用户 INSERT/UPDATE/DELETE 及匿名读取被拒绝，测试事务最后完整回滚。HTTP 测试覆盖认证、白名单、付款未接入状态、有效期和共享额度。支付接入验收尚未发生。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
