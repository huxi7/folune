# 订阅与支付接入边界

套餐价格、权益与当前订阅由 API 统一提供。设置、用户菜单和独立订阅页读取同一事实；点击方案不会改变套餐，也不会清空已用额度。

## 当前接口

所有响应沿用 `{ code, message, data }` 信封。

| 路径 | 认证 | 行为 |
| --- | --- | --- |
| `GET /billing/plans` | 无 | 返回 Free、Starter、Pro、Studio 套餐目录与支付可用性 |
| `GET /billing/overview` | 用户 JWT | 返回有效订阅、UTC 今日原始 token 计数/上限/剩余/重置时间与支付可用性 |
| `POST /billing/checkout` | 用户 JWT | 严格接受 `plan_id` 与 `billing_interval`；当前返回 `unavailable / PAYMENT_NOT_CONFIGURED` |
| `GET /billing/credits/packs` | 无 | 六档积分包、USD 美分报价、换算及 `status: preview`；`checkout.available` 固定为 false |
| `POST /billing/credits/checkout` | 用户 JWT | 严格只接受白名单 `pack_id`，当前返回 unavailable，不创建订单或购买余额 |
| `GET /ai-usage` | 用户 JWT | Chat 门禁与 billing 概览消费相同的权益与用量解析 |

`checkout` 请求只接受 `starter | pro | studio` 和 `monthly | yearly`。金额、用户 ID、订单状态、回跳地址均不由客户端传入。价格单位是 USD 美分：每月 500 / 2000 / 10000；年付统一优惠 20%，全年金额为 4800 / 19200 / 96000 美分（$48 / $192 / $960）。

日额度由环境配置：Free 10 万、Starter 200 万、Pro 1000 万、Studio 5000 万 token。API 按 10,000 token 折算 1 积分，套餐 credits 提供 daily/monthly，概览 credits 提供 daily/monthly/used/balance/tokens_per_credit/resets_at；套餐目录也提供 tokens_per_credit，前端只展示服务端换算的积分。当前每月额外赠送为 0，余额仅为当日未消耗积分，每日 UTC 00:00 刷新、不跨日累积；它不是现金钱包。授权仍以原始 token 及 `exceeded` 为准。计数沿用现有 Chat 记账：普通对话读取模型 usage，整理、探索与 Canvas 在取不到精确 usage 时保守估算；展示的是数据库已记账用量，不应解释为精确对话次数。套餐之间复用当前已有功能，目录不承诺团队、协作或其他尚未提供的能力。

## 文本积分与额度决策（2026-10-02）

Folune 的对话、写作、整理和探索使用同一种积分，不再叠加“对话次数”限制。每次对话的上下文和输出长度不同，按次数不能公平代表消耗。1 积分 = 10,000 Token（输入与输出总和）；数据库仍记原始 Token，本次没有迁移或重置历史用量。

| 方案 | 月费 | 每日积分 | 每日 Token |
| --- | ---: | ---: | ---: |
| Free | $0 | 10 | 100,000 |
| Starter | $5 | 200 | 2,000,000 |
| Pro | $20 | 1,000 | 10,000,000 |
| Studio | $100 | 5,000 | 50,000,000 |

订阅周期是月/年，权益发放周期是每天；月赠当前为0，不把每日额度乘30冒充月到账余额，也不承诺未使用额度跨日累积。购买包为整百/整千积分、整数美元，统一100积分/$1。充值台账尚未接入，以上购买包继续仅预览。

展示统一由 `shared/locale/credits.ts` 处理：整数不补 `.0`，用量/余额向下保留一位小数（例如9.99显示9.9），0 < 余额 < 0.1 显示 `<0.1`。不按每次调用向上取整扣积分；门禁继续使用真实Token和 `exceeded`。

