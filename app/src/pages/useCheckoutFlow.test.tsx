/**
 * [INPUT]: 依赖真实结账 Hook、happy-dom 与可控 HTTP/Toast/权益边界
 * [OUTPUT]: 验证单次导航、连点/重试幂等、迟到隔离、未知创建恢复及返回付款核对
 * [POS]: 支付交接行为门禁；仅服务端 paid 能触发成功，替身不代表真实转账验收
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { Window } from "happy-dom";
import type { CheckoutResult } from "../shared/api/subscription";
import type { PaymentOrder } from "../shared/api/payments";

const browser = new Window({ url: "http://localhost:10000/app/subscription" });
Object.assign(globalThis, { window: browser, document: browser.document, HTMLElement: browser.HTMLElement, Element: browser.Element, Node: browser.Node });
const { act, cleanup, renderHook, waitFor } = await import("@testing-library/react/pure");
const api = await import("../shared/api/subscription");
const payments = await import("../shared/api/payments");
const billing = await import("../shared/api/useBilling");
const notifications = await import("../shared/design-system/components/Toast");
const { useCheckoutFlow } = await import("./useCheckoutFlow");
const intent = { kind: "subscription" as const, plan_id: "starter" as const, billing_interval: "monthly" as const };
const url = "https://nowpayments.io/payment/?iid=123";
const order: PaymentOrder = { id: "11111111-1111-4111-8111-111111111111", kind: "subscription", sku: "starter", billing_interval: "monthly", amount_cents: 500, status: "pending", checkout_url: url, created_at: "2026-10-04T00:00:00Z", fulfilled_at: null };
const spies: { mockRestore(): void }[] = [];
let create: ReturnType<typeof spyOn<typeof api, "createCheckout">>;
let open: ReturnType<typeof spyOn<typeof payments, "openCheckout">>;
let get: ReturnType<typeof spyOn<typeof payments, "getOrder">>;
let check: ReturnType<typeof spyOn<typeof payments, "refreshOrder">>;
const refresh = mock(async () => {});
const toast = mock(() => 1);
beforeEach(() => {
  browser.history.replaceState(null, "", "/app/subscription");
  refresh.mockClear(); toast.mockClear();
  create = spyOn(api, "createCheckout").mockResolvedValue({ status: "ready", checkout_url: url, order_id: order.id });
  open = spyOn(payments, "openCheckout").mockImplementation(() => {});
  get = spyOn(payments, "getOrder").mockResolvedValue(order);
  check = spyOn(payments, "refreshOrder").mockResolvedValue(order);
  spies.push(create, open, get, check,
    spyOn(billing, "useBilling").mockReturnValue({ catalog: null, overview: null, loading: false, refreshing: false, error: null, refresh }),
    spyOn(notifications, "useToast").mockReturnValue({ toast, dismissToast: () => {} }));
});
afterEach(() => { cleanup(); spies.splice(0).forEach(spy => spy.mockRestore()); });

test("同帧连点只创建一次，准备后自动跳转并保留回程身份", async () => {
  const { result } = renderHook(() => useCheckoutFlow("subscription"));
  await act(async () => { await Promise.all([result.current.start(intent), result.current.start(intent)]); });
  expect(create).toHaveBeenCalledTimes(1);
  expect(open).toHaveBeenCalledTimes(1);
  expect(browser.location.search).toContain(order.id);
  await act(async () => result.current.start(intent));
  expect(create).toHaveBeenCalledTimes(1);
  expect(toast).not.toHaveBeenCalled();
});

test("失败重试沿用原幂等键，换方案才创建新意图", async () => {
  create.mockRejectedValue(new Error("offline"));
  const { result } = renderHook(() => useCheckoutFlow("subscription"));
  await act(async () => result.current.start(intent));
  await act(async () => result.current.retry());
  expect(create.mock.calls[1]?.[0].idempotency_key).toBe(create.mock.calls[0]?.[0].idempotency_key);
  await act(async () => result.current.start({ ...intent, plan_id: "pro" }));
  expect(create.mock.calls[2]?.[0].idempotency_key).not.toBe(create.mock.calls[0]?.[0].idempotency_key);
});

test("取消后迟到的有效付款链接不能导航或留下购买身份", async () => {
  let finish!: (value: CheckoutResult) => void;
  create.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const { result } = renderHook(() => useCheckoutFlow("subscription"));
  let pending!: Promise<void>;
  act(() => { pending = result.current.start(intent); });
  act(() => result.current.reset());
  await act(async () => { finish({ status: "ready", checkout_url: url, order_id: order.id }); await pending; });
  expect(open).not.toHaveBeenCalled();
  expect(browser.location.search).toBe("");
  expect(result.current.state.status).toBe("idle");
});

test("未知创建结果读取原付款，链接恢复后自动继续而不要求确认", async () => {
  create.mockResolvedValue({ status: "pending", order_id: order.id, message: "checking" });
  const { result } = renderHook(() => useCheckoutFlow("subscription"));
  await act(async () => result.current.start(intent));
  expect(create).toHaveBeenCalledTimes(1);
  expect(get).toHaveBeenCalledWith(order.id, expect.any(AbortSignal));
  expect(open).toHaveBeenCalledWith(url);
});

test("旧报价不能被自动打开，异常允许重试", async () => {
  create.mockResolvedValue({ status: "pending", order_id: order.id, message: "checking" });
  get.mockResolvedValue({ ...order, checkout_replacement_required: true });
  const { result } = renderHook(() => useCheckoutFlow("subscription"));
  await act(async () => result.current.start(intent));
  expect(open).not.toHaveBeenCalled();
  expect(result.current.state.status).toBe("error");
});

test("返回参数不冒充付款，服务端确认后刷新权益并清除回程参数", async () => {
  browser.history.replaceState(null, "", `?order=${order.id}`);
  renderHook(() => useCheckoutFlow("subscription"));
  await waitFor(() => expect(check).toHaveBeenCalledTimes(1));
  expect(refresh).not.toHaveBeenCalled();
  expect(toast).not.toHaveBeenCalled();
  check.mockResolvedValue({ ...order, status: "paid" });
  act(() => browser.dispatchEvent(new browser.Event("focus")));
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  expect(toast).toHaveBeenCalledTimes(1);
  expect(browser.location.search).toBe("");
});

test("从浏览器后退恢复时退出过渡，不自动重新跳转", async () => {
  const { result } = renderHook(() => useCheckoutFlow("subscription"));
  await act(async () => result.current.start(intent));
  expect(result.current.state.status).toBe("loading");
  act(() => browser.dispatchEvent(new browser.Event("pageshow")));
  expect(result.current.state.status).toBe("idle");
  expect(open).toHaveBeenCalledTimes(1);
});

test("卸载取消在途创建，迟到结果不会跳走其他页面", async () => {
  let finish!: (value: CheckoutResult) => void;
  create.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const { result, unmount } = renderHook(() => useCheckoutFlow("subscription"));
  let pending!: Promise<void>;
  act(() => { pending = result.current.start(intent); });
  unmount();
  await act(async () => { finish({ status: "ready", checkout_url: url }); await pending; });
  expect(open).not.toHaveBeenCalled();
});

test("一次后台查单超时不关闭后续返回核对", async () => {
  browser.history.replaceState(null, "", `?order=${order.id}`);
  let expire!: () => void;
  const originalTimeout = browser.setTimeout.bind(browser);
  spies.push(spyOn(browser, "setTimeout").mockImplementation((handler, delay, ...args) => {
    if (delay === 15_000) expire = handler as () => void;
    return originalTimeout(handler, delay, ...args);
  }));
  get.mockImplementationOnce((_id, signal) => new Promise((_resolve, reject) => {
    signal?.addEventListener("abort", () => reject(new Error("timeout")), { once: true });
  }));
  renderHook(() => useCheckoutFlow("subscription"));
  await act(async () => expire());
  check.mockResolvedValue({ ...order, status: "paid" });
  act(() => browser.dispatchEvent(new browser.Event("focus")));
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  expect(toast).toHaveBeenCalledTimes(1);
});

test("创建超时离开过渡，重试仍使用原幂等键", async () => {
  let expire!: () => void;
  const originalTimeout = browser.setTimeout.bind(browser);
  spies.push(spyOn(browser, "setTimeout").mockImplementation((handler, delay, ...args) => {
    if (delay === 15_000) expire = handler as () => void;
    return originalTimeout(handler, delay, ...args);
  }));
  create.mockImplementationOnce((_input, signal) => new Promise((_resolve, reject) => {
    signal?.addEventListener("abort", () => reject(new Error("timeout")), { once: true });
  }));
  const { result } = renderHook(() => useCheckoutFlow("subscription"));
  let pending!: Promise<void>;
  act(() => { pending = result.current.start(intent); });
  await act(async () => { expire(); await pending; });
  expect(result.current.state.status).toBe("error");
  await act(async () => result.current.retry());
  expect(create.mock.calls[1]?.[0].idempotency_key).toBe(create.mock.calls[0]?.[0].idempotency_key);
  expect(open).toHaveBeenCalledTimes(1);
});
