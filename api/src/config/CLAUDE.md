# api/src/config/
> L2 | 父级: ../../CLAUDE.md

成员清单
CLAUDE.md: 记录业务配置层职责与文档协议
env.ts: 唯一环境校验，供应商默认正式 API，分离账本/开售；登录密码保留大小写/空格，限定支付角色、HTTPS 来源与服务密钥。
billing-plans.ts: 唯一目录和 10,000 Token 换算，年费按整数比例，开售状态另由支付门禁决定。

职责: 配置层，是进程环境变量的唯一读取与校验入口；禁止在其他文件散读凭据，禁止 Supabase service_role 与 Supabase secret key；NOWPayments 凭据仅供服务端使用。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
