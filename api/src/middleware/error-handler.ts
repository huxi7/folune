/**
 * [INPUT]: 依赖 Hono ErrorHandler/NotFoundHandler、common/HttpError（含可选结构化 data）与 fail helper
 * [OUTPUT]: 对外提供 errorHandler 与 notFoundHandler 统一错误信封处理器
 * [POS]: middleware 层错误出口，屏蔽内部异常细节并保持响应结构一致
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { ErrorHandler, NotFoundHandler } from "hono";

import { HttpError } from "../common/http-error.ts";
import { fail } from "../common/response.ts";

export const errorHandler: ErrorHandler = (error, c) => {
  if (error instanceof HttpError) {
    return fail(c, error.code, error.message, error.status, error.data);
  }

  console.error(
    `[error] unhandled exception name=${error.name || "UnknownError"}`,
  );

  return fail(
    c,
    "INTERNAL_SERVER_ERROR",
    "Internal Server Error",
    500,
  );
};

export const notFoundHandler: NotFoundHandler = (c) =>
  fail(c, "NOT_FOUND", "Not Found", 404);
