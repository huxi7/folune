/**
 * [INPUT]: 依赖 Hono 的 ContentfulStatusCode HTTP 状态类型
 * [OUTPUT]: 对外提供携带 status、code、message 的 HttpError
 * [POS]: common 层的统一可预期错误，被基础设施、service 与错误处理中间件共享
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { ContentfulStatusCode } from "hono/utils/http-status";

export class HttpError extends Error {
  readonly status: ContentfulStatusCode;
  readonly code: string;

  constructor(
    status: ContentfulStatusCode,
    code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
  }
}
