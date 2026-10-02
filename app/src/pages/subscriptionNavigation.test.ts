/**
 * [INPUT]: 依赖真实 React Router 路径匹配与 subscriptionNavigation 纯解析函数
 * [OUTPUT]: 验证订阅返回只接受内部工作区、笔记/画布路径投影保真、直接订阅默认落点与普通路径不受历史 state 干扰
 * [POS]: pages 的订阅导航边界回归；不把任意 location state 当成可信任的跳转地址
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { describe, expect, test } from "bun:test";
import { SUBSCRIPTION_PATH, isSubscriptionPath, subscriptionReturnPath, workspacePathForLocation } from "./subscriptionNavigation";

describe("订阅导航工作区来路", () => {
  test.each(["/app", "/app/notes/memo-1", "/app/notes/canvas-1"])("保存有效来路 %s", (path) => {
    expect(subscriptionReturnPath({ workspacePath: path })).toBe(path);
    expect(workspacePathForLocation({ pathname: SUBSCRIPTION_PATH, state: { workspacePath: path } })).toBe(path);
  });

  test.each([null, undefined, {}, "https://example.com", { workspacePath: 1 },
    { workspacePath: "https://example.com/app/notes/a" }, { workspacePath: "//example.com/app" },
    { workspacePath: "/app/subscription" }, { workspacePath: "/app/notes/a/b" },
    { workspacePath: "/login" }, { workspacePath: "javascript:alert(1)" },
  ])("不可信或无效来路 %j 回到工作区", (state) => {
    expect(subscriptionReturnPath(state)).toBe("/app");
  });

  test("直接打开订阅保持订阅地址，只为底层提供默认工作区路径", () => {
    const location = { pathname: SUBSCRIPTION_PATH, state: null };
    expect(workspacePathForLocation(location)).toBe("/app");
    expect(location.pathname).toBe(SUBSCRIPTION_PATH);
  });

  test("订阅末尾斜杠仍属于同一页面，不会被当成工作区初始化入口", () => {
    expect(isSubscriptionPath("/app/subscription/")).toBe(true);
    expect(isSubscriptionPath("/app/subscription/other")).toBe(false);
    expect(workspacePathForLocation({ pathname: "/app/subscription/", state: { workspacePath: "/app/notes/memo-one" } })).toBe("/app/notes/memo-one");
  });

  test("普通笔记与画布路由始终以当前 pathname 为准，不吃旧返回 state", () => {
    for (const pathname of ["/app/notes/memo-current", "/app/notes/canvas-current"]) {
      expect(workspacePathForLocation({ pathname, state: { workspacePath: "/app/notes/previous" } })).toBe(pathname);
    }
  });
});

test("购买积分弹窗沿用订阅的原工作区身份", () => {
  expect(workspacePathForLocation({ pathname: "/app/subscription/credits", state: { workspacePath: "/app/notes/canvas-1" } })).toBe("/app/notes/canvas-1");
  expect(workspacePathForLocation({ pathname: "/app/subscription/credits/", state: null })).toBe("/app");
});
