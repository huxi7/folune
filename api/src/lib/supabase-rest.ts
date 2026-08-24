/**
 * [INPUT]: 依赖 config/env 的 Supabase URL/Publishable key、调用方传入的已验证用户 access token、common/HttpError 与 Web fetch API
 * [OUTPUT]: 对外提供唯一 supabaseRest<T> 请求函数、可组合 Prefer header、强制 accessToken 的 SupabaseRestOptions 与含 on_conflict/eq/is/in 的查询 helper
 * [POS]: lib 层 Supabase REST/PostgREST 适配器，以 authenticated 用户身份触发 RLS，为 repository 统一组装请求与冲突参数
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { HttpError } from "../common/http-error.ts";
import { env } from "../config/env.ts";

type PostgrestValue = string | number | boolean;

export interface PostgrestOrder {
  column: string;
  ascending?: boolean;
  nullsFirst?: boolean;
}

export interface PostgrestQueryOptions {
  select?: string | readonly string[];
  eq?: Readonly<Record<string, PostgrestValue>>;
  in?: Readonly<Record<string, readonly PostgrestValue[]>>;
  is?: Readonly<Record<string, boolean | null>>;
  order?: PostgrestOrder | readonly PostgrestOrder[];
  limit?: number;
  onConflict?: string | readonly string[];
}

export interface SupabaseRestOptions extends Omit<RequestInit, "headers"> {
  accessToken: string;
  headers?: HeadersInit;
  returnRepresentation?: boolean;
}

const readErrorMessage = async (response: Response): Promise<string> => {
  const fallback = `Supabase REST responded with HTTP ${response.status}`;

  try {
    const payload = (await response.json()) as {
      message?: unknown;
      details?: unknown;
    };

    if (typeof payload.message === "string" && payload.message.length > 0) {
      return payload.message;
    }

    if (typeof payload.details === "string" && payload.details.length > 0) {
      return payload.details;
    }

    return fallback;
  } catch {
    return fallback;
  }
};

export const supabaseRest = async <T>(
  path: string,
  options: SupabaseRestOptions,
): Promise<T | null> => {
  const {
    accessToken,
    headers: inputHeaders,
    returnRepresentation,
    ...requestInit
  } = options;
  const headers = new Headers(inputHeaders);
  const normalizedPath = path.replace(/^\/+/, "");
  const endpoint = `${env.SUPABASE_URL}/rest/v1/${normalizedPath}`;

  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("apikey", env.SUPABASE_PUBLISHABLE_KEY);

  if (requestInit.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (returnRepresentation) {
    const existingPreference = headers.get("Prefer");
    headers.set(
      "Prefer",
      existingPreference === null
        ? "return=representation"
        : `${existingPreference}, return=representation`,
    );
  }

  const response = await fetch(endpoint, {
    ...requestInit,
    headers,
  });

  if (!response.ok) {
    throw new HttpError(
      502,
      "SUPABASE_REST_ERROR",
      await readErrorMessage(response),
    );
  }

  if (response.status === 204) {
    return null;
  }

  const body = await response.text();

  return body.length === 0 ? null : (JSON.parse(body) as T);
};

export const createPostgrestQuery = (
  options: PostgrestQueryOptions,
): string => {
  const query = new URLSearchParams();

  if (options.select !== undefined) {
    query.set(
      "select",
      typeof options.select === "string"
        ? options.select
        : options.select.join(","),
    );
  }

  if (options.eq !== undefined) {
    for (const [column, value] of Object.entries(options.eq)) {
      query.set(column, `eq.${String(value)}`);
    }
  }

  if (options.in !== undefined) {
    for (const [column, values] of Object.entries(options.in)) {
      if (values.length === 0) {
        throw new TypeError("PostgREST in filter must not be empty");
      }

      const serialized = values.map((value) => {
        if (typeof value !== "string") {
          return String(value);
        }

        return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
      });

      query.set(column, `in.(${serialized.join(",")})`);
    }
  }

  if (options.is !== undefined) {
    for (const [column, value] of Object.entries(options.is)) {
      query.set(column, `is.${String(value)}`);
    }
  }

  if (options.order !== undefined) {
    const orders = Array.isArray(options.order)
      ? options.order
      : [options.order];
    const value = orders
      .map(({ column, ascending = true, nullsFirst }) => {
        const direction = ascending ? "asc" : "desc";
        const nulls =
          nullsFirst === undefined
            ? ""
            : nullsFirst
              ? ".nullsfirst"
              : ".nullslast";

        return `${column}.${direction}${nulls}`;
      })
      .join(",");

    query.set("order", value);
  }

  if (options.limit !== undefined) {
    if (!Number.isInteger(options.limit) || options.limit < 1) {
      throw new TypeError("PostgREST limit must be a positive integer");
    }

    query.set("limit", String(options.limit));
  }

  if (options.onConflict !== undefined) {
    query.set(
      "on_conflict",
      typeof options.onConflict === "string"
        ? options.onConflict
        : options.onConflict.join(","),
    );
  }

  const value = query.toString();

  return value.length > 0 ? `?${value}` : "";
};
