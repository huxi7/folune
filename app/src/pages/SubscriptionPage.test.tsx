/**
 * [INPUT]: 依赖 happy-dom、真实 SubscriptionPage/DS 组件与可控 billing 边界
 * [OUTPUT]: 包含支付后同单跟踪、待核对和返回窗口刷新回归； 验证服务端报价到月年摘要、未开放不冒充生效、请求失败重试、取消中止及未知用量不造零
 * [POS]: pages 的订阅流程集成门禁；不模拟真实付款，也不替代浏览器视觉验收 验证重试保持同一幂等键与购买余额字段。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { Window } from "happy-dom";
import type { BillingCatalog, BillingOverview } from "../shared/api/subscription";
import type { PaymentOrder } from "../shared/api/payments";

const browserWindow = new Window({ url: "http://localhost:10000/app/subscription" });
Object.assign(globalThis, {
  window: browserWindow,
  document: browserWindow.document,
  HTMLElement: browserWindow.HTMLElement,
  Element: browserWindow.Element,
  Node: browserWindow.Node,
  requestAnimationFrame: browserWindow.requestAnimationFrame.bind(browserWindow),
  cancelAnimationFrame: browserWindow.cancelAnimationFrame.bind(browserWindow),
});
const { act, cleanup, fireEvent, render, waitFor, within } = await import("@testing-library/react/pure");
const billing = await import("../shared/api/useBilling");
const subscription = await import("../shared/api/subscription");
const payments = await import("../shared/api/payments");
const { SubscriptionPage } = await import("./SubscriptionPage");

const profile = { id: "viewer", username: "测试用户", email: "test@example.com", avatarUrl: null, bio: null };
const catalog: BillingCatalog = {
  tokens_per_credit: 10000,
  plans: [
    { id: "starter", name: "Starter", description: "轻量记录", daily_token_limit: 2_000_000, credits: { daily: 200, monthly: 0 }, features: ["AI 写作"], highlighted: false,
      prices: { monthly: { amount: 500, currency: "USD", interval: "month" }, yearly: { amount: 4800, currency: "USD", interval: "year" } } },
    { id: "pro", name: "Pro", description: "持续记录", daily_token_limit: 10_000_000, credits: { daily: 1000, monthly: 0 }, features: ["AI 写作"], highlighted: true,
      prices: { monthly: { amount: 2000, currency: "USD", interval: "month" }, yearly: { amount: 19200, currency: "USD", interval: "year" } } },
  ],
  checkout: { available: false, provider: null },
};
const overview: BillingOverview = {
  credits: { tokens_per_credit: 10000, used: 0.8, daily: 10, monthly: 0, balance: 9.2, resets_at: "2026-09-30T00:00:00Z" },
  subscription: { plan_id: "free", status: "free", billing_interval: null, current_period_start: null, current_period_end: null, cancel_at_period_end: false },
  usage: { usage_date: "2026-09-29", total_tokens: 8_000, daily_limit: 100_000, remaining: 92_000, exceeded: false, resets_at: "2026-09-30T00:00:00Z", timezone: "UTC" },
  checkout: { available: false, provider: null },
};
const unavailable = { status: "unavailable" as const, code: "PAYMENT_NOT_CONFIGURED" as const, message: "在线订阅即将开放", checkout_url: null };
let billingSpy: ReturnType<typeof spyOn<typeof billing, "useBilling">>;
let checkoutSpy: ReturnType<typeof spyOn<typeof subscription, "createCheckout">>;
const paymentSpies: { mockRestore: () => void }[] = [];

beforeEach(() => {
  billingSpy = spyOn(billing, "useBilling").mockReturnValue({ catalog, overview, loading: false, refreshing: false, error: null, refresh: async () => {} });
  checkoutSpy = spyOn(subscription, "createCheckout").mockResolvedValue(unavailable);
});
afterEach(() => {
  cleanup();
  billingSpy.mockRestore();
  checkoutSpy.mockRestore();
  paymentSpies.splice(0).forEach(spy => spy.mockRestore());
});

test("前往收银台后跟踪本次订单，不查询或展示另一笔历史订单", async () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const url = "https://nowpayments.io/payment/?iid=123";
  checkoutSpy.mockResolvedValue({ status: "ready", checkout_url: url, order_id: id });
  const open = spyOn(payments, "openCheckout").mockImplementation(() => {});
  const order: PaymentOrder = { id, kind: "subscription", sku: "starter", billing_interval: "monthly", amount_cents: 500, status: "pending", checkout_url: url, created_at: new Date().toISOString(), fulfilled_at: null };
  const get = spyOn(payments, "getOrder").mockResolvedValue(order);
  const update = spyOn(payments, "refreshOrder").mockResolvedValue(order);
  paymentSpies.push(open, get, update);
  const view = render(<SubscriptionPage profile={profile} onBack={() => {}} onBuyCredits={() => {}} />);
  fireEvent.click(view.getByRole("button", { name: "订阅 Starter" }));
  await waitFor(() => expect(view.getByRole("button", { name: "前往支付" })).toBeTruthy());
  fireEvent.click(view.getByRole("button", { name: "前往支付" }));
  await waitFor(() => expect(view.getByText("等待付款")).toBeTruthy());
  expect(open).toHaveBeenCalledWith(url);
  expect(get).toHaveBeenCalledWith(id, expect.any(AbortSignal));
  expect(view.queryByText("正在准备订阅")).toBeNull();
});

test("待核对订单提供查看入口，不永久停在准备中", async () => {
  const id = "11111111-1111-4111-8111-111111111111";
  checkoutSpy.mockResolvedValue({ status: "pending", order_id: id, message: "checking" });
  const get = spyOn(payments, "getOrder").mockResolvedValue({ id, kind: "subscription", sku: "starter", billing_interval: "monthly", amount_cents: 500, status: "review", checkout_url: null, created_at: new Date().toISOString(), fulfilled_at: null });
  paymentSpies.push(get);
  const view = render(<SubscriptionPage profile={profile} onBack={() => {}} onBuyCredits={() => {}} />);
  fireEvent.click(view.getByRole("button", { name: "订阅 Starter" }));
  await waitFor(() => expect(view.getByRole("button", { name: "查看订单" })).toBeTruthy());
  expect(view.queryByRole("button", { name: "准备中" })).toBeNull();
  fireEvent.click(view.getByRole("button", { name: "查看订单" }));
  await waitFor(() => expect(view.getByText("需要人工核查")).toBeTruthy());
  expect(checkoutSpy).toHaveBeenCalledTimes(1);
});

describe("订阅页面的真实结算边界", () => {
  test("按年显示月均与全年实际金额，未开放不会生成成功回执", async () => {
    const view = render(<SubscriptionPage profile={profile} onBack={() => {}} onBuyCredits={() => {}} />);
    expect(view.getByText("200")).toBeTruthy();
    expect(view.getByText("9.2")).toBeTruthy();
    fireEvent.click(view.getByRole("switch", { name: "按年订阅" }));
    expect(view.getByText("$48")).toBeTruthy();
    expect(view.getByText("$4 / 月")).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "订阅 Starter" }));
    await waitFor(() => expect(view.getByText("在线订阅即将开放")).toBeTruthy());
    const dialog = within(view.getByRole("dialog"));
    expect(dialog.getByText("$48")).toBeTruthy();
    expect(checkoutSpy.mock.calls[0]?.[0]).toEqual({ plan_id: "starter", billing_interval: "yearly", idempotency_key: expect.any(String) });
    expect(dialog.getByText("本次没有产生订单或扣款，你仍可继续使用 Folune。")).toBeTruthy();
    expect(view.queryByText("订阅成功")).toBeNull();
    expect(view.queryByRole("button", { name: "前往支付" })).toBeNull();
    expect(view.getByText("Free")).toBeTruthy();
  });

  test("失败保留报价并重试相同方案，不把未知用量显示为零", async () => {
    billingSpy.mockReturnValue({ catalog, overview: null, loading: false, refreshing: false, error: null, refresh: async () => {} });
    checkoutSpy.mockRejectedValueOnce(new Error("服务暂时不可用"));
    const view = render(<SubscriptionPage profile={profile} onBack={() => {}} onBuyCredits={() => {}} />);
    expect(view.queryByText(/今日剩余/)).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "订阅 Pro" }));
    await waitFor(() => expect(view.getByText("服务暂时不可用")).toBeTruthy());
    expect(within(view.getByRole("dialog")).getByText("$20")).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "重试" }));
    await waitFor(() => expect(view.getByText("在线订阅即将开放")).toBeTruthy());
    expect(checkoutSpy.mock.calls).toHaveLength(2);
    expect(checkoutSpy.mock.calls[1]?.[0]).toEqual({ plan_id: "pro", billing_interval: "monthly", idempotency_key: checkoutSpy.mock.calls[0]?.[0].idempotency_key });
  });

  test("关闭准备中的弹窗中止请求，晚到结果不重新打开弹窗", async () => {
    let finish!: (value: typeof unavailable) => void;
    checkoutSpy.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const view = render(<SubscriptionPage profile={profile} onBack={() => {}} onBuyCredits={() => {}} />);
    fireEvent.click(view.getByRole("button", { name: "订阅 Starter" }));
    const signal = checkoutSpy.mock.calls[0]?.[1];
    expect(view.getByText("正在准备订阅")).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "取消" }));
    expect(signal?.aborted).toBe(true);
    await act(async () => { finish(unavailable); });
    expect(view.queryByRole("dialog")).toBeNull();
  });
});

test("升级只展示付费档，普通与高阶按钮分层，积分购买只触发预留入口", async () => {
  const free = { ...catalog.plans[0]!, id: "free" as const, name: "Free" };
  billingSpy.mockReturnValue({ catalog: { ...catalog, plans: [free, ...catalog.plans] }, overview, loading: false, refreshing: false, error: null, refresh: async () => {} });
  let buyCount = 0;
  const view = render(<SubscriptionPage profile={profile} onBack={() => {}} onBuyCredits={() => { buyCount += 1; }} />);
  expect(view.queryByRole("heading", { name: "Folune Free" })).toBeNull();
  expect(view.getByText("流行")).toBeTruthy();
  expect(view.getByRole("button", { name: "订阅 Starter" }).classList.contains("ds-button")).toBe(true);
  expect(view.getByRole("button", { name: "订阅 Pro" }).classList.contains("glow-button")).toBe(true);
  expect(view.getByLabelText("当前账户积分").textContent).toContain("购买积分 0");
  fireEvent.click(view.getByRole("button", { name: "购买积分" }));
  expect(buyCount).toBe(1);
  expect(checkoutSpy).not.toHaveBeenCalled();
});


test("英文订阅保留原账户身份和服务端报价，年付文案同步切换", async () => {
  const { LocaleProvider } = await import("../shared/locale/LocaleProvider");
  browserWindow.localStorage.setItem("folune-locale", "en");
  try {
    const view = render(<LocaleProvider><SubscriptionPage profile={profile} onBack={() => {}} onBuyCredits={() => {}} /></LocaleProvider>);
    expect(view.getByText("测试用户")).toBeTruthy();
    expect(view.getByText("Popular")).toBeTruthy();
    expect(view.getByRole("button", { name: "Buy credits" })).toBeTruthy();
    fireEvent.click(view.getByRole("switch", { name: "Annual billing" }));
    expect(view.getByText("$48")).toBeTruthy();
    expect(view.getByText("$4 / month")).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: "Subscribe to Starter" }));
    await waitFor(() => expect(view.getByText("Subscriptions are coming soon")).toBeTruthy());
    expect(checkoutSpy.mock.calls[0]?.[0]).toEqual({ plan_id: "starter", billing_interval: "yearly", idempotency_key: expect.any(String) });
  } finally {
    browserWindow.localStorage.removeItem("folune-locale");
  }
});
