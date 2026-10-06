/**
 * [INPUT]: 依赖 config/env 的 Supabase URL/Publishable key、已验证用户 access token 与 supabase-http 完整响应期限
 * [OUTPUT]: 对外提供 avatars bucket 的对象上传、Storage API 删除、公开 URL 构造与受管 URL 解析能力；写操作 12 秒且不重放，网络错误统一净化
 * [POS]: lib 层 Supabase Storage HTTP 适配器，只处理对象协议与基础设施错误，不判断 profile owner 业务规则
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { HttpError } from "../common/http-error.ts";
import { env } from "../config/env.ts";
import { fetchSupabaseResponse } from "./supabase-http.ts";

export const AVATAR_BUCKET = "avatars";

type UploadAvatarObjectInput = {
  accessToken: string;
  body: ArrayBuffer;
  contentType: string;
  objectPath: string;
};

const encodeObjectPath = (objectPath: string): string =>
  objectPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const readStorageError = async (response: Response): Promise<string> => {
  const fallback = `Supabase Storage responded with HTTP ${response.status}`;

  try {
    const payload = (await response.json()) as {
      error?: unknown;
      message?: unknown;
    };

    if (typeof payload.message === "string" && payload.message.length > 0) {
      return payload.message;
    }

    if (typeof payload.error === "string" && payload.error.length > 0) {
      return payload.error;
    }
  } catch {
    return fallback;
  }

  return fallback;
};

const storageRequest = async (
  path: string,
  accessToken: string,
  init: RequestInit,
): Promise<void> => {
  const headers = new Headers(init.headers);

  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("apikey", env.SUPABASE_PUBLISHABLE_KEY);

  let response: Response;
  try {
    response = await fetchSupabaseResponse(
      `${env.SUPABASE_URL}/storage/v1/${path.replace(/^\/+/, "")}`,
      { ...init, headers },
    );
  } catch {
    throw new HttpError(502, "SUPABASE_STORAGE_ERROR", "Supabase Storage is unavailable");
  }

  if (!response.ok) {
    throw new HttpError(
      502,
      "SUPABASE_STORAGE_ERROR",
      await readStorageError(response),
    );
  }
};

export const uploadAvatarObject = async ({
  accessToken,
  body,
  contentType,
  objectPath,
}: UploadAvatarObjectInput): Promise<void> => {
  await storageRequest(
    `object/${AVATAR_BUCKET}/${encodeObjectPath(objectPath)}`,
    accessToken,
    {
      method: "POST",
      body,
      headers: {
        "Cache-Control": "max-age=31536000",
        "Content-Type": contentType,
        "x-upsert": "false",
      },
    },
  );
};

export const removeAvatarObject = async (
  objectPath: string,
  accessToken: string,
): Promise<void> => {
  await storageRequest(`object/${AVATAR_BUCKET}`, accessToken, {
    method: "DELETE",
    body: JSON.stringify({ prefixes: [objectPath] }),
    headers: { "Content-Type": "application/json" },
  });
};

export const createAvatarPublicUrl = (objectPath: string): string =>
  `${env.SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${encodeObjectPath(objectPath)}`;

export const readAvatarObjectPath = (avatarUrl: string): string | null => {
  const publicPrefix = `/storage/v1/object/public/${AVATAR_BUCKET}/`;

  try {
    const url = new URL(avatarUrl);
    const supabaseUrl = new URL(env.SUPABASE_URL);

    if (
      url.origin !== supabaseUrl.origin ||
      !url.pathname.startsWith(publicPrefix)
    ) {
      return null;
    }

    const encodedPath = url.pathname.slice(publicPrefix.length);

    return encodedPath
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");
  } catch {
    return null;
  }
};
