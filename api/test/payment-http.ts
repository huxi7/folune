/**
 * [INPUT]: 依赖一次性 PostgREST、真实 Hono/仓储/SQL 与受控商户响应；代理按目标地址重建请求
 * [OUTPUT]: 验证 HTTP 结账、验签查单、并发发放、漏通知补偿、扣费退款及 JWT/RLS 隔离
 * [POS]: 支付纵向集成门禁；仅替代 Auth 和商户外部服务，禁止访问远端或读取真实商户凭据
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

const rest = process.env["PAYMENT_TEST_REST_URL"] ?? "";
assert.match(rest, /^http:\/\/127\.0\.0\.1:\d+$/);
const signingSecret = "folune-isolated-payment-test-secret-only";
const user = "33333333-3333-4333-8333-333333333333";
const other = "44444444-4444-4444-8444-444444444444";
function jwt(role: string, sub?: string) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ role, sub, exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url");
  const data = `${header}.${payload}`;
  return `${data}.${createHmac("sha256", signingSecret).update(data).digest("base64url")}`;
}
const serviceToken = jwt("folune_billing");
const userToken = jwt("authenticated", user);
const otherToken = jwt("authenticated", other);
const originalFetch = globalThis.fetch;
let databaseUnavailable = false;
const supabase = Bun.serve({
  hostname: "127.0.0.1", port: 0,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/auth/v1/user") {
      const token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
      const id = token === userToken ? user : token === otherToken ? other : null;
      return id ? Response.json({ id, email: "test@example.invalid", user_metadata: {} }) : new Response(null, { status: 401 });
    }
    if (databaseUnavailable) return new Response(null, { status: 503 });
    assert.ok(url.pathname.startsWith("/rest/v1/"));
    // Bun 入站 Request 保留原连接信息；转发须重新组装并移除原 Host。
    const headers = new Headers(request.headers);
    headers.delete("host");
    return originalFetch(`${rest}${url.pathname.slice(8)}${url.search}`, {
      method: request.method,
      headers,
      ...(request.method === "GET" || request.method === "HEAD"
        ? {}
        : { body: await request.arrayBuffer() }),
    });
  },
});

// ---- 所有运行配置显式覆盖；商户网络只允许下面的测试替身 ----
Object.assign(process.env, {
  NODE_ENV: "test", SUPABASE_URL: supabase.url.origin,
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_isolated_test",
  NOWPAYMENTS_ENV: "production", NOWPAYMENTS_API_KEY: "test-api",
  NOWPAYMENTS_IPN_SECRET: "test-ipn", NOWPAYMENTS_EMAIL: "test@example.invalid",
  NOWPAYMENTS_PASSWORD: "test-password", PAYMENT_DB_JWT: serviceToken,
  PAYMENT_APP_ORIGIN: "https://app.example.invalid", PAYMENT_API_ORIGIN: "https://api.example.invalid",
  PAYMENT_RECONCILE_SECRET: "test-reconcile", BILLING_USAGE_SECRET: "test-usage",
  PAYMENT_ADMIN_IDS: user, BILLING_LEDGER_ENABLED: "true", PAYMENT_CHECKOUT_ENABLED: "true",
  AI_DAILY_TOKEN_LIMIT: "100000", AI_STARTER_DAILY_TOKEN_LIMIT: "2000000",
  AI_PRO_DAILY_TOKEN_LIMIT: "10000000", AI_STUDIO_DAILY_TOKEN_LIMIT: "50000000",
});
type ProviderPayment = {
  payment_id: string; invoice_id: string; order_id: string; payment_status: string;
  price_amount: string; price_currency: string; pay_amount: string; actually_paid: string;
  pay_currency: string; updated_at: string; parent_payment_id?: string;
};
const payments = new Map<string, ProviderPayment>();
let invoiceCount = 0;
let paymentReads = 0;
let invoiceTimeout = false;
globalThis.fetch = Object.assign(async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname === "127.0.0.1") return originalFetch(input, init);
  assert.equal(url.origin, "https://api.nowpayments.io", "测试不允许其他出站网络");
  const path = url.pathname;
  if (path === "/v1/invoice") {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.price_currency, "usd");
    assert.equal(body.is_fee_paid_by_user, false);
    assert.equal(body.is_fixed_rate, false);
    assert.equal(body.ipn_callback_url, "https://api.example.invalid/billing/webhooks/nowpayments");
    assert.equal(body.success_url, `https://app.example.invalid/app/subscription?order=${body.order_id}`);
    const id = String(++invoiceCount + 1000);
    payments.set(id, {
      payment_id: String(Number(id) + 1000), invoice_id: id, order_id: body.order_id,
      price_amount: String(body.price_amount), price_currency: "usd", payment_status: "waiting",
      pay_amount: "5", actually_paid: "0", pay_currency: "usdttrc20", updated_at: new Date().toISOString(),
    });
    if (invoiceTimeout) throw new Error("Simulated lost invoice response");
    return Response.json({ id, order_id: body.order_id, price_amount: body.price_amount,
      price_currency: "usd", invoice_url: `https://nowpayments.io/payment/?iid=${id}` });
  }
  if (path === "/v1/auth") return Response.json({ token: "test-merchant-token" });
  if (path === "/v1/payment/") {
    const invoice = url.searchParams.get("invoiceId");
    return Response.json({ pagesCount: 1, data: [...payments.values()].filter(p => !invoice || p.invoice_id === invoice) });
  }
  const payment = [...payments.values()].find(p => path === `/v1/payment/${p.payment_id}`);
  assert.ok(payment, `Unexpected payment path: ${path}`);
  paymentReads++;
  return Response.json(payment);
}, { preconnect: originalFetch.preconnect });

const { app } = await import("../src/app.ts");
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: app.fetch });
async function api(path: string, body?: unknown, token = userToken, extra: Record<string, string> = {}) {
  return originalFetch(`${server.url.origin}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function data(response: Response, status = 200) {
  const result = await response.json();
  assert.equal(response.status, status, JSON.stringify(result));
  return result.data;
}
async function db(path: string, token = serviceToken, body?: unknown, method = "POST") {
  const response = await originalFetch(`${rest}/${path}`, {
    method: body === undefined ? "GET" : method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return response;
}
async function rows(path: string) {
  const response = await db(path);
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
}
async function currentOrder(id: string) {
  return (await rows(`billing_orders?id=eq.${id}`))[0];
}
function provider(orderId: string) {
  const result = [...payments.values()].find(p => p.order_id === orderId);
  assert.ok(result);
  return result;
}
function finish(payment: ProviderPayment, paid = "5") {
  Object.assign(payment, { payment_status: "finished", actually_paid: paid, updated_at: new Date().toISOString() });
}
async function ipn(payment: ProviderPayment, valid = true) {
  const body = { order_id: payment.order_id, payment_id: payment.payment_id, payment_status: "finished" };
  const raw = JSON.stringify(body, Object.keys(body).sort());
  const signature = valid ? createHmac("sha512", "test-ipn").update(raw).digest("hex") : "0".repeat(128);
  return originalFetch(`${server.url.origin}/billing/webhooks/nowpayments`, {
    method: "POST", body: raw, headers: { "x-nowpayments-sig": signature },
  });
}
async function due(id: string) {
  const response = await db(`billing_orders?id=eq.${id}`, serviceToken,
    { next_check_at: "2000-01-01T00:00:00Z", lease_until: null }, "PATCH");
  assert.equal(response.status, 200);
}
const reconcile = () => api("/billing/internal/reconcile", {}, "", { "X-Folune-Reconcile-Key": "test-reconcile" });
let checks = 0;
function passed(label: string) { checks++; process.stdout.write(`PASS HTTP: ${label}\n`); }
try {
  const checkoutBody = { pack_id: "credits_500", idempotency_key: crypto.randomUUID() };
  assert.equal((await api("/billing/credits/checkout", checkoutBody, "invalid")).status, 401);
  assert.equal((await api("/billing/credits/checkout", { ...checkoutBody, amount: 1 })).status, 400);
  const checkout = await data(await api("/billing/credits/checkout", checkoutBody));
  assert.equal(checkout.status, "ready");
  const creditId: string = checkout.order_id;
  await Promise.all(Array.from({ length: 6 }, () => api("/billing/credits/checkout", checkoutBody).then(data)));
  assert.equal(invoiceCount, 1);
  assert.equal((await currentOrder(creditId)).amount_cents, 500);
  passed("服务端定价、创建 Invoice 与并发重复结账只生成一张发票");

  const credit = provider(creditId);
  assert.equal((await ipn(credit, false)).status, 401);
  assert.equal(paymentReads, 0);
  await data(await ipn(credit));
  assert.equal((await currentOrder(creditId)).status, "pending");
  finish(credit, "4.999999999999999999999999");
  await data(await ipn(credit));
  assert.equal((await currentOrder(creditId)).status, "review");
  assert.equal((await rows(`billing_wallets?user_id=eq.${user}`))[0].balance_tokens, 0);
  finish(credit, "6");
  await Promise.all(Array.from({ length: 8 }, () => ipn(credit).then(data)));
  assert.equal((await currentOrder(creditId)).status, "paid");
  assert.equal((await rows(`billing_credit_ledger?order_id=eq.${creditId}`)).length, 1);
  assert.equal((await data(await api("/billing/overview"))).credits.purchased, 500);
  passed("无效签名、权威 waiting、精确少付拒绝；多付及八路重复回调仅发一次");

  const usage = { total_tokens: 100100, usage_id: crypto.randomUUID() };
  assert.equal((await api("/ai-usage/record", usage)).status, 401);
  await Promise.all(Array.from({ length: 8 }, () => api("/ai-usage/record", usage, userToken, { "X-Folune-Usage-Key": "test-usage" }).then(data)));
  assert.equal((await rows(`billing_wallets?user_id=eq.${user}`))[0].balance_tokens, 4999900);
  assert.equal((await rows(`ai_usage_daily?user_id=eq.${user}`))[0].free_tokens_used, 100000);
  Object.assign(credit, { payment_status: "refunded", updated_at: new Date().toISOString() });
  await data(await ipn(credit)); await data(await ipn(credit));
  assert.equal((await rows(`billing_wallets?user_id=eq.${user}`))[0].balance_tokens, -100);
  assert.equal((await rows(`billing_credit_ledger?order_id=eq.${creditId}&kind=eq.refund`)).length, 1);
  passed("真实 Chat 记账入口先扣日额度、重试不双扣、退款冲正不重复");

  const subscription = await data(await api("/billing/checkout", { plan_id: "starter", billing_interval: "monthly" }));
  finish(provider(subscription.order_id));
  assert.equal((await api("/billing/internal/reconcile", {})).status, 401);
  await data(await reconcile());
  assert.equal((await data(await api("/billing/overview"))).subscription.plan_id, "starter");
  const renewal = await data(await api("/billing/checkout", { plan_id: "pro", billing_interval: "yearly" }));
  finish(provider(renewal.order_id));
  await data(await ipn(provider(renewal.order_id)));
  const periods = await rows(`billing_subscription_periods?user_id=eq.${user}&order=starts_at`);
  assert.equal(periods.length, 2);
  assert.equal(periods[0].ends_at, periods[1].starts_at);
  assert.equal((await data(await api("/billing/overview"))).subscription.plan_id, "starter");
  passed("无 IPN/无浏览器仍由对账补发订阅，续费周期接续且不提前升级");

  invoiceTimeout = true;
  assert.equal((await api("/billing/credits/checkout", { pack_id: "credits_1000" })).status, 502);
  invoiceTimeout = false;
  const unknown = await data(await api("/billing/credits/checkout", { pack_id: "credits_1000" }));
  assert.equal(unknown.status, "pending");
  assert.equal(invoiceCount, 4);
  finish(provider(unknown.order_id));
  await data(await reconcile());
  assert.equal((await currentOrder(unknown.order_id)).status, "paid");
  passed("Invoice 响应丢失不重建；按内部订单查回付款并补发");

  const wrong = await data(await api("/billing/credits/checkout", { pack_id: "credits_2000" }));
  const wrongPayment = provider(wrong.order_id);
  finish(wrongPayment); wrongPayment.parent_payment_id = "999";
  assert.equal((await reconcile()).status, 503);
  assert.equal((await currentOrder(wrong.order_id)).status, "review");
  assert.equal((await rows(`billing_credit_ledger?order_id=eq.${wrong.order_id}`)).length, 0);
  passed("错币/重复入金进入人工核查且不发放，调度报告部分失败");

  assert.equal((await api(`/billing/orders/${creditId}`, undefined, otherToken)).status, 404);
  assert.equal((await api("/billing/admin/orders", undefined, otherToken)).status, 403);
  assert.ok((await data(await api("/billing/admin/events"))).length > 0);
  assert.deepEqual(await (await db("billing_orders?select=id", otherToken)).json(), []);
  assert.equal((await db("billing_orders?select=invoice_id", userToken)).status, 403);
  assert.equal((await db("billing_events", userToken)).status, 403);
  assert.equal((await db("rpc/billing_claim_invoice", userToken, { p_id: creditId })).status, 403);
  assert.equal((await db("profiles", serviceToken)).status, 403);
  assert.equal((await db("billing_orders?select=id", `${serviceToken.slice(0, -5)}xxxxx`)).status, 401);
  passed("PostgREST 真实验签、受限角色切换、owner RLS、私有列和管理权限");

  const retry = await data(await api("/billing/credits/checkout", { pack_id: "credits_5000" }));
  const retryPayment = provider(retry.order_id); finish(retryPayment);
  databaseUnavailable = true;
  assert.equal((await ipn(retryPayment)).status, 503);
  databaseUnavailable = false;
  assert.equal((await currentOrder(retry.order_id)).fulfilled_at, null);
  await data(await ipn(retryPayment));
  assert.equal((await rows(`billing_credit_ledger?order_id=eq.${retry.order_id}`)).length, 1);
  // 已付款后恢复旧 waiting，不得回退状态或撤销已发权益。
  Object.assign(retryPayment, { payment_status: "waiting", updated_at: new Date().toISOString() });
  await due(retry.order_id);
  await data(await reconcile());
  assert.equal((await currentOrder(retry.order_id)).status, "paid");
  passed("数据库故障显式失败，恢复重试仅发一次，乱序状态不回退已付款");
  process.stdout.write(`PASS: ${checks} HTTP/PostgREST payment scenarios; provider/Auth are controlled fixtures, no real funds\n`);
} finally {
  globalThis.fetch = originalFetch;
  server.stop(true); supabase.stop(true);
}
