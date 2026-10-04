/**
 * [INPUT]: 依赖真实收银台导航与 happy-dom 浏览器边界
 * [OUTPUT]: 验证同页跳转、桌面外部打开和付款地址白名单
 * [POS]: 前端支付导航门禁；不访问供应商或创建付款
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { afterEach, expect, spyOn, test } from "bun:test";
import { Window } from "happy-dom";
import { checkoutUrl, openCheckout } from "./payments";
const browser = new Window({ url: "http://localhost:10000/app/subscription" });
Object.assign(globalThis, { window: browser, document: browser.document });
const spies: { mockRestore(): void }[] = [];
afterEach(() => { spies.splice(0).forEach(spy => spy.mockRestore()); delete window.foluneDesktop; });
test("Web 使用当前标签页，异步结账无需弹窗权限", () => {
  const assign = spyOn(browser.location, "assign").mockImplementation(() => {});
  const open = spyOn(browser, "open"); spies.push(assign, open);
  openCheckout("https://nowpayments.io/payment/?iid=123");
  expect(assign).toHaveBeenCalledWith("https://nowpayments.io/payment/?iid=123");
  expect(open).not.toHaveBeenCalled();
});
test("桌面沿既有窗口拦截交给系统浏览器", () => {
  window.foluneDesktop = {} as NonNullable<typeof window.foluneDesktop>;
  const open = spyOn(browser, "open").mockReturnValue(null); spies.push(open);
  openCheckout("https://nowpayments.io/payment/?iid=123");
  expect(open).toHaveBeenCalledWith("https://nowpayments.io/payment/?iid=123", "_blank", "noopener,noreferrer");
});
test("拒绝非供应商主机、不安全协议、凭据与额外端口", () => {
  for (const url of ["javascript:alert(1)", "http://nowpayments.io/payment", "https://nowpayments.io.evil.test/", "https://user@nowpayments.io/", "https://nowpayments.io:8443/"]) {
    expect(() => checkoutUrl(url)).toThrow("Invalid checkout URL");
  }
});
