/**
 * [INPUT]: 依赖真实对账脚本子进程与本地 HTTP 服务，不使用商户或数据库
 * [OUTPUT]: 验证回环目标、服务鉴权、失败退出、禁止重定向及 watch 终止
 * [POS]: 开发补查进程的运行门禁，与 payment-http.ts 的持久队列验证互补
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
const script = fileURLToPath(new URL("../../scripts/reconcile-payments.ts", import.meta.url));

function launch(port: number, args: string[] = ["--local"], mode = "test") {
  return Bun.spawn([process.execPath, script, ...args], {
    env: {
      ...process.env, PORT: String(port), NODE_ENV: mode,
      SUPABASE_URL: "http://127.0.0.1:1", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      PAYMENT_RECONCILE_SECRET: "test-scheduler-secret", PAYMENT_DB_JWT: "",
      PAYMENT_APP_ORIGIN: "", PAYMENT_API_ORIGIN: "", PAYMENT_ADMIN_IDS: "",
      BILLING_LEDGER_ENABLED: "false", PAYMENT_CHECKOUT_ENABLED: "false",
    }, stdout: "pipe", stderr: "pipe",
  });
}
test("本地补查不要求公网回调地址，200 成功且 503 保留失败退出码", async () => {
  let status = 200;
  const requests: { method: string; path: string; secret: string | null }[] = [];
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(request) {
    requests.push({ method: request.method, path: new URL(request.url).pathname, secret: request.headers.get("X-Folune-Reconcile-Key") });
    return Response.json({ status }, { status });
  } });
  try {
    for (const expected of [0, 1]) {
      const process = launch(server.port!);
      expect(await process.exited).toBe(expected);
      const output = await new Response(process.stdout).text();
      expect(output).toContain(`HTTP ${status}`);
      expect(output).not.toContain("test-scheduler-secret");
      status = 503;
    }
    expect(requests).toHaveLength(2);
    expect(requests[0]!.method).toBe("POST");
    expect(requests[0]!.path).toBe("/billing/internal/reconcile");
    expect(requests[0]!.secret).toBe("test-scheduler-secret");
  } finally { server.stop(true); }
});
test("对账不跟随重定向，密钥不转发其他地址", async () => {
  let leaked = false;
  const target = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch() { leaked = true; return new Response(); } });
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch() { return Response.redirect(target.url); } });
  try {
    expect(await launch(server.port!).exited).toBe(1);
    expect(leaked).toBe(false);
  } finally { server.stop(true); target.stop(true); }
});
test("watch 独立首次补查，收到 SIGTERM 立即退出等待且无重复请求", async () => {
  let calls = 0;
  let called!: () => void;
  const first = new Promise<void>(resolve => { called = resolve; });
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch() { calls++; called(); return new Response(); } });
  const process = launch(server.port!, ["--local", "--watch"]);
  try {
    await first;
    process.kill("SIGTERM");
    expect(await process.exited).toBe(0);
    expect(calls).toBe(1);
  } finally { process.kill(); server.stop(true); }
});
test("生产模式拒绝本地循环，watch 必须显式 local", async () => {
  expect(await launch(1, ["--local", "--watch"], "production").exited).toBe(1);
  expect(await launch(1, ["--watch"]).exited).toBe(1);
});
