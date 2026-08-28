# api/src/common/
> L2 | 父级: ../../CLAUDE.md

成员清单
CLAUDE.md: 记录业务通用层职责与文档协议
http-error.ts: 统一可预期 HTTP 错误，携带 status、code、message 与可选结构化 data；版本冲突可返回当前服务端版本，底层异常仍不泄漏
memo-title.ts: 命名冲突边界；把 PostgREST 的 23505 翻译成稳定的 409 MEMO_TITLE_CONFLICT，并为系统生成的默认名提供有界的顺位让开分配器。唯一约束的最终裁决在数据库，因此这里不做预检查，只在被拒绝后取下一个候选
response.ts: 统一响应出口，提供 ok 与可选错误 data 的 fail 信封 helper

职责: 通用层，集中承载跨层错误语义、响应装配与命名冲突翻译，避免路由散落信封字面量；用户亲手输入的名字撞名时只翻译成业务错误，绝不替他改名。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