定价参考于2026-10-02直接读取的[DeepSeek官方中文价格页](https://api-docs.deepseek.com/zh-cn/quick_start/pricing)：V4.1 Flash每百万缓存输入¥0.02/0.04、未缓存输入¥1/2、输出¥4/8（空闲/高峰）。旧deepseek-v4-flash请求已由V4.1 Flash承接。输入/输出比例、缓存命中和时段会改变综合成本；此额度是面向真实使用率的宽松产品方案，不代表满额消耗时必然盈利。正式开售前需用真实成本数据验证，当前没有销售或扣款。

## 付款事实与权益

`billing_subscriptions` 是每个用户当前的付款事实。无记录即免费；只有 `active` 且当前时间在已确认的计费周期内才使用付费额度。欠费、到期、已结束的取消状态回落免费；`cancel_at_period_end` 不提前收回已经支付的本周期权益。UTC 用量始终保留，订阅变化不会重置计数。

用户 JWT 只能读取本人公开订阅列。平台订阅 ID、最后验证事件 ID 等列不可读；`anon`、`authenticated` 和 `service_role` 都没有付款事实写权限。用户自定义 metadata、客户端选择、URL 参数都不参与权益判断。

`payment-provider.ts` 当前是明确未接入的适配器。`available: false`、`provider: null` 和 `checkout_url: null` 是真实产品状态；没有创建订单、扣款、自动续费或模拟成功。适配器接口传入的是经过认证的用户 ID、白名单套餐、周期和服务端价格；不会下传用户 JWT。

积分购买入口 `/app/subscription/credits` 在订阅背景之上呈现购买弹窗，包含六档预览积分包：500 / 1,000 / 2,000 / 5,000 / 8,000 / 10,000 积分，报价分别为 $5 / $10 / $20 / $50 / $80 / $100。此目录是未开售预览，不表示已批准销售或积分权益已经存在。`CREDIT_PACK_STATUS` 独立限制积分购买，即使未来订阅支付就绪，也不会自动开放积分销售。用户选择只传 pack ID，接口拒绝金额、积分数、用户、状态与回跳 URL 注入。

弹窗显示的“今日可用积分”仍来自当前计划的日额度，不展示虚构充值钱包。购买积分的独立账本、有效期、消耗优先级、退款规则与对 AI 门禁的合并方式均尚未实现，必须在开售前确定。升级页只展示 Starter/Pro/Studio；Free 仅出现在当前账户条中。

## 未来接入时的必要工作

1. 选择支付网关后实现 `PaymentProvider`，用服务端目录映射平台价格；增加经配置校验的固定回跳来源、结账幂等键及真实会话生命周期。返回的 HTTPS checkout URL 仅用于跳转，不能视作付费成功。
2. 单独设计符合仓库权限边界的可信支付事件写入口。当前没有 webhook、管理角色密钥或订阅写 RPC，不能直接给客户端加写权限；运行时仍禁止 service role、连接串和 ORM。
3. 对真实网关原始回调验签，核对事件、客户归属、套餐、金额与周期，并以平台事件唯一键去重、处理乱序/重放，在同一事务保存事件与订阅事实。回跳页只能重新读取服务端事实。
4. 用网关沙箱验证付款、失败、取消、续期、退款、延迟及重复事件后再开放 `available`。发布前补齐账单/发票、税费与退款规则；当前没有账单记录，因此不会展示伪造账单。
5. 积分购买需独立实现不可变充值/消耗台账、退款和幂等可信事件，再确定并验证购买积分与每日赠送额度的消耗顺序；同时移除目录预览门禁后才可销售，不能直接把购买金额加到 `ai_usage_daily`。

## 数据库与发布

2026-09-29，`billing.sql` 已以 migration `20260929113054 / billing_readonly_subscriptions` 仅应用到 **Folune-staging**（`buauzrzxifgdacntisfq`）。生产尚未应用。发布 API 前必须先在目标环境应用 `ai-usage.sql`（若尚未存在）与 `billing.sql`；缺少订阅表会报错，服务不会把数据库错误伪装为免费或零消耗。

`test/billing-rls.sql` 在 staging 的真实 PostgreSQL 中验证本人可读、跨用户隔离、支付私有列不可读、用户 INSERT/UPDATE/DELETE 及匿名读取被拒绝，测试事务最后完整回滚。HTTP 测试覆盖认证、白名单、付款未接入状态、有效期和共享额度。支付接入验收尚未发生。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
