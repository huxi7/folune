# chat/src/config/
> L2 | 父级: ../../CLAUDE.md

成员清单
env.ts: 服务端唯一环境入口，用 zod fail-fast 校验运行模式、服务名、端口、CORS、Supabase、Business API、provider key、唯一 V4 Flash 模型、整理阈值与预算；单次输出上限 MAX_OUTPUT_TOKENS 默认 32768（自 393216 下调，配合每日额度防单次冲太多）
models.ts: 仅保留 DeepSeek V4 Flash 的单项白名单与 Mastra OpenAI-compatible 配置转换，固定服务 URL 并按环境变量名取 key
CLAUDE.md: 记录配置层的成员、职责边界与 GEB 回环协议

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
