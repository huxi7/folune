/**
 * [INPUT]: 依赖 happy-dom、真实 PricingPage/Router/公开 API 与可控 fetch
 * [OUTPUT]: 验证匿名目录、月年价格与每日额度、登录引导、失败重试和卸载取消
 * [POS]: 公开价格的行为门禁；保留真实 HTTP 信封边界，不模拟付款或冒充视觉验收
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { Window } from "happy-dom";
import type { BillingCatalog, PlanId } from "../shared/api/subscription";

const browserWindow = new Window({ url: "http://localhost:10000/pricing" });
Object.assign(globalThis, {
  window: browserWindow, document: browserWindow.document,
  HTMLElement: browserWindow.HTMLElement, Element: browserWindow.Element,
  Node: browserWindow.Node, IntersectionObserver: browserWindow.IntersectionObserver,
  requestAnimationFrame: browserWindow.requestAnimationFrame.bind(browserWindow),
  cancelAnimationFrame: browserWindow.cancelAnimationFrame.bind(browserWindow),
});
const { cleanup, fireEvent, render, waitFor } = await import("@testing-library/react/pure");
const { createMemoryRouter, RouterProvider } = await import("react-router-dom");
const { PricingPage } = await import("./PricingPage");
const { apiRequest } = await import("../shared/api/client");
const auth = await import("../shared/supabase/auth");
const originalFetch = globalThis.fetch;
let authSpy: ReturnType<typeof spyOn<typeof auth, "getAuthenticatedAccessToken">>;
const requests: RequestInit[] = [];
const catalog: BillingCatalog = {
  tokens_per_credit: 10_000,
  checkout: { available: true, provider: "nowpayments" },
  plans: (["free", "starter", "pro", "studio"] as PlanId[]).map((id, index) => ({
    id, name: ["Free", "Starter", "Pro", "Studio"][index]!, description: "适合你的记录习惯",
    prices: {
      monthly: { amount: [0, 500, 2000, 10000][index]!, currency: "USD", interval: "month" },
      yearly: { amount: [0, 4800, 19200, 96000][index]!, currency: "USD", interval: "year" },
    },
    daily_token_limit: 0, credits: { daily: [10, 200, 1000, 5000][index]!, monthly: 0 },
    features: ["AI 对话与写作 · 从提问到成稿", "知识画布 · 连接想法"], highlighted: id === "pro",
  })),
};
function respond() { return Response.json({ code: "ok", message: "OK", data: catalog }); }
function showPricing() {
  const router = createMemoryRouter([
    { path: "/pricing", element: <PricingPage /> },
    { path: "/login", element: <h1>登录 Folune</h1> },
  ], { initialEntries: ["/pricing"] });
  return { ...render(<RouterProvider router={router} />), router };
}
beforeEach(() => {
  document.head.innerHTML = '<title>Folune</title><meta name="description" content="记录">';
  requests.length = 0;
  authSpy = spyOn(auth, "getAuthenticatedAccessToken").mockResolvedValue(null);
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    expect(String(url)).toEndWith("/billing/plans");
    requests.push(init ?? {});
    return respond();
  }) as unknown as typeof fetch;
});
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; authSpy.mockRestore(); });

test("匿名显示四档，付费周期只改变价格，所有 CTA 引导登录", async () => {
  const view = showPricing();
  await waitFor(() => expect(view.getAllByRole("article")).toHaveLength(4));
  expect(authSpy).not.toHaveBeenCalled();
  expect(requests).toHaveLength(1);
  expect(new Headers(requests[0]?.headers).has("Authorization")).toBe(false);
  expect(requests[0]?.credentials).toBe("omit");
  for (const price of ["$0", "$5", "$20", "$100"]) expect(view.getByText(price)).toBeTruthy();
  fireEvent.click(view.getByRole("switch", { name: "按年订阅" }));
  for (const price of ["$0", "$48", "$192", "$960"]) expect(view.getByText(price)).toBeTruthy();
  for (const credits of ["10", "200", "1,000", "5,000"]) expect(view.getByText(credits)).toBeTruthy();
  expect(view.getByText("$4 / 月")).toBeTruthy();
  expect(requests).toHaveLength(1);
  for (const label of ["免费开始", "订阅 Starter", "订阅 Pro", "订阅 Studio"]) {
    expect(view.getByRole("button", { name: label })).toBeTruthy();
  }
  expect(document.title).toBe("价格方案 · Folune");
  fireEvent.click(view.getByRole("button", { name: "订阅 Pro" }));
  await waitFor(() => expect(view.getByRole("heading", { name: "登录 Folune" })).toBeTruthy());
  expect(requests).toHaveLength(1);
});

test("目录失败不伪造报价，可原位重试", async () => {
  globalThis.fetch = (async () => Response.json({ code: "UNAVAILABLE", message: "内部信息", data: null }, { status: 503 })) as unknown as typeof fetch;
  const view = showPricing();
  await waitFor(() => expect(view.getByRole("alert")).toBeTruthy());
  expect(view.queryByText("内部信息")).toBeNull();
  expect(view.queryAllByRole("article")).toHaveLength(0);
  globalThis.fetch = (async () => respond()) as unknown as typeof fetch;
  fireEvent.click(view.getByRole("button", { name: "重新加载" }));
  await waitFor(() => expect(view.getAllByRole("article")).toHaveLength(4));
});

test("离开价格页取消在途请求，迟到结果不更新卸载页面", () => {
  let signal: AbortSignal | null | undefined;
  globalThis.fetch = ((_url: RequestInfo | URL, init?: RequestInit) => {
    signal = init?.signal;
    return new Promise<Response>((_resolve, reject) => signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))));
  }) as unknown as typeof fetch;
  const view = showPricing();
  expect(signal?.aborted).toBe(false);
  view.unmount();
  expect(signal?.aborted).toBe(true);
});

test("公开 GET 不改变受保护 API 的登录门禁", async () => {
  await expect(apiRequest("/billing/overview")).rejects.toMatchObject({ status: 401, code: "AUTH_SESSION_REQUIRED" });
  expect(requests).toHaveLength(0);
});
