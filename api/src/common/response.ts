/**
 * [INPUT]: 依赖 Hono Context/状态类型与 model/response.model 的统一信封类型
 * [OUTPUT]: 对外提供 ok(c, data) 与 fail(c, code, message, status) 响应 helper
 * [POS]: common 层的唯一 JSON 信封出口，禁止路由重复拼装 code/message/data
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type {
  ApiErrorResponse,
  ApiSuccessResponse,
} from "../model/response.model.ts";

export const ok = <T>(c: Context, data: T) =>
  c.json<ApiSuccessResponse<T>>({
    code: "ok",
    message: "OK",
    data,
  });

export const fail = (
  c: Context,
  code: string,
  message: string,
  status: ContentfulStatusCode,
) =>
  c.json<ApiErrorResponse>(
    {
      code,
      message,
      data: null,
    },
    status,
  );
