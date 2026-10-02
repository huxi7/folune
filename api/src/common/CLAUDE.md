# api/src/common/
> L2 | 父级: ../../CLAUDE.md

成员清单
CLAUDE.md: 记录业务通用层职责与文档协议
http-error.ts: 统一可预期 HTTP 错误，携带 status、code、message 与可选结构化 data；版本冲突可返回当前服务端版本，底层异常仍不泄漏
memo-title.ts: 命名冲突边界；把 PostgREST 的 23505 翻译成稳定的 409 MEMO_TITLE_CONFLICT；笔记/独立画布共用 createWithDefaultTitle，优先写入客户端已占号名称，无编号请求或撞号时读取同级同类型最大编号直接加一，不填空号、不受已有数量限制；其他名称保留有界让位，最终并发裁决仍在唯一约束
response.ts: 统一响应出口，提供 ok 与可选错误 data 的 fail 信封 helper

职责: 通用层，集中承载跨层错误语义、响应装配与命名冲突翻译，避免路由散落信封字面量；用户亲手输入的名字撞名时只翻译成业务错误，绝不替他改名。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
