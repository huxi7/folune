/**
 * [INPUT]: 依赖 VITE_API_BASE_URL、Web fetch/Headers API、access-token 的会话优先策略与 shared/supabase/auth 的请求期 access token
 * [OUTPUT]: 对外提供鉴权 apiRequest<T>、匿名只读 publicApiRequest<T>、ApiError 与 isUnauthorizedApiError；共用信封、错误与取消语义
 * [POS]: app/src/shared/api 的网络请求中枢，统一后端 URL、Bearer、响应信封与 JSON/multipart 请求语义；浏览器当前 Supabase 会话是真相源，显式 token 只在无会话的测试/兼容调用中兜底
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { getAuthenticatedAccessToken } from "../supabase/auth";
import { resolveApiAccessToken } from "./access-token";

const DEFAULT_API_BASE_URL = "http://localhost:10001";
const apiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL
).replace(/\/+$/, "");

/**
 * 页面销毁期只能同步发起 keepalive，不能等待 Supabase 刷新会话或读取响应。
 * 调用方必须把同一请求保留在持久 WAL；这里返回 true 只表示浏览器接收了请求，
 * 绝不表示服务端已经提交。
 */
export const startApiKeepalive = (
  path: string,
  body: string,
  accessToken: string,
): boolean => {
  try {
    void fetch(`${apiBaseUrl}/${path.replace(/^\/+/, "")}`, {
      body,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      keepalive: true,
      method: "PATCH",
    }).catch(() => undefined);
    return true;
  } catch {
    return false;
  }
};

type ApiEnvelope = {
  code: string;
  data: unknown;
  message: string;
};

export class ApiError extends Error {
  readonly code: string;
  readonly data: unknown;
  readonly status: number;

  constructor(status: number, code: string, message: string, data: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.data = data;
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
  const accessToken = await resolveApiAccessToken(
    explicitAccessToken,
    getAuthenticatedAccessToken,
  );

  if (accessToken === null) {
    throw new ApiError(
      401,
      "AUTH_SESSION_REQUIRED",
      "登录状态已失效，请重新登录。",
    );
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  return requestApi<T>(path, { ...init, headers });
};

// ---- 公开目录无需会话；仅开放 GET，沿用同一个传输和错误边界 ----
export const publicApiRequest = <T>(path: string, signal?: AbortSignal): Promise<T> =>
  requestApi<T>(path, { method: "GET", credentials: "omit", signal });

const requestApi = async <T>(path: string, init: RequestInit): Promise<T> => {
  const headers = new Headers(init.headers);

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
      "无法连接 Folune API，请检查后端服务。",
    );
  }

  const envelope = await readEnvelope(response);

  if (!response.ok || envelope.code !== "ok") {
    throw new ApiError(
      response.status,
      envelope.code,
      envelope.message,
      envelope.data,
    );
  }

  return envelope.data as T;
};
