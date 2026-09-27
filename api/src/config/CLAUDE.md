# api/src/config/
> L2 | 父级: ../../CLAUDE.md

成员清单
CLAUDE.md: 记录业务配置层职责与文档协议
env.ts: 使用 zod 校验 PORT、NODE_ENV、SYSTEM_NAME、CORS_ORIGINS、SUPABASE_URL、现代 SUPABASE_PUBLISHABLE_KEY 与免费账号每 UTC 日 token 额度 AI_DAILY_TOKEN_LIMIT（默认 100 万，可配）

职责: 配置层，是进程环境变量的唯一读取与校验入口；禁止在其他文件散读凭据，禁止 service_role 与 secret key。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
