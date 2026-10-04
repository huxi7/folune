/**
 * [INPUT]: 依赖 happy-dom、真实 CreditsPage/Dialog、LocaleProvider 与可控积分 API/账户用量
 * [OUTPUT]: 验证一次点击自动跳转且不显示订单或二次确认； 验证目录选购、严格结账意图、未知余额、失败重试、关闭中止与英文界面
 * [POS]: pages 的积分购买交互门禁；证明预留支付不冒充成功，不替代真实支付或视觉验收 验证同选择重试保持幂等键与长期有效规则。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { Window } from "happy-dom";
import type { BillingOverview, CreditPackCatalog } from "../shared/api/subscription";

const browserWindow = new Window({ url: "http://localhost:10000/app/subscription/credits" });
Object.assign(globalThis, {
  window: browserWindow, document: browserWindow.document,
  HTMLElement: browserWindow.HTMLElement, Element: browserWindow.Element, Node: browserWindow.Node,
  requestAnimationFrame: browserWindow.requestAnimationFrame.bind(browserWindow),
  cancelAnimationFrame: browserWindow.cancelAnimationFrame.bind(browserWindow),
});
const { act, cleanup, fireEvent, render, waitFor } = await import("@testing-library/react/pure");
const billing = await import("../shared/api/useBilling");
const api = await import("../shared/api/subscription");
const payments = await import("../shared/api/payments");
const { LocaleProvider } = await import("../shared/locale/LocaleProvider");
const toastModule = await import("../shared/design-system/components/Toast");
const { CreditsPage } = await import("./CreditsPage");

const catalog: CreditPackCatalog = {
  status: "preview", tokens_per_credit: 10000, checkout: { available: false, provider: null },
  packs: [
    { id: "credits_500", credits: 500, price: { amount: 500, currency: "USD" } },
    { id: "credits_1000", credits: 1000, price: { amount: 1000, currency: "USD" } },
    { id: "credits_2000", credits: 2000, price: { amount: 2000, currency: "USD" } },
    { id: "credits_5000", credits: 5000, price: { amount: 5000, currency: "USD" } },
    { id: "credits_8000", credits: 8000, price: { amount: 8000, currency: "USD" } },
    { id: "credits_10000", credits: 10000, price: { amount: 10000, currency: "USD" } },
  ],
};
const overview: BillingOverview = {
  credits: { tokens_per_credit: 10000, used: 0.25, daily: 10, monthly: 0, balance: 9.75, resets_at: "2026-10-02T00:00:00Z" },
  subscription: { plan_id: "free", status: "free", billing_interval: null, current_period_start: null, current_period_end: null, cancel_at_period_end: false },
  usage: { usage_date: "2026-10-01", total_tokens: 2500, daily_limit: 100000, remaining: 97500, exceeded: false, resets_at: "2026-10-02T00:00:00Z", timezone: "UTC" },
  checkout: { available: false, provider: null },
};
const unavailable = { status: "unavailable" as const, code: "PAYMENT_NOT_CONFIGURED" as const, message: "积分购买即将开放", checkout_url: null };
let billingSpy: ReturnType<typeof spyOn<typeof billing, "useBilling">>;
let catalogSpy: ReturnType<typeof spyOn<typeof api, "getCreditPacks">>;
let checkoutSpy: ReturnType<typeof spyOn<typeof api, "createCreditCheckout">>;
const paymentSpies: { mockRestore: () => void }[] = [];

beforeEach(() => {
  browserWindow.history.replaceState(null, "", "/app/subscription/credits");
  paymentSpies.push(spyOn(toastModule, "useToast").mockReturnValue({ toast: () => 1, dismissToast: () => {} }));
  browserWindow.localStorage.clear();
  billingSpy = spyOn(billing, "useBilling").mockReturnValue({ catalog: null, overview, loading: false, refreshing: false, error: null, refresh: async () => {} });
  catalogSpy = spyOn(api, "getCreditPacks").mockResolvedValue(catalog);
  checkoutSpy = spyOn(api, "createCreditCheckout").mockResolvedValue(unavailable);
});
afterEach(() => { cleanup(); billingSpy.mockRestore(); catalogSpy.mockRestore(); checkoutSpy.mockRestore(); paymentSpies.splice(0).forEach(spy => spy.mockRestore()); });

test("积分购买一次点击自动跳转，不再切换为确认按钮或订单面板", async () => {
  const url = "https://nowpayments.io/payment/?iid=123";
  const open = spyOn(payments, "openCheckout").mockImplementation(() => {});
  paymentSpies.push(open);
  checkoutSpy.mockResolvedValueOnce({ status: "ready", checkout_url: url });
  const view = render(<CreditsPage onBack={() => {}} />);
  await waitFor(() => expect(view.getAllByRole("radio")).toHaveLength(6));
  fireEvent.click(view.getByRole("button", { name: "购买积分 $5" }));
  await waitFor(() => expect(open).toHaveBeenCalledWith(url));
  expect(view.queryByRole("button", { name: "前往支付" })).toBeNull();
  expect(view.queryByText("订单记录")).toBeNull();
  expect(view.getByRole("status").textContent).toContain("正在前往收银台");
});

test("积分卡由服务端目录生成，选购仅传ID且未开放不冒充购买成功", async () => {
  const view = render(<CreditsPage onBack={() => {}} />);
  await waitFor(() => expect(view.getAllByRole("radio")).toHaveLength(6));
  expect(view.getByText("当前积分余额")).toBeTruthy();
  expect(view.getByText("9.7")).toBeTruthy();
  fireEvent.click(view.getByRole("radio", { name: "10,000 积分 $100" }));
  fireEvent.click(view.getByRole("button", { name: "购买积分 $100" }));
  await waitFor(() => expect(view.getByText("积分购买即将开放。本次没有产生订单或扣款。")).toBeTruthy());
  expect(checkoutSpy.mock.calls[0]?.[0]).toEqual({ pack_id: "credits_10000", idempotency_key: expect.any(String) });
  expect(view.queryByText("购买成功")).toBeNull();
  expect(view.queryByRole("button", { name: "前往支付" })).toBeNull();
  fireEvent.click(view.getByRole("button", { name: "查看积分规则" }));
  expect(view.getByText(/购买积分长期有效/)).toBeTruthy();
});

test("目录加载失败可重试，未知日额度显示破折号", async () => {
  catalogSpy.mockRejectedValueOnce(new Error("offline"));
  billingSpy.mockReturnValue({ catalog: null, overview: null, loading: false, refreshing: false, error: null, refresh: async () => {} });
  const view = render(<CreditsPage onBack={() => {}} />);
  await waitFor(() => expect(view.getByRole("alert")).toBeTruthy());
  expect(view.getByText("—")).toBeTruthy();
  expect(view.getByRole("button", { name: "购买积分" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(view.getByRole("button", { name: "重新加载" }));
  await waitFor(() => expect(view.getAllByRole("radio")).toHaveLength(6));
  expect(catalogSpy.mock.calls).toHaveLength(2);
});

test("关闭进行中的购买中止请求，迟到响应不会写入结果", async () => {
  let complete!: (value: typeof unavailable) => void;
  checkoutSpy.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  let closed = 0;
  const view = render(<CreditsPage onBack={() => { closed += 1; }} />);
  await waitFor(() => expect(view.getAllByRole("radio")).toHaveLength(6));
  fireEvent.click(view.getByRole("button", { name: "购买积分 $5" }));
  const signal = checkoutSpy.mock.calls[0]?.[1];
  fireEvent.click(view.getByRole("button", { name: "关闭积分购买" }));
  expect(signal?.aborted).toBe(true);
  expect(closed).toBe(1);
  await act(async () => complete(unavailable));
  expect(view.queryByText("积分购买即将开放。本次没有产生订单或扣款。")).toBeNull();
});

test("英文目录、状态和规则完整切换，升级动作交给父级", async () => {
  browserWindow.localStorage.setItem("folune-locale", "en");
  let upgraded = 0;
  const view = render(<LocaleProvider><CreditsPage onBack={() => {}} onUpgrade={() => { upgraded += 1; }} /></LocaleProvider>);
  await waitFor(() => expect(view.getAllByRole("radio")).toHaveLength(6));
  expect(view.getByRole("dialog", { name: "Buy credits" })).toBeTruthy();
  expect(view.getByText("Current credit balance")).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "Buy credits $5" }));
  await waitFor(() => expect(view.getByText("Credit purchases are coming soon. No order or charge was created.")).toBeTruthy());
  fireEvent.click(view.getByRole("button", { name: "Or upgrade your plan for more daily credits" }));
  expect(upgraded).toBe(1);
});

test("结账失败保留选择并允许重试，非HTTPS会话不能进入支付", async () => {
  checkoutSpy.mockResolvedValueOnce({ status: "ready", checkout_url: "javascript:alert(1)" });
  const view = render(<CreditsPage onBack={() => {}} />);
  await waitFor(() => expect(view.getAllByRole("radio")).toHaveLength(6));
  fireEvent.click(view.getByRole("radio", { name: "1,000 积分 $10" }));
  fireEvent.click(view.getByRole("button", { name: "购买积分 $10" }));
  await waitFor(() => expect(view.getByText("暂时无法打开收银台，请重试。")).toBeTruthy());
  expect(view.queryByRole("button", { name: "前往支付" })).toBeNull();
  fireEvent.click(view.getByRole("button", { name: "购买积分 $10" }));
  await waitFor(() => expect(view.getByText("积分购买即将开放。本次没有产生订单或扣款。")).toBeTruthy());
  expect(checkoutSpy.mock.calls.map(call => call[0])).toEqual([{ pack_id: "credits_1000", idempotency_key: expect.any(String) }, { pack_id: "credits_1000", idempotency_key: checkoutSpy.mock.calls[0]?.[0].idempotency_key }]);
});
