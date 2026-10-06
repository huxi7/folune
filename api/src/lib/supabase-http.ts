/**
 * [INPUT]: 依赖 Bun fetch、AbortSignal 与调用方组装的 Supabase URL/鉴权头
 * [OUTPUT]: 对外提供覆盖响应体读取的 fetchSupabaseResponse；读请求最多重试一次，写请求不重放
 * [POS]: Auth/PostgREST/Storage 共用的网络生命周期，不解析业务状态；失败重试禁用连接复用，主动取消原样传播
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const READ_TIMEOUT_MS = 6_000;
const WRITE_TIMEOUT_MS = 12_000;

export async function fetchSupabaseResponse(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const readOnly = ["GET", "HEAD"].includes((init.method ?? "GET").toUpperCase());
  const attempts = readOnly ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    init.signal?.throwIfAborted();
    const deadline = new AbortController();
    const timer = setTimeout(() => deadline.abort(new DOMException(
      "Supabase request timed out", "TimeoutError",
    )), readOnly ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        ...init,
        ...(attempt > 0 ? { keepalive: false } : {}),
        signal: init.signal
          ? AbortSignal.any([init.signal, deadline.signal])
          : deadline.signal,
      });
      // fetch 在响应头到达时就完成；只有读完 body 才算一次完整请求。
      const body = await response.arrayBuffer();
      return new Response([204, 205, 304].includes(response.status) ? null : body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (error) {
      if (init.signal?.aborted || attempt === attempts - 1) throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("Supabase request failed");
}
