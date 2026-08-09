/**
 * [INPUT]: 依赖 Hono Context、zod schema 类型与 common/HttpError
 * [OUTPUT]: 对外提供 Bearer 提取、JSON body 和路由参数 zod 校验 helper
 * [POS]: router 层共享 HTTP 输入适配器，统一认证头与校验错误格式，不承载任何领域业务
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { Context } from "hono";
import type { ZodType } from "zod";

import { HttpError } from "../common/http-error.ts";

export const readAccessToken = (c: Context): string => {
  const authorization = c.req.header("Authorization");
  const accessToken = /^Bearer\s+(\S+)\s*$/i.exec(
    authorization ?? "",
  )?.[1];

  if (accessToken === undefined || accessToken.length === 0) {
    throw new HttpError(
      401,
      "UNAUTHORIZED",
      "Authorization Bearer token is required",
    );
  }

  return accessToken;
};

const parseWithSchema = <T>(
  schema: ZodType<T>,
  input: unknown,
  fallbackMessage: string,
): T => {
  const parsed = schema.safeParse(input);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".");
    const message =
      issue === undefined
        ? fallbackMessage
        : path
          ? `${path}: ${issue.message}`
          : issue.message;

    throw new HttpError(400, "VALIDATION_ERROR", message);
  }

  return parsed.data;
};

export const parseJsonBody = async <T>(
  c: Context,
  schema: ZodType<T>,
  fallbackMessage: string,
): Promise<T> => {
  let body: unknown;

  try {
    body = await c.req.json();
  } catch {
    throw new HttpError(
      400,
      "INVALID_REQUEST_BODY",
      "Request body must be valid JSON",
    );
  }

  return parseWithSchema(schema, body, fallbackMessage);
};

export const parseRouteParams = <T>(
  schema: ZodType<T>,
  params: unknown,
): T => parseWithSchema(schema, params, "Invalid route parameters");
