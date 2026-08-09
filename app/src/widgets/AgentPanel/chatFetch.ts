/**
 * [INPUT]: 依赖标准 Fetch、Headers 与 Response API，以及调用方提供的 access token 读取器
 * [OUTPUT]: 对外提供逐请求注入 Bearer 的 fetch 工厂、带 code 的 ChatRequestError 与错误码读取能力
 * [POS]: AgentPanel 的纯 HTTP 策略层；可独立测试，不感知 Supabase、AI SDK、消息状态或具体端点
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

type ErrorEnvelope = {
  code?: unknown;
  error?: {
    code?: unknown;
    message?: unknown;
  };
  message?: unknown;
};

type AccessTokenProvider = () => Promise<string | null>;
type ChatFetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export class ChatRequestError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ChatRequestError";
    this.code = code;
  }
}

function parseErrorEnvelope(payload: unknown, status: number) {
  const envelope = payload && typeof payload === "object"
    ? payload as ErrorEnvelope
    : null;
  const code = typeof envelope?.code === "string"
    ? envelope.code
    : typeof envelope?.error?.code === "string"
      ? envelope.error.code
      : `HTTP_${status}`;
  const message = typeof envelope?.message === "string"
    ? envelope.message
    : typeof envelope?.error?.message === "string"
      ? envelope.error.message
      : "备忘录助手暂时无法响应，请稍后再试。";

  return { code, message };
}

async function readErrorResponse(response: Response) {
  const body = await response.text();
  let payload: unknown = null;

  if (body) {
    try {
      payload = JSON.parse(body);
    } catch {
      payload = null;
    }
  }

  return parseErrorEnvelope(payload, response.status);
}

export function createAuthenticatedChatFetch(
  getAccessToken: AccessTokenProvider,
  fetchImplementation: ChatFetchImplementation,
): ChatFetchImplementation {
  return async (input, init) => {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      throw new ChatRequestError(
        "UNAUTHORIZED",
        "登录状态已失效，请重新登录后再使用备忘录助手。",
      );
    }

    const headers = new Headers(
      input instanceof Request ? input.headers : undefined,
    );
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
    headers.set("Authorization", `Bearer ${accessToken}`);

    const response = await fetchImplementation(input, {
      ...init,
      headers,
    });

    if (!response.ok) {
      const envelope = await readErrorResponse(response);
      throw new ChatRequestError(envelope.code, envelope.message);
    }

    return response;
  };
}

export function getChatErrorCode(error: Error | undefined) {
  return error instanceof ChatRequestError ? error.code : null;
}
