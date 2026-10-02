/**
 * [INPUT]: 依赖 happy-dom、真实 BillingProvider/useBilling 与可延迟的订阅 HTTP 边界
 * [OUTPUT]: 验证多消费者请求合并、保留旧快照的刷新/失败重试、卸载和账户切换隔离，以及 StrictMode effect 重放恢复
 * [POS]: shared/api 的账户级订阅读取生命周期门禁；测试只替换网络，不以 DOM 结果代替真实支付或权限证明
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { StrictMode } from "react";
import { Window } from "happy-dom";
import type { BillingCatalog, BillingOverview } from "./subscription";

const browserWindow = new Window({ url: "http://localhost:10000/app" });
Object.assign(globalThis, {
  window: browserWindow,
  document: browserWindow.document,
  HTMLElement: browserWindow.HTMLElement,
  Element: browserWindow.Element,
  Node: browserWindow.Node,
});
const { act, cleanup, fireEvent, render, waitFor } = await import("@testing-library/react/pure");
const api = await import("./subscription");
const { BillingProvider, useBilling } = await import("./useBilling");

const catalog: BillingCatalog = { tokens_per_credit: 10000, plans: [], checkout: { available: false, provider: null } };
const overview = (remaining: number): BillingOverview => ({
  credits: { tokens_per_credit: 10000, used: (1000 - remaining) / 10000, daily: 0.1, monthly: 0, balance: remaining / 10000, resets_at: "2026-10-01T00:00:00Z" },
  subscription: { plan_id: "free", status: "free", billing_interval: null, current_period_start: null, current_period_end: null, cancel_at_period_end: false },
  usage: { usage_date: "2026-09-30", total_tokens: 1_000 - remaining, daily_limit: 1_000, remaining, exceeded: remaining === 0, resets_at: "2026-10-01T00:00:00Z", timezone: "UTC" },
  checkout: { available: false, provider: null },
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
type Request<T> = ReturnType<typeof deferred<T>> & { signal: AbortSignal | undefined };
const catalogRequests: Request<BillingCatalog>[] = [];
const overviewRequests: Request<BillingOverview>[] = [];
let catalogSpy: ReturnType<typeof spyOn<typeof api, "getBillingCatalog">>;
let overviewSpy: ReturnType<typeof spyOn<typeof api, "getBillingOverview">>;

function Consumer({ name }: { name: string }) {
  const state = useBilling();
  return <section aria-label={name}>
    <output data-testid={`${name}-value`}>{state.overview?.usage.remaining ?? "unknown"}</output>
    <output data-testid={`${name}-state`}>{state.loading ? "loading" : state.refreshing ? "refreshing" : "settled"}</output>
    {state.error ? <p role="alert">{state.error}</p> : null}
    <button onClick={() => void state.refresh()} type="button">刷新 {name}</button>
  </section>;
}
function Account({ userId }: { userId: string }) {
  return <BillingProvider key={userId}><Consumer name="menu" /><Consumer name="settings" /></BillingProvider>;
}
async function resolveRequest(index: number, remaining: number) {
  await act(async () => {
    catalogRequests[index]!.resolve(catalog);
    overviewRequests[index]!.resolve(overview(remaining));
  });
}

beforeEach(() => {
  catalogRequests.length = 0;
  overviewRequests.length = 0;
  catalogSpy = spyOn(api, "getBillingCatalog").mockImplementation((signal) => {
    const request = { ...deferred<BillingCatalog>(), signal };
    catalogRequests.push(request);
    return request.promise;
  });
  overviewSpy = spyOn(api, "getBillingOverview").mockImplementation((signal) => {
    const request = { ...deferred<BillingOverview>(), signal };
    overviewRequests.push(request);
    return request.promise;
  });
});
afterEach(() => {
  cleanup();
  catalogSpy.mockRestore();
  overviewSpy.mockRestore();
});

describe("账户级 BillingProvider", () => {
  test("菜单与设置共享首次读取和在途刷新，返回后一起显示同一快照", async () => {
    const view = render(<Account userId="alice" />);
    expect(catalogRequests).toHaveLength(1);
    expect(overviewRequests).toHaveLength(1);
    fireEvent.click(view.getByRole("button", { name: "刷新 menu" }));
    fireEvent.click(view.getByRole("button", { name: "刷新 settings" }));
    expect(overviewRequests).toHaveLength(1);
    await resolveRequest(0, 600);
    expect(view.getByTestId("menu-value").textContent).toBe("600");
    expect(view.getByTestId("settings-value").textContent).toBe("600");
    fireEvent.click(view.getByRole("button", { name: "刷新 menu" }));
    fireEvent.click(view.getByRole("button", { name: "刷新 settings" }));
    expect(overviewRequests).toHaveLength(2);
    expect(view.getByTestId("menu-state").textContent).toBe("refreshing");
    expect(view.getByTestId("menu-value").textContent).toBe("600");
    await resolveRequest(1, 550);
    expect(view.getByTestId("settings-value").textContent).toBe("550");
  });

  test("刷新失败保留先前用量，并允许下一次重新请求", async () => {
    const view = render(<Account userId="alice" />);
    await resolveRequest(0, 700);
    fireEvent.click(view.getByRole("button", { name: "刷新 settings" }));
    await act(async () => {
      catalogRequests[1]!.resolve(catalog);
      overviewRequests[1]!.reject(new Error("network unavailable"));
    });
    expect(view.getByTestId("menu-value").textContent).toBe("700");
    expect(view.getByTestId("menu-state").textContent).toBe("settled");
    expect(view.getAllByRole("alert")).toHaveLength(2);
    fireEvent.click(view.getByRole("button", { name: "刷新 menu" }));
    expect(overviewRequests).toHaveLength(3);
    expect(view.queryAllByRole("alert")).toHaveLength(0);
    await resolveRequest(2, 650);
    expect(view.getByTestId("menu-value").textContent).toBe("650");
  });

  test("账户 key 改变立即清空旧快照，取消旧请求且忽略不遵守 abort 的晚回包", async () => {
    const view = render(<Account userId="alice" />);
    await resolveRequest(0, 800);
    fireEvent.click(view.getByRole("button", { name: "刷新 menu" }));
    view.rerender(<Account userId="bob" />);
    expect(overviewRequests[1]!.signal?.aborted).toBe(true);
    expect(view.getByTestId("menu-value").textContent).toBe("unknown");
    expect(overviewRequests).toHaveLength(3);
    await resolveRequest(2, 120);
    await resolveRequest(1, 790);
    expect(view.getByTestId("menu-value").textContent).toBe("120");
    view.unmount();
    expect(overviewRequests[2]!.signal?.aborted).toBe(true);
  });

  test("StrictMode 首次 effect 被清理后再次读取，不被旧 in-flight 锁住", async () => {
    const view = render(<StrictMode><Account userId="alice" /></StrictMode>);
    await waitFor(() => expect(overviewRequests).toHaveLength(2));
    expect(overviewRequests[0]!.signal?.aborted).toBe(true);
    await resolveRequest(1, 450);
    await resolveRequest(0, 999);
    expect(view.getByTestId("menu-state").textContent).toBe("settled");
    expect(view.getByTestId("menu-value").textContent).toBe("450");
    fireEvent.click(view.getByRole("button", { name: "刷新 menu" }));
    expect(overviewRequests).toHaveLength(3);
    await resolveRequest(2, 400);
    expect(view.getByTestId("settings-value").textContent).toBe("400");
  });
});
