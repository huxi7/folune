/**
 * [INPUT]: 依赖真实 Hono router/service/repository 与 Supabase HTTP 替身
 * [OUTPUT]: 验证订阅与积分付款未接入、严格选购意图、有效期与日用量同源，以及错误时不伪造免费/零用量
 * [POS]: 显式隔离本机已开售配置； API 订阅与 Chat 门禁的安全契约测试；数据库权限另由 staging 事务回滚实测，不把内存替身当作 RLS 证明
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, beforeEach, expect, test } from "bun:test";
import type { BillingCatalog, BillingOverview, CreditPackCatalog, SubscriptionRecord } from "../src/model/billing.model.ts";

Bun.env["NODE_ENV"] = "test";
Bun.env["BILLING_LEDGER_ENABLED"] = "false";
Bun.env["PAYMENT_CHECKOUT_ENABLED"] = "false";
Bun.env["PAYMENT_DB_JWT"] = "";
Bun.env["SUPABASE_URL"] = "https://profile-test.supabase.co";
Bun.env["SUPABASE_PUBLISHABLE_KEY"] = "sb_publishable_profile_test";
const { app } = await import("../src/app.ts");
const { authService } = await import("../src/service/auth.service.ts");
const { getBillingPlan } = await import("../src/config/billing-plans.ts");

const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const TOKEN = "billing-test-token";
const originalFetch = globalThis.fetch;
let subscription: SubscriptionRecord | null;
let totalTokens: number;
let invalidToken: boolean;
let brokenSubscription: unknown | undefined;
let reads: string[];
let writes: string[];
let usageFailure: boolean;
let subscriptionFailure: boolean;

const activeRecord = (overrides: Partial<SubscriptionRecord> = {}): SubscriptionRecord => ({
  user_id: USER_ID,
  plan_id: "pro",
  status: "active",
  billing_interval: "monthly",
  current_period_start: new Date(Date.now() - 86_400_000).toISOString(),
  current_period_end: new Date(Date.now() + 86_400_000).toISOString(),
  cancel_at_period_end: false,
  ...overrides,
});

beforeEach(() => {
  authService.resetIdentityCacheForTests();
  subscription = null;
  totalTokens = 0;
  invalidToken = false;
  brokenSubscription = undefined;
  reads = [];
  writes = [];
  usageFailure = false;
  subscriptionFailure = false;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    expect(request.headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);
    if (url.pathname === "/auth/v1/user") {
      return invalidToken
        ? Response.json({ message: "invalid token" }, { status: 401 })
        : Response.json({ id: USER_ID, user_metadata: { plan_id: "studio", subscription_status: "active" } });
    }
    if (request.method === "GET") reads.push(url.pathname);
    else writes.push(url.pathname);
    if (url.pathname === "/rest/v1/billing_subscriptions") {
      expect(request.method).toBe("GET");
      expect(url.searchParams.get("user_id")).toBe(`eq.${USER_ID}`);
      expect(url.searchParams.get("select")).not.toContain("provider");
      if (subscriptionFailure) return Response.json({ code: "42P01", message: "private-provider-event-token" }, { status: 500 });
      return Response.json(brokenSubscription ?? (subscription ? [subscription] : []));
    }
    if (url.pathname === "/rest/v1/ai_usage_daily") {
      expect(url.searchParams.get("user_id")).toBe(`eq.${USER_ID}`);
      const day = new Date().toISOString().slice(0, 10);
      expect(url.searchParams.get("usage_date")).toBe(`eq.${day}`);
      return usageFailure
        ? Response.json({ message: "usage unavailable" }, { status: 500 })
        : Response.json([{ user_id: USER_ID, usage_date: day, total_tokens: totalTokens, created_at: "2026-09-29T00:00:00Z", updated_at: "2026-09-29T00:00:00Z" }]);
    }
    if (url.pathname === "/rest/v1/rpc/increment_ai_usage_daily") {
      const body = await request.json() as { p_user_id: string; p_tokens: number };
      expect(body.p_user_id).toBe(USER_ID);
      totalTokens += body.p_tokens;
      return Response.json(totalTokens);
    }
    throw new Error(`Unexpected billing mock path ${url.pathname}`);
  }) as typeof fetch;
});

afterEach(() => { globalThis.fetch = originalFetch; });

const request = (path: string, body?: unknown, authenticated = true): Request => new Request(`http://localhost${path}`, {
  method: body === undefined ? "GET" : "POST",
  headers: {
    ...(authenticated ? { Authorization: `Bearer ${TOKEN}` } : {}),
    ...(body === undefined ? {} : { "Content-Type": "application/json" }),
  },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

const overview = async (): Promise<BillingOverview> => {
  const response = await app.fetch(request("/billing/overview"));
  expect(response.status).toBe(200);
  return (await response.json() as { data: BillingOverview }).data;
};

test("公开目录使用 USD 美分和真实三档定价；没有配置付款时明确不可结账", async () => {
  const response = await app.fetch(request("/billing/plans", undefined, false));
  const { data } = await response.json() as { data: BillingCatalog };
  expect(response.status).toBe(200);
  expect(data.plans.map(plan => [plan.id, plan.prices.monthly.amount])).toEqual([
    ["free", 0], ["starter", 500], ["pro", 2000], ["studio", 10000],
  ]);
  for (const plan of data.plans) {
    expect(plan.prices.yearly.amount).toBe(Math.round(plan.prices.monthly.amount * 12 * 0.8));
    expect(plan.prices.monthly.currency).toBe("USD");
  }
  expect(data.tokens_per_credit).toBe(10000);
  expect(data.plans.map(plan => [plan.daily_token_limit, plan.credits.daily])).toEqual([[100000, 10], [2000000, 200], [10000000, 1000], [50000000, 5000]]);
  expect(data.checkout).toEqual({ available: false, provider: null });
  expect(reads).toHaveLength(0);
});

test("缺失或无效 JWT 不能读取个人订阅或发起结账", async () => {
  for (const [path, body] of [["/billing/overview", undefined], ["/billing/checkout", { plan_id: "pro", billing_interval: "monthly" }]] as const) {
    expect((await app.fetch(request(path, body, false))).status).toBe(401);
    invalidToken = true;
    expect((await app.fetch(request(path, body))).status).toBe(401);
  }
  expect(reads).toHaveLength(0);
  expect(writes).toHaveLength(0);
});

test("无付款事实即 Free，忽略可自行修改的 user_metadata 会员字段", async () => {
  totalTokens = 12_345;
  const data = await overview();
  expect(data.subscription.plan_id).toBe("free");
  expect(data.subscription.status).toBe("free");
  expect(data.usage.total_tokens).toBe(totalTokens);
  expect(data.usage.daily_limit).toBe(getBillingPlan("free").daily_token_limit);
  expect(data.usage.remaining).toBe(data.usage.daily_limit - totalTokens);
  expect(data.usage.timezone).toBe("UTC");
  expect(Date.parse(data.usage.resets_at) - Date.parse(`${data.usage.usage_date}T00:00:00Z`)).toBe(86_400_000);
  const response = await app.fetch(request("/billing/overview"));
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(writes).toHaveLength(0);
});

test("有效付费事实与到期取消共用 Pro 额度，/ai-usage 和订阅概览结果完全同源", async () => {
  subscription = activeRecord({ cancel_at_period_end: true });
  totalTokens = 1_234_567;
  const data = await overview();
  expect(data.subscription.plan_id).toBe("pro");
  expect(data.subscription.cancel_at_period_end).toBe(true);
  expect(data.usage.daily_limit).toBe(getBillingPlan("pro").daily_token_limit);
  const gate = await app.fetch(request("/ai-usage"));
  expect((await gate.json() as { data: unknown }).data).toEqual(data.usage);
});

test("过期、欠费、已取消和未来开始的记录均不能提权", async () => {
  const expired = new Date(Date.now() - 1000).toISOString();
  const future = new Date(Date.now() + 1000).toISOString();
  for (const record of [
    activeRecord({ current_period_end: expired }),
    activeRecord({ status: "past_due" }),
    activeRecord({ status: "canceled" }),
    activeRecord({ status: "expired" }),
    activeRecord({ current_period_start: future }),
  ]) {
    subscription = record;
    const data = await overview();
    expect(data.subscription.plan_id).toBe("free");
    expect(data.usage.daily_limit).toBe(getBillingPlan("free").daily_token_limit);
  }
});

test("准确门禁以原始 token 比较；超限剩余为零，记账后读取真实累计值", async () => {
  const limit = getBillingPlan("free").daily_token_limit;
  totalTokens = limit - 1;
  expect((await overview()).usage.exceeded).toBe(false);
  const response = await app.fetch(request("/ai-usage/record", { total_tokens: 2 }));
  const { data } = await response.json() as { data: BillingOverview["usage"] };
  expect(data.total_tokens).toBe(limit + 1);
  expect(data.remaining).toBe(0);
  expect(data.exceeded).toBe(true);
  expect(writes).toEqual(["/rest/v1/rpc/increment_ai_usage_daily"]);
});

test("checkout 尚未接入时返回 unavailable，不写订单、不改套餐、不重置用量", async () => {
  totalTokens = 88_888;
  const response = await app.fetch(request("/billing/checkout", { plan_id: "studio", billing_interval: "yearly" }));
  expect(response.status).toBe(200);
  expect((await response.json() as { data: unknown }).data).toEqual({
    status: "unavailable", code: "PAYMENT_NOT_CONFIGURED", message: "在线订阅即将开放", checkout_url: null,
  });
  expect(writes).toHaveLength(0);
  const data = await overview();
  expect(data.subscription.plan_id).toBe("free");
  expect(data.usage.total_tokens).toBe(totalTokens);
});

test("strict checkout 拒绝客户端价格、身份、回跳 URL、订阅状态与未知方案", async () => {
  const valid = { plan_id: "pro", billing_interval: "monthly" };
  for (const body of [
    { ...valid, price: 1 }, { ...valid, amount: 1 }, { ...valid, user_id: OTHER_USER_ID },
    { ...valid, return_url: "https://example.com" }, { ...valid, status: "active" },
    { ...valid, plan_id: "free" }, { ...valid, plan_id: "enterprise" },
    { ...valid, billing_interval: "lifetime" }, {},
  ]) expect((await app.fetch(request("/billing/checkout", body))).status).toBe(400);
  expect(writes).toHaveLength(0);
});

test("错误的订阅数据与跨用户返回必须拒绝，不能静默赠送权益", async () => {
  subscription = activeRecord({ user_id: OTHER_USER_ID });
  expect((await app.fetch(request("/billing/overview"))).status).toBe(403);
  brokenSubscription = [{ ...activeRecord(), plan_id: "root" }];
  const invalid = await app.fetch(request("/billing/overview"));
  expect(invalid.status).toBe(502);
  expect((await invalid.json() as { code: string }).code).toBe("BILLING_DATA_INVALID");
});

test("用量读取失败时返回错误，不把失败伪装成零消耗", async () => {
  usageFailure = true;
  const response = await app.fetch(request("/billing/overview"));
  expect(response.status).toBe(502);
  expect((await response.json() as { data: unknown }).data).not.toHaveProperty("usage");
});

test("订阅存储失败时门禁关闭且错误净化，不返回内部平台数据或假装免费", async () => {
  subscriptionFailure = true;
  for (const path of ["/billing/overview", "/ai-usage"]) {
    const response = await app.fetch(request(path));
    expect(response.status).toBe(502);
    const body = await response.text();
    expect(body).toContain("BILLING_UNAVAILABLE");
    expect(body).not.toContain("private-provider-event-token");
    expect(body).not.toContain("daily_limit");
  }
});

test("积分是已记账日额度的确定换算，月赠未开放且余额不能为负", async () => {
  totalTokens = 12_345;
  let data = await overview();
  expect(data.credits).toEqual({ tokens_per_credit: 10000, used: totalTokens / 10000, daily: data.usage.daily_limit / 10000, monthly: 0, balance: data.usage.remaining / 10000, resets_at: data.usage.resets_at });
  totalTokens = data.usage.daily_limit + 100;
  data = await overview();
  expect(data.credits.balance).toBe(0);
  expect(getBillingPlan("starter").prices.yearly.amount).toBe(4800);
  expect(getBillingPlan("pro").prices.yearly.amount).toBe(19200);
  expect(getBillingPlan("studio").prices.yearly.amount).toBe(96000);
});

test("积分包只有服务端预览目录，六档报价与换算明确且没有购买钱包", async () => {
  const response = await app.fetch(request("/billing/credits/packs", undefined, false));
  expect(response.status).toBe(200);
  const { data } = await response.json() as { data: CreditPackCatalog };
  expect(data.status).toBe("preview");
  expect(data.tokens_per_credit).toBe(10000);
  expect(data.checkout).toEqual({ available: false, provider: null });
  expect(data.packs.map(pack => [pack.credits, pack.price.amount, pack.price.currency])).toEqual([
    [500, 500, "USD"], [1000, 1000, "USD"], [2000, 2000, "USD"],
    [5000, 5000, "USD"], [8000, 8000, "USD"], [10000, 10000, "USD"],
  ]);
  expect(data).not.toHaveProperty("balance");
  expect(reads).toHaveLength(0);
  expect(writes).toHaveLength(0);
});

test("积分预览checkout认证后仍不可支付，不改每日额度或写订单", async () => {
  totalTokens = 765432;
  const response = await app.fetch(request("/billing/credits/checkout", { pack_id: "credits_10000" }));
  expect(response.status).toBe(200);
  expect((await response.json() as { data: unknown }).data).toEqual({
    status: "unavailable", code: "PAYMENT_NOT_CONFIGURED", message: "积分购买即将开放", checkout_url: null,
  });
  const current = await overview();
  expect(current.usage.total_tokens).toBe(totalTokens);
  expect(current.subscription.plan_id).toBe("free");
  expect(writes).toHaveLength(0);
});

test("积分checkout拒绝缺失/无效身份及客户端金额、积分、状态和回跳地址注入", async () => {
  const body = { pack_id: "credits_500" };
  expect((await app.fetch(request("/billing/credits/checkout", body, false))).status).toBe(401);
  invalidToken = true;
  expect((await app.fetch(request("/billing/credits/checkout", body))).status).toBe(401);
  invalidToken = false;
  authService.resetIdentityCacheForTests();
  for (const input of [
    { ...body, amount: 1 }, { ...body, credits: 99999999 }, { ...body, user_id: OTHER_USER_ID },
    { ...body, status: "paid" }, { ...body, return_url: "https://example.com" },
    { pack_id: "credits_unlimited" }, {},
  ]) expect((await app.fetch(request("/billing/credits/checkout", input))).status).toBe(400);
  expect(writes).toHaveLength(0);
});
