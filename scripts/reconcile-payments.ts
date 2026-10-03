/**
 * [INPUT]: 依赖 API 统一配置、调度专用密钥与显式 --local/--watch 参数
 * [OUTPUT]: 单次补查或独立本地每两分钟串行补查，支持终止，不显示密钥
 * [POS]: 开发对账进程与 API/浏览器分离；生产仍由外部调度器调用持久队列
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { env } from "../api/src/config/env.ts";
import { setTimeout as delay } from "node:timers/promises";

const args = new Set(process.argv.slice(2));
if ([...args].some(arg => !["--local", "--watch"].includes(arg)) ||
    (args.has("--watch") && !args.has("--local"))) {
  throw new Error("Usage: payment:reconcile [--local [--watch]]");
}
if (args.has("--local") && env.NODE_ENV === "production") {
  throw new Error("Local reconciliation is only available in development/test");
}
const origin = args.has("--local") ? `http://127.0.0.1:${env.PORT}` : env.PAYMENT_API_ORIGIN;
if (!origin || !env.PAYMENT_RECONCILE_SECRET) throw new Error("Missing payment reconciliation configuration");
const shutdown = new AbortController();
const stop = () => shutdown.abort();
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

async function reconcileOnce() {
  try {
    const response = await fetch(`${origin}/billing/internal/reconcile`, {
      method: "POST", redirect: "error",
      headers: { "X-Folune-Reconcile-Key": env.PAYMENT_RECONCILE_SECRET! },
      signal: AbortSignal.any([shutdown.signal, AbortSignal.timeout(240_000)]),
    });
    await response.body?.cancel();
    process.stdout.write(`Payment reconciliation HTTP ${response.status}\n`);
    return response.ok;
  } catch {
    if (!shutdown.signal.aborted) process.stderr.write("Payment reconciliation failed\n");
    return false;
  }
}

try {
  do {
    const success = await reconcileOnce();
    if (!args.has("--watch")) {
      if (!success && !shutdown.signal.aborted) process.exitCode = 1;
      break;
    }
    // 前次请求完成才等待下一轮，失败保留持久队列并重试，禁止并发堆积。
    await delay(120_000, undefined, { signal: shutdown.signal });
  } while (!shutdown.signal.aborted);
} catch (error) {
  if (!shutdown.signal.aborted) throw error;
} finally {
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
}
