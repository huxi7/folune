# api/src/config/
> L2 | 父级: ../../CLAUDE.md

成员清单
CLAUDE.md: 记录业务配置层职责与文档协议
env.ts: 使用 zod 校验 PORT、NODE_ENV、SYSTEM_NAME、CORS_ORIGINS、SUPABASE_URL、现代 SUPABASE_PUBLISHABLE_KEY 与 Free/Starter/Pro/Studio 每 UTC 日 token 上限（默认 10/200/1000/5000 万，均可配）
billing-plans.ts: 服务端唯一套餐与六档积分预览目录，以 USD 美分定义报价和 10,000 token/积分换算；订阅权益与 Chat 同源，积分包独立保持 preview 防止网关启用时意外开售

职责: 配置层，是进程环境变量的唯一读取与校验入口；禁止在其他文件散读凭据，禁止 service_role 与 secret key。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
