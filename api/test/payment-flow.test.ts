/**
 * [INPUT]: 依赖真实支付 service/router、受控仓储与网关替身
 * [OUTPUT]: 验证验签先于查单、权威状态先于发放、客户端身份隔离及定时对账
 * [POS]: 显式隔离本机已开售配置； 支付 HTTP/业务链路测试，真实数据库约束由 payment-postgres.py 单独验证
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, expect, spyOn, test } from "bun:test";
import { createHmac } from "node:crypto";
Bun.env["NODE_ENV"] = "test";
Bun.env["BILLING_LEDGER_ENABLED"] = "false";
Bun.env["PAYMENT_CHECKOUT_ENABLED"] = "false";
Bun.env["PAYMENT_DB_JWT"] = "";
Bun.env["NOWPAYMENTS_ENV"] = "sandbox";
Bun.env["SUPABASE_URL"] = "https://payment-test.supabase.co";
Bun.env["SUPABASE_PUBLISHABLE_KEY"] = "sb_publishable_test";
Bun.env["NOWPAYMENTS_IPN_SECRET"] = "test-ipn";
Bun.env["PAYMENT_RECONCILE_SECRET"] = "test-reconcile";
const { paymentService } = await import("../src/service/payment.service.ts");
const { paymentRepository: repo } =
  await import("../src/repository/payment.repository.ts");
const { paymentProvider } = await import("../src/lib/payment-provider.ts");
const { app } = await import("../src/app.ts");
import type {
  PaymentOrder,
  VerifiedPayment,
} from "../src/model/payment.model.ts";
const id = "11111111-1111-4111-8111-111111111111";
const order = {
  id,
  user_id: id,
  environment: "sandbox",
  amount_cents: 500,
  invoice_id: "456",
  payment_id: null,
  status: "pending",
  created_at: new Date().toISOString(),
  last_checked_at: null,
} as PaymentOrder;
const authoritative = {
  payment_id: "123",
  invoice_id: "456",
  order_id: id,
  payment_status: "waiting",
  price_amount: "5",
  price_currency: "usd",
  pay_amount: "1",
  actually_paid: "0",
  pay_currency: "btc",
  updated_at: new Date().toISOString(),
} as VerifiedPayment;
const spies: { mockRestore: () => void }[] = [];
function mock<T extends object, K extends keyof T>(object: T, key: K) {
  const value = spyOn(object, key as never);
  spies.push(value);
  return value;
}
afterEach(() => {
  spies.splice(0).forEach((value) => value.mockRestore());
});
const raw = JSON.stringify({
  order_id: id,
  payment_id: 123,
  payment_status: "finished",
});
const signature = createHmac("sha512", "test-ipn")
  .update(JSON.stringify(JSON.parse(raw), Object.keys(JSON.parse(raw)).sort()))
  .digest("hex");
test("伪造签名不查网关、不发放，只保存无载荷审计", async () => {
  const audit = mock(repo, "event").mockResolvedValue(undefined);
  const fetch = mock(paymentProvider.client, "getPayment");
  const apply = mock(repo, "apply");
  await expect(paymentService.ipn(raw, "0".repeat(128))).rejects.toMatchObject({
    code: "PAYMENT_SIGNATURE_INVALID",
  });
  expect(fetch).not.toHaveBeenCalled();
  expect(apply).not.toHaveBeenCalled();
  expect(audit).toHaveBeenCalled();
});
test("签名通知 finished 但权威接口 waiting，发放内核只收到 waiting", async () => {
  mock(repo, "get").mockResolvedValue(order);
  mock(repo, "event").mockResolvedValue(undefined);
  const lookup = mock(paymentProvider.client, "getPayment").mockResolvedValue(
    authoritative,
  );
  const apply = mock(repo, "apply").mockResolvedValue(order);
  await paymentService.ipn(raw, signature);
  expect(lookup).toHaveBeenCalledWith("123");
  expect(apply).toHaveBeenCalledWith(
    order,
    expect.objectContaining({ payment_status: "waiting" }),
  );
});
test("权威金额不匹配拒绝，查单失败也不发放", async () => {
  mock(repo, "get").mockResolvedValue(order);
  mock(repo, "event").mockResolvedValue(undefined);
  const lookup = mock(paymentProvider.client, "getPayment").mockResolvedValue({
    ...authoritative,
    price_amount: "4.99",
  });
  const apply = mock(repo, "apply");
  await expect(paymentService.ipn(raw, signature)).rejects.toMatchObject({
    code: "PAYMENT_MISMATCH",
  });
  expect(apply).not.toHaveBeenCalled();
  lookup.mockRejectedValue(new Error("network"));
  await expect(paymentService.ipn(raw, signature)).rejects.toThrow();
  expect(apply).not.toHaveBeenCalled();
});
test("用户订单查询不能跨用户，管理权限不由用户资料字段授予", async () => {
  mock(repo, "get").mockResolvedValue(order);
  await expect(
    paymentService.get(id, "22222222-2222-4222-8222-222222222222"),
  ).rejects.toMatchObject({ status: 404 });
  expect(() => paymentService.requireAdmin(id)).toThrow();
});
test("无浏览器的定时对账可发现丢失首条 IPN 的 payment 并查权威状态", async () => {
  mock(repo, "claimDue").mockResolvedValue([order]);
  mock(repo, "event").mockResolvedValue(undefined);
  const discover = mock(
    paymentProvider.client,
    "discoverPayments",
  ).mockResolvedValue(["123"]);
  const lookup = mock(paymentProvider.client, "getPayment").mockResolvedValue({
    ...authoritative,
    payment_status: "finished",
    actually_paid: "1",
  });
  mock(repo, "apply").mockResolvedValue({ ...order, status: "paid" });
  expect(await paymentService.reconcileDue()).toEqual([{ id, status: "paid" }]);
  expect(discover).toHaveBeenCalled();
  expect(lookup).toHaveBeenCalledWith("123");
});
test("HTTP webhook 必须验签；后台调度没有密钥拒绝，带密钥才执行", async () => {
  mock(repo, "event").mockResolvedValue(undefined);
  const due = mock(repo, "claimDue").mockResolvedValue([]);
  expect(
    (
      await app.request("/billing/webhooks/nowpayments", {
        method: "POST",
        body: raw,
      })
    ).status,
  ).toBe(401);
  expect(
    (await app.request("/billing/internal/reconcile", { method: "POST" }))
      .status,
  ).toBe(401);
  expect(due).not.toHaveBeenCalled();
  expect(
    (
      await app.request("/billing/internal/reconcile", {
        method: "POST",
        headers: { "X-Folune-Reconcile-Key": "test-reconcile" },
      })
    ).status,
  ).toBe(200);
});
test("创建响应晚到调用原子 attach，不以普通 PATCH 覆盖已付款状态", async () => {
  const original = Object.getOwnPropertyDescriptor(
    paymentProvider,
    "availability",
  )!;
  Object.defineProperty(paymentProvider, "availability", {
    configurable: true,
    get: () => ({ available: true, provider: "nowpayments" }),
  });
  spies.push({
    mockRestore: () =>
      Object.defineProperty(paymentProvider, "availability", original),
  });
  mock(repo, "prepare").mockResolvedValue({ ...order, status: "created" });
  mock(repo, "claimInvoice").mockResolvedValue(true);
  mock(paymentProvider.client, "createInvoice").mockResolvedValue({
    invoice_id: "456",
    checkout_url: "https://sandbox.nowpayments.io/payment/?iid=456",
  });
  const attach = mock(repo, "attachInvoice").mockResolvedValue({
    ...order,
    status: "paid",
  });
  const patch = mock(repo, "patch");
  mock(repo, "event").mockResolvedValue(undefined);
  const result = await paymentService.checkout({
    user_id: id,
    key: id,
    kind: "credits",
    sku: "credits_500",
    interval: null,
    amount: 500,
    tokens: 5000000,
  });
  expect(result.status).toBe("ready");
  expect(attach).toHaveBeenCalled();
  expect(patch).not.toHaveBeenCalled();
});

test("付款等待超过两天不会被本地时钟提前判过期", async () => {
  const pending = {
    ...order,
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  };
  mock(repo, "claimDue").mockResolvedValue([pending]);
  mock(paymentProvider.client, "discoverPayments").mockResolvedValue([]);
  const patch = mock(repo, "patch").mockResolvedValue(pending);
  mock(repo, "event").mockResolvedValue(undefined);
  expect(await paymentService.reconcileDue()).toEqual([
    { id, status: "pending" },
  ]);
  expect(patch).toHaveBeenCalledWith(
    id,
    expect.not.objectContaining({ status: "expired" }),
    "pending",
  );
});

test("通知标记重复入金时不会用二次查询丢失标记来绕过核查", async () => {
  mock(repo, "get").mockResolvedValue(order);
  mock(repo, "event").mockResolvedValue(undefined);
  const lookup = mock(paymentProvider.client, "getPayment");
  const apply = mock(repo, "apply");
  const body = {
    order_id: id,
    payment_id: 123,
    parent_payment_id: 122,
    payment_status: "finished",
  };
  const raw = JSON.stringify(body);
  const signature = createHmac("sha512", "test-ipn")
    .update(JSON.stringify(body, Object.keys(body).sort()))
    .digest("hex");
  await expect(paymentService.ipn(raw, signature)).rejects.toMatchObject({
    code: "PAYMENT_DEPOSIT_REQUIRES_REVIEW",
  });
  expect(lookup).not.toHaveBeenCalled();
  expect(apply).not.toHaveBeenCalled();
});

test("旧固定报价在本人和管理订单中都引导重选，不继续返回原收银台", async () => {
  const legacy = { ...order, is_fixed_rate: true, checkout_url: "https://nowpayments.io/payment/?iid=456", fulfilled_at: null, refunded_at: null };
  mock(repo, "get").mockResolvedValue(legacy);
  mock(repo, "list").mockResolvedValue([legacy]);
  expect(await paymentService.get(id, id)).toMatchObject({ checkout_url: null, checkout_replacement_required: true });
  expect((await paymentService.adminOrders())[0]).toMatchObject({ checkout_url: null, checkout_replacement_required: true });
});
