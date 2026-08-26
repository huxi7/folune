/**
 * [INPUT]: 依赖 Hono Context/状态类型与 model/response.model 的统一信封类型
 * [OUTPUT]: 对外提供 ok(c, data) 与支持可选错误 data 的 fail(c, code, message, status, data) 响应 helper
 * [POS]: common 层的唯一 JSON 信封出口，禁止路由重复拼装 code/message/data；冲突恢复所需的当前版本经同一出口返回
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
  data: unknown = null,
) =>
  c.json<ApiErrorResponse>(
    {
      code,
      message,
      data,
    },
    status,
  );
