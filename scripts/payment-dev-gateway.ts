/**
 * [INPUT]: 依赖 API 开发配置及本机业务服务，由 cloudflared 提供外部 HTTPS
 * [OUTPUT]: 仅转发验签回调，并把支付回跳送回本机订阅页；其他业务路径不公开
 * [POS]: 开发联调的窄入口，不部署生产，不向公网暴露 API 管理/笔记接口
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { env } from "../api/src/config/env.ts";

if (env.NODE_ENV === "production") throw new Error("Payment development gateway cannot run in production");
const port = 10_003;
const callbackPath = "/billing/webhooks/nowpayments";
const appOrigin = env.CORS_ORIGINS.find(origin => {
  const url = new URL(origin);
  return url.hostname === "localhost" && url.protocol === "http:";
}) ?? "http://localhost:10000";

const server = Bun.serve({
  hostname: "127.0.0.1", port, maxRequestBodySize: 65_536,
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ status: "healthy", purpose: "payment-development-callback" });
    }
    if (request.method === "GET" && url.pathname === "/app/subscription") {
      const destination = new URL("/app/subscription", appOrigin);
      const order = url.searchParams.get("order");
      if (order && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(order)) {
        destination.searchParams.set("order", order);
      }
      return new Response(null, { status: 302, headers: { Location: destination.href, "Cache-Control": "no-store" } });
    }
    if (request.method !== "POST" || url.pathname !== callbackPath) return new Response(null, { status: 404 });
    try {
      const response = await fetch(`http://127.0.0.1:${env.PORT}${callbackPath}`, {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(60_000),
        headers: { "Content-Type": "application/json", "x-nowpayments-sig": request.headers.get("x-nowpayments-sig") ?? "" },
        body: await request.arrayBuffer(),
      });
      return new Response(response.body, { status: response.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    } catch {
      return Response.json({ error: "Local payment API unavailable" }, { status: 503 });
    }
  },
});
const stop = () => { server.stop(true); process.exit(0); };
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
process.stdout.write(`Payment development gateway listening at http://127.0.0.1:${port}\n`);
