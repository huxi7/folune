# api/src/common/
> L2 | 父级: ../../CLAUDE.md

成员清单
CLAUDE.md: 记录业务通用层职责与文档协议
http-error.ts: 统一可预期 HTTP 错误，携带 status、code、message 与可选结构化 data；版本冲突可返回当前服务端版本，底层异常仍不泄漏
response.ts: 统一响应出口，提供 ok 与可选错误 data 的 fail 信封 helper

职责: 通用层，集中承载跨层错误语义与响应装配，避免路由散落信封字面量。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
