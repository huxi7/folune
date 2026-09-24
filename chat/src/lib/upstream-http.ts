/**
 * [INPUT]: 依赖 Bun fetch、AbortSignal 与调用方给出的服务地址/请求头/等待预算
 * [OUTPUT]: 对外提供覆盖响应体的 fetchUpstreamResponse，保留主动取消且仅按显式配置重试读取
 * [POS]: Chat 的 Auth/Business API 网络生命周期；不用于模型 SSE，不解析身份或业务数据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export async function fetchUpstreamResponse(
  url: string,
  init: RequestInit,
  { timeoutMs = 30_000, retryRead = false } = {},
): Promise<Response> {
  const attempts = retryRead && ["GET", "HEAD"].includes((init.method ?? "GET").toUpperCase()) ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    init.signal?.throwIfAborted();
    const deadline = new AbortController();
    const timer = setTimeout(() => deadline.abort(new DOMException(
      "Upstream request timed out", "TimeoutError",
    )), timeoutMs);
    try {
      const response = await fetch(url, {
        ...init,
        ...(attempt > 0 ? { keepalive: false } : {}),
        signal: init.signal ? AbortSignal.any([init.signal, deadline.signal]) : deadline.signal,
      });
      const body = await response.arrayBuffer();
      return new Response([204, 205, 304].includes(response.status) ? null : body, {
        status: response.status, statusText: response.statusText, headers: response.headers,
      });
    } catch (error) {
      if (init.signal?.aborted || attempt === attempts - 1) throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("Upstream request failed");
}
