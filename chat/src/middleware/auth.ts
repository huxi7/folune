/**
 * [INPUT]: 依赖 Mastra 路由上下文、config/env 的 Supabase URL/Publishable key 与请求 Bearer JWT
 * [OUTPUT]: 对外提供 authMiddleware，将 Supabase Auth 验证后的可信 userId 写入 RequestContext
 * [POS]: middleware 层身份信任边界，只接受 Authorization，拒绝 body 身份并且不记录用户 token；已完成 userId 按 SHA-256(token) 键入 45 秒 TTL 缓存，原始 token 不作缓存键，撤销延迟上限即 TTL
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

// 与 api/src/service/auth.service.ts 同一套语义与同一 TTL；两模块不共享代码（无根 package.json/workspaces），改一处必须同时改另一处。
const IDENTITY_TTL_MS = 45_000;

// 缓存要活过请求，键只能是摘要——原始 token 禁止驻留、禁止落日志。
const resolvedIdentities = new Map<
  string,
  { userId: string; expiresAt: number }
>();

const identityKey = (accessToken: string): string =>
  new Bun.CryptoHasher("sha256").update(accessToken).digest("hex");

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

  const identity = identityKey(accessToken);
  const cached = resolvedIdentities.get(identity);

  if (cached !== undefined && cached.expiresAt > Date.now()) {
    context.get("requestContext").set("userId", cached.userId);
    await next();
    return;
  }

  resolvedIdentities.delete(identity);

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

  // 只缓存成功身份；401/502 走上面的早返回，永不入缓存。
  resolvedIdentities.set(identity, {
    userId: user.data.id,
    expiresAt: Date.now() + IDENTITY_TTL_MS,
  });

  context.get("requestContext").set("userId", user.data.id);
  await next();
};
