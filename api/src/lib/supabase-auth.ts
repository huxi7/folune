/**
 * [INPUT]: 依赖 config/env 的 Supabase URL/Publishable key、dto/auth.dto、common/HttpError 与用户 access token
 * [OUTPUT]: 对外提供 getSupabaseAuthUser，通过 /auth/v1/user 返回经 zod 校验的可信 AuthUser
 * [POS]: lib 层 Supabase Auth HTTP 适配器，Publishable key 仅进 apikey、用户 JWT 仅进 Authorization
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { HttpError } from "../common/http-error.ts";
import { env } from "../config/env.ts";
import { supabaseAuthUserSchema } from "../dto/auth.dto.ts";
import type { AuthUser } from "../model/auth.model.ts";

export const getSupabaseAuthUser = async (
  accessToken: string,
): Promise<AuthUser> => {
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
    throw new HttpError(
      502,
      "SUPABASE_AUTH_ERROR",
      "Supabase Auth is unavailable",
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new HttpError(
      401,
      "UNAUTHORIZED",
      "Invalid or expired access token",
    );
  }

  if (!response.ok) {
    throw new HttpError(
      502,
      "SUPABASE_AUTH_ERROR",
      `Supabase Auth responded with HTTP ${response.status}`,
    );
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new HttpError(
      502,
      "SUPABASE_AUTH_ERROR",
      "Supabase Auth returned an invalid response",
    );
  }

  const parsed = supabaseAuthUserSchema.safeParse(payload);

  if (!parsed.success) {
    throw new HttpError(
      502,
      "SUPABASE_AUTH_ERROR",
      "Supabase Auth returned an invalid user",
    );
  }

  return {
    id: parsed.data.id,
    email: parsed.data.email ?? null,
    userMetadata: parsed.data.user_metadata ?? {},
  };
};
