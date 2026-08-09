/**
 * [INPUT]: 依赖 Mastra 路由上下文、config/env 的 Supabase URL/Publishable key 与请求 Bearer JWT
 * [OUTPUT]: 对外提供 authMiddleware，将 Supabase Auth 验证后的可信 userId 写入 RequestContext
 * [POS]: middleware 层身份信任边界，只接受 Authorization，拒绝 body 身份并且不记录用户 token
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import type { ContextWithMastra, Middleware } from "@mastra/core/server";
import { z } from "zod";

import { env } from "@/config/env";

type RouteMiddleware = Exclude<Middleware, { path: string }>;

const authUserSchema = z.object({
  id: z.uuid(),
});

const readBearerToken = (authorization: string | undefined): string | null => {
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);
  return match?.[1] ?? null;
};

export const authMiddleware: RouteMiddleware = async (rawContext, next) => {
  const context = rawContext as ContextWithMastra;
  const accessToken = readBearerToken(context.req.header("Authorization"));

  if (!accessToken) {
    return context.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Missing or malformed bearer token",
        },
      },
      401,
    );
  }

  let response: Response;

  try {
    response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
      },
    });
  } catch {
    return context.json(
      {
        error: {
          code: "AUTH_UPSTREAM_UNAVAILABLE",
          message: "Authentication service is unavailable",
        },
      },
      502,
    );
  }

  if (response.status === 401 || response.status === 403) {
    return context.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid or expired access token",
        },
      },
      401,
    );
  }

  if (!response.ok) {
    return context.json(
      {
        error: {
          code: "AUTH_UPSTREAM_ERROR",
          message: "Authentication service rejected the request",
        },
      },
      502,
    );
  }

  const user = authUserSchema.safeParse(await response.json().catch(() => null));

  if (!user.success) {
    return context.json(
      {
        error: {
          code: "AUTH_UPSTREAM_ERROR",
          message: "Authentication service returned an invalid user",
        },
      },
      502,
    );
  }

  context.get("requestContext").set("userId", user.data.id);
  await next();
};
