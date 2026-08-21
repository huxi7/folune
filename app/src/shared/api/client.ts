/**
 * [INPUT]: 依赖 VITE_API_BASE_URL、Web fetch/Headers API 与 shared/supabase/auth 的请求期 access token
 * [OUTPUT]: 对外提供唯一 apiRequest<T>、显式 access token 注入、ApiError 与 isUnauthorizedApiError，并正确透传 JSON、FormData 与 AbortSignal
 * [POS]: app/src/shared/api 的网络请求中枢，统一后端 URL、Bearer、响应信封与 JSON/multipart 请求语义；Supabase 只在调用方未显式传 token 时补充当前认证会话
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { getAuthenticatedAccessToken } from "../supabase/auth";

const DEFAULT_API_BASE_URL = "http://localhost:10001";
const apiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL
).replace(/\/+$/, "");

type ApiEnvelope = {
  code: string;
  data: unknown;
  message: string;
};

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const isApiEnvelope = (value: unknown): value is ApiEnvelope =>
  typeof value === "object" &&
  value !== null &&
  "code" in value &&
  typeof value.code === "string" &&
  "message" in value &&
  typeof value.message === "string" &&
  "data" in value;

const readEnvelope = async (response: Response): Promise<ApiEnvelope> => {
  let payload: unknown;

  try {
    payload = await response.json();
  } catch (error) {
    // ---- 取消是整个响应生命周期的信号, 不只是 fetch 层 ----
    // abort 落在读 body 期间时, response.json() 抛的是同一个 AbortError。
    // 吞掉它会把「正常取消」伪装成「后端返回畸形响应」, 让调用方的
    // AbortError 守卫全部失效并弹出错误 Toast。
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new ApiError(
      response.status,
      "INVALID_API_RESPONSE",
      "后端返回了无法识别的响应。",
    );
  }

  if (!isApiEnvelope(payload)) {
    throw new ApiError(
      response.status,
      "INVALID_API_RESPONSE",
      "后端响应格式不符合约定。",
    );
  }

  return payload;
};

export const isUnauthorizedApiError = (error: unknown): boolean =>
  error instanceof ApiError && error.status === 401;

export const apiRequest = async <T>(
  path: string,
  init: RequestInit = {},
  explicitAccessToken?: string,
): Promise<T> => {
  const accessToken = explicitAccessToken ?? await getAuthenticatedAccessToken();

  if (accessToken === null) {
    throw new ApiError(
      401,
      "AUTH_SESSION_REQUIRED",
      "登录状态已失效，请重新登录。",
    );
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  if (
    init.body !== undefined &&
    !(init.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;

  try {
    response = await fetch(
      `${apiBaseUrl}/${path.replace(/^\/+/, "")}`,
      {
        ...init,
        headers,
      },
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "无法连接 SuperNote API，请检查后端服务。",
    );
  }

  const envelope = await readEnvelope(response);

  if (!response.ok || envelope.code !== "ok") {
    throw new ApiError(response.status, envelope.code, envelope.message);
  }

  return envelope.data as T;
};
